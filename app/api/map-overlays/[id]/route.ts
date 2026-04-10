import { NextRequest, NextResponse } from 'next/server'
import { queryOne } from '@/lib/db'
import { getSessionUserId } from '@/lib/auth'
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = (await request.json()) as { opacity?: number }
    if (body.opacity === undefined || typeof body.opacity !== 'number') {
      return NextResponse.json({ error: 'opacity required' }, { status: 400 })
    }
    if (body.opacity < 0 || body.opacity > 1) {
      return NextResponse.json({ error: 'opacity must be 0–1' }, { status: 400 })
    }

    const row = await queryOne<OverlayRow>(
      `UPDATE map_overlays SET opacity = $2 WHERE id = $1
       RETURNING id, network_id, blob_url, source_url, title, printed_date,
                 image_width, image_height, transform, opacity::text, created_at`,
      [id, body.opacity]
    )
    if (!row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ overlay: rowToOverlay(row) })
  } catch (e) {
    console.error('PATCH map-overlay error:', e)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}
