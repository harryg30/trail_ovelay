import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getSessionUserId } from '@/lib/auth'
import { buildMapOverlayTransform } from '@/lib/map-overlay-transform'
import type { MapOverlayRecord, MapOverlayTransformJson } from '@/lib/types'

type OverlayRow = {
  id: string
  network_id: string
  blob_url: string
  source_url: string | null
  title: string | null
  printed_date: string | null
  image_width: number
  image_height: number
  transform: MapOverlayTransformJson | null
  opacity: string
  created_at: string
}

function rowToOverlay(row: OverlayRow): MapOverlayRecord {
  return {
    id: row.id,
    networkId: row.network_id,
    blobUrl: row.blob_url,
    sourceUrl: row.source_url ?? undefined,
    title: row.title ?? undefined,
    printedDate: row.printed_date ?? undefined,
    imageWidth: row.image_width,
    imageHeight: row.image_height,
    transform: row.transform,
    opacity: Number(row.opacity),
    createdAt: new Date(row.created_at),
  }
}

type Pair = {
  img: { x: number; y: number }
  ll: { lat: number; lon: number }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id: overlayId } = await params
    const body = (await request.json()) as { pairs?: Pair[] }
    const pairs = body.pairs
    if (!Array.isArray(pairs) || pairs.length !== 2) {
      return NextResponse.json({ error: 'Exactly two pairs required' }, { status: 400 })
    }

    const overlay = await queryOne<{
      id: string
      image_width: number
      image_height: number
    }>(`SELECT id, image_width, image_height FROM map_overlays WHERE id = $1`, [overlayId])
    if (!overlay) {
      return NextResponse.json({ error: 'Overlay not found' }, { status: 404 })
    }

    for (let i = 0; i < 2; i++) {
      const p = pairs[i]
      if (
        !p?.img ||
        !p?.ll ||
        typeof p.img.x !== 'number' ||
        typeof p.img.y !== 'number' ||
        typeof p.ll.lat !== 'number' ||
        typeof p.ll.lon !== 'number'
      ) {
        return NextResponse.json({ error: 'Invalid pair shape' }, { status: 400 })
      }
    }

    const [p1, p2] = pairs
    let transform: MapOverlayTransformJson
    try {
      transform = buildMapOverlayTransform(
        overlay.image_width,
        overlay.image_height,
        { x: p1.img.x, y: p1.img.y },
        { lat: p1.ll.lat, lon: p1.ll.lon },
        { x: p2.img.x, y: p2.img.y },
        { lat: p2.ll.lat, lon: p2.ll.lon }
      ) as MapOverlayTransformJson
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Alignment failed'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    await query(`DELETE FROM map_overlay_alignment_points WHERE map_overlay_id = $1`, [overlayId])

    await query(
      `INSERT INTO map_overlay_alignment_points (map_overlay_id, seq, img_x, img_y, lat, lon)
       VALUES ($1, 1, $2, $3, $4, $5), ($1, 2, $6, $7, $8, $9)`,
      [
        overlayId,
        p1.img.x,
        p1.img.y,
        p1.ll.lat,
        p1.ll.lon,
        p2.img.x,
        p2.img.y,
        p2.ll.lat,
        p2.ll.lon,
      ]
    )

    const row = await queryOne<OverlayRow>(
      `UPDATE map_overlays SET transform = $2::jsonb WHERE id = $1
       RETURNING id, network_id, blob_url, source_url, title, printed_date,
                 image_width, image_height, transform, opacity::text, created_at`,
      [overlayId, JSON.stringify(transform)]
    )

    if (!row) {
      return NextResponse.json({ error: 'Failed to update overlay' }, { status: 500 })
    }

    return NextResponse.json({ overlay: rowToOverlay(row) })
  } catch (e) {
    console.error('PATCH alignment error:', e)
    return NextResponse.json({ error: 'Alignment save failed' }, { status: 500 })
  }
}
