import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getSessionUserId } from '@/lib/auth'
import type { TrailPhoto } from '@/lib/types'

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

/**
 * Unpinned / in-progress photos for the current user only (not community-visible).
 */
export async function GET() {
  const userId = await getSessionUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const rows = await query<TrailPhotoRow>(
      `SELECT
         id, blob_url, thumbnail_url, lat, lon, taken_at,
         trail_id, trail_lat, trail_lon, accepted, status, created_by_user_id, created_at
       FROM trail_photos
       WHERE created_by_user_id = $1
         AND status = 'published'
         AND (trail_id IS NULL OR accepted = false)
       ORDER BY created_at DESC
       LIMIT 200`,
      [userId]
    )
    return NextResponse.json({ photos: rows.map(rowToTrailPhoto) })
  } catch (err: any) {
    const code = err?.code as string | undefined
    console.error('GET /api/trail-photos/mine error:', { code, message: err?.message })
    return NextResponse.json({ error: 'Failed to list photos' }, { status: 500 })
  }
}
