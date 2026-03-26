import { NextRequest, NextResponse } from 'next/server'
import { queryOne } from '@/lib/db'
import { getSessionUserId } from '@/lib/auth'

interface AcceptBody {
  trailId: string
  trailLat: number
  trailLon: number
}

interface PhotoRow {
  id: string
  ride_id: string
  blob_url: string
  thumbnail_url: string | null
  lat: number | null
  lon: number | null
  taken_at: string | null
  trail_id: string | null
  trail_lat: number | null
  trail_lon: number | null
  accepted: boolean
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const userId = await getSessionUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: photoId } = await params

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

  const updated = await queryOne<PhotoRow>(
    `UPDATE ride_photos p
     SET trail_id = $1, trail_lat = $2, trail_lon = $3, accepted = true
     FROM rides r
     WHERE p.id = $4
       AND p.ride_id = r.id
       AND r.user_id = $5
     RETURNING p.id, p.ride_id, p.blob_url, p.thumbnail_url, p.lat, p.lon, p.taken_at,
               p.trail_id, p.trail_lat, p.trail_lon, p.accepted`,
    [trailId, trailLat, trailLon, photoId, userId]
  )

  if (!updated) {
    return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
  }

  return NextResponse.json({
    photo: {
      id: updated.id,
      rideId: updated.ride_id,
      blobUrl: updated.blob_url,
      thumbnailUrl: updated.thumbnail_url ?? undefined,
      lat: updated.lat ?? undefined,
      lon: updated.lon ?? undefined,
      takenAt: updated.taken_at ? new Date(updated.taken_at) : undefined,
      trailId: updated.trail_id ?? undefined,
      trailLat: updated.trail_lat ?? undefined,
      trailLon: updated.trail_lon ?? undefined,
      accepted: updated.accepted,
    },
  })
}
