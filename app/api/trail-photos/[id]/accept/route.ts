import { NextRequest, NextResponse } from 'next/server'
import { queryOne } from '@/lib/db'
import { getSessionUserId } from '@/lib/auth'
import type { TrailPhoto } from '@/lib/types'

interface AcceptBody {
  trailId: string
  trailLat: number
  trailLon: number
}

type TrailPhotoRow = {
  id: string
  blob_url: string
  thumbnail_url: string | null
  lat: number | null
  lon: number | null
  taken_at: string | null
  trail_id: string | null
  trail_lat: number | null
  trail_lon: number | null
  accepted: boolean
  status: 'published' | 'hidden' | 'flagged'
  created_by_user_id: string | null
  created_at: string
}

function rowToTrailPhoto(row: TrailPhotoRow): TrailPhoto {
  return {
    id: row.id,
    blobUrl: row.blob_url,
    thumbnailUrl: row.thumbnail_url ?? undefined,
    lat: row.lat ?? undefined,
    lon: row.lon ?? undefined,
    takenAt: row.taken_at ? new Date(row.taken_at) : undefined,
    trailId: row.trail_id ?? undefined,
    trailLat: row.trail_lat ?? undefined,
    trailLon: row.trail_lon ?? undefined,
    accepted: row.accepted,
    status: row.status,
    createdByUserId: row.created_by_user_id ?? undefined,
    createdAt: new Date(row.created_at),
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const userId = await getSessionUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    let body: AcceptBody
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { trailId, trailLat, trailLon } = body
    if (!trailId || trailLat == null || trailLon == null) {
      return NextResponse.json({ error: 'Missing trailId, trailLat, or trailLon' }, { status: 400 })
    }

    const updated = await queryOne<TrailPhotoRow>(
      `UPDATE trail_photos
       SET trail_id = $1,
           trail_lat = $2,
           trail_lon = $3,
           lat = COALESCE(lat, $2),
           lon = COALESCE(lon, $3),
           accepted = true
       WHERE id = $4
         AND created_by_user_id = $5
       RETURNING
         id, blob_url, thumbnail_url, lat, lon, taken_at,
         trail_id, trail_lat, trail_lon, accepted, status, created_by_user_id, created_at`,
      [trailId, trailLat, trailLon, id, userId]
    )

    if (!updated) {
      return NextResponse.json({ error: 'Photo not found or not yours' }, { status: 404 })
    }

    return NextResponse.json({ photo: rowToTrailPhoto(updated) })
  } catch (err: unknown) {
    const e = err as { code?: unknown; message?: unknown }
    const code = typeof e?.code === 'string' ? e.code : undefined
    const message = err instanceof Error ? err.message : String(err)
    console.error('POST /api/trail-photos/[id]/accept error:', { code, message })
    return NextResponse.json({ error: 'Failed to accept photo' }, { status: 500 })
  }
}

