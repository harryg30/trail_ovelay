import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { query, queryOne } from '@/lib/db'
import { getSessionUserId } from '@/lib/auth'
import type { MapOverlayAlignmentPoint, MapOverlayRecord, MapOverlayTransformJson } from '@/lib/types'

const MAX_MAP_BYTES = 25 * 1024 * 1024

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

type PointRow = {
  seq: number
  img_x: number
  img_y: number
  lat: number
  lon: number
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

function rowToPoint(row: PointRow): MapOverlayAlignmentPoint {
  return {
    seq: row.seq === 2 ? 2 : 1,
    imgX: row.img_x,
    imgY: row.img_y,
    lat: row.lat,
    lon: row.lon,
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: networkId } = await params
    const row = await queryOne<OverlayRow>(
      `SELECT id, network_id, blob_url, source_url, title, printed_date,
              image_width, image_height, transform, opacity::text, created_at
       FROM map_overlays WHERE network_id = $1`,
      [networkId]
    )
    if (!row) {
      return NextResponse.json({ overlay: null, alignmentPoints: [] })
    }
    const points = await query<PointRow>(
      `SELECT seq, img_x, img_y, lat, lon
       FROM map_overlay_alignment_points
       WHERE map_overlay_id = $1
       ORDER BY seq`,
      [row.id]
    )
    return NextResponse.json({
      overlay: rowToOverlay(row),
      alignmentPoints: points.map(rowToPoint),
    })
  } catch (e) {
    console.error('GET map-overlay error:', e)
    return NextResponse.json({ error: 'Failed to load map overlay' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id: networkId } = await params
    const net = await queryOne<{ id: string }>(`SELECT id FROM networks WHERE id = $1`, [networkId])
    if (!net) {
      return NextResponse.json({ error: 'Network not found' }, { status: 404 })
    }

    let form: FormData
    try {
      form = await request.formData()
    } catch {
      return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 })
    }

    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 })
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      return NextResponse.json({ error: 'Only JPEG, PNG, or WebP' }, { status: 400 })
    }
    if (file.size <= 0 || file.size > MAX_MAP_BYTES) {
      return NextResponse.json({ error: 'Invalid file size' }, { status: 400 })
    }

    const w = Number(form.get('imageWidth'))
    const h = Number(form.get('imageHeight'))
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1) {
      return NextResponse.json({ error: 'imageWidth and imageHeight required' }, { status: 400 })
    }

    const titleRaw = form.get('title')
    const title = typeof titleRaw === 'string' && titleRaw.trim() ? titleRaw.trim() : null
    const sourceUrlRaw = form.get('sourceUrl')
    const sourceUrl =
      typeof sourceUrlRaw === 'string' && sourceUrlRaw.trim() ? sourceUrlRaw.trim() : null
    const printedRaw = form.get('printedDate')
    let printedDate: string | null = null
    if (typeof printedRaw === 'string' && printedRaw.trim()) {
      const d = new Date(printedRaw)
      if (Number.isFinite(d.getTime())) printedDate = d.toISOString().slice(0, 10)
    }

    const ext =
      file.type === 'image/jpeg' ? 'jpg' :
      file.type === 'image/png' ? 'png' :
      'webp'
    const key = `map-overlays/${networkId}/${crypto.randomUUID()}.${ext}`
    const buffer = await file.arrayBuffer()
    const blob = await put(key, buffer, {
      access: 'public',
      contentType: file.type,
    })

    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM map_overlays WHERE network_id = $1`,
      [networkId]
    )
    if (existing) {
      await query(`DELETE FROM map_overlay_alignment_points WHERE map_overlay_id = $1`, [existing.id])
      await query(`DELETE FROM map_overlays WHERE id = $1`, [existing.id])
    }

    const row = await queryOne<OverlayRow>(
      `INSERT INTO map_overlays (
         network_id, blob_url, source_url, title, printed_date,
         image_width, image_height, transform, opacity, created_by_user_id
       ) VALUES ($1, $2, $3, $4, $5::date, $6, $7, NULL, 0.55, $8)
       RETURNING id, network_id, blob_url, source_url, title, printed_date,
                 image_width, image_height, transform, opacity::text, created_at`,
      [networkId, blob.url, sourceUrl, title, printedDate, Math.round(w), Math.round(h), userId]
    )

    if (!row) {
      return NextResponse.json({ error: 'Failed to save overlay' }, { status: 500 })
    }

    return NextResponse.json({
      overlay: rowToOverlay(row),
      alignmentPoints: [] as MapOverlayAlignmentPoint[],
    })
  } catch (e) {
    console.error('POST map-overlay error:', e)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
