import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getSessionUserId, getUserIdFromBearerToken } from '@/lib/auth'
import type { TrailPhoto } from '@/lib/types'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url)
    const trailId = searchParams.get('trailId')

    let userId = await getSessionUserId()
    if (!userId) userId = await getUserIdFromBearerToken(request)

    // Build params: always pass userId (or null) and optionally trailId
    // $1 = userId (or null), $2 = trailId (or null)
    const rows = await query<{
      id: string
      strava_unique_id: string
      ride_id: string
      trail_id: string | null
      blob_url: string
      caption: string | null
      pin_lat: number | null
      pin_lon: number | null
      score: string
      user_vote: number | null
      created_at: string
    }>(
      `SELECT
        p.id,
        p.strava_unique_id,
        p.ride_id,
        p.trail_id,
        p.blob_url,
        p.caption,
        p.pin_lat,
        p.pin_lon,
        COALESCE(SUM(v.value), 0) AS score,
        MAX(CASE WHEN $1::uuid IS NOT NULL AND v.user_id = $1::uuid THEN v.value END) AS user_vote,
        p.created_at
      FROM trail_photos p
      LEFT JOIN photo_votes v ON v.photo_id = p.id
      WHERE ($2::uuid IS NULL OR p.trail_id = $2::uuid)
      GROUP BY p.id
      ORDER BY p.created_at DESC`,
      [userId ?? null, trailId ?? null]
    )

    const photos: TrailPhoto[] = rows.map((row) => ({
      id: row.id,
      stravaUniqueId: row.strava_unique_id,
      rideId: row.ride_id,
      trailId: row.trail_id,
      blobUrl: row.blob_url,
      caption: row.caption,
      pinLat: row.pin_lat,
      pinLon: row.pin_lon,
      score: Number(row.score),
      userVote: (row.user_vote as 1 | -1 | null) ?? null,
      createdAt: new Date(row.created_at),
    }))

    return NextResponse.json({ photos }, { headers: CORS_HEADERS })
  } catch (error) {
    console.error('GET /api/photos error:', error)
    return NextResponse.json({ photos: [] }, { status: 500, headers: CORS_HEADERS })
  }
}
