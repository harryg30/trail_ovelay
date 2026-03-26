import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getSessionUserId } from '@/lib/auth'
import { put } from '@vercel/blob'

interface TokenRow {
  strava_activity_id: number | null
  access_token: string
  refresh_token: string
  token_expires_at: string
}

interface RefreshResponse {
  access_token: string
  refresh_token: string
  expires_at: number
}

interface StravaPhoto {
  unique_id: string
  urls: Record<string, string>
  location: [number, number] | null
  created_at: string
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

function rowToPhoto(row: PhotoRow) {
  return {
    id: row.id,
    rideId: row.ride_id,
    blobUrl: row.blob_url,
    thumbnailUrl: row.thumbnail_url ?? undefined,
    lat: row.lat ?? undefined,
    lon: row.lon ?? undefined,
    takenAt: row.taken_at ? new Date(row.taken_at) : undefined,
    trailId: row.trail_id ?? undefined,
    trailLat: row.trail_lat ?? undefined,
    trailLon: row.trail_lon ?? undefined,
    accepted: row.accepted,
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const userId = await getSessionUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: rideId } = await params

  try {
  // Return cached photos if already fetched
  const cached = await query<PhotoRow>(
    `SELECT p.id, p.ride_id, p.blob_url, p.thumbnail_url, p.lat, p.lon, p.taken_at,
            p.trail_id, p.trail_lat, p.trail_lon, p.accepted
     FROM ride_photos p
     JOIN rides r ON r.id = p.ride_id
     WHERE p.ride_id = $1 AND r.user_id = $2
     ORDER BY p.taken_at ASC`,
    [rideId, userId]
  )

  if (cached.length > 0) {
    return NextResponse.json({ photos: cached.map(rowToPhoto) })
  }

  // Fetch tokens for Strava call
  const row = await queryOne<TokenRow>(
    `SELECT r.strava_activity_id, u.access_token, u.refresh_token, u.token_expires_at
     FROM rides r
     JOIN users u ON u.id = r.user_id
     WHERE r.id = $1 AND r.user_id = $2`,
    [rideId, userId]
  )

  if (!row) {
    return NextResponse.json({ error: 'Ride not found' }, { status: 404 })
  }

  if (!row.strava_activity_id) {
    return NextResponse.json({ photos: [] })
  }

  let accessToken = row.access_token

  if (new Date(row.token_expires_at) <= new Date()) {
    const refreshRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: row.refresh_token,
      }),
    })

    if (!refreshRes.ok) {
      console.error('Strava token refresh failed:', refreshRes.status, await refreshRes.text())
      return NextResponse.json({ error: 'Failed to refresh Strava token' }, { status: 502 })
    }

    const refreshData: RefreshResponse = await refreshRes.json()
    accessToken = refreshData.access_token

    await query(
      `UPDATE users SET access_token = $1, refresh_token = $2, token_expires_at = to_timestamp($3), updated_at = now() WHERE id = $4`,
      [refreshData.access_token, refreshData.refresh_token, refreshData.expires_at, userId]
    )
  }

  const photosRes = await fetch(
    `https://www.strava.com/api/v3/activities/${row.strava_activity_id}/photos?size=2048&photo_sources=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!photosRes.ok) {
    console.error('Strava photos fetch failed:', photosRes.status, await photosRes.text())
    return NextResponse.json({ error: 'Failed to fetch photos from Strava' }, { status: 502 })
  }

  const stravaPhotos: StravaPhoto[] = await photosRes.json()

  if (!stravaPhotos.length) {
    return NextResponse.json({ photos: [] })
  }

  const savedPhotos: ReturnType<typeof rowToPhoto>[] = []

  for (const photo of stravaPhotos) {
    const fullUrl = photo.urls['2048'] || photo.urls['600'] || Object.values(photo.urls)[0]
    const thumbUrl = photo.urls['600'] || photo.urls['100'] || null

    if (!fullUrl) continue

    let blobUrl: string
    try {
      const imgRes = await fetch(fullUrl)
      if (!imgRes.ok) continue
      const buffer = await imgRes.arrayBuffer()
      const blob = await put(`ride-photos/${rideId}/${photo.unique_id}.jpg`, buffer, {
        access: 'public',
        contentType: 'image/jpeg',
      })
      blobUrl = blob.url
    } catch (err) {
      console.error('Failed to upload photo to Blob:', err)
      continue
    }

    const lat = photo.location?.[0] ?? null
    const lon = photo.location?.[1] ?? null

    const inserted = await queryOne<PhotoRow>(
      `INSERT INTO ride_photos (ride_id, strava_photo_id, blob_url, thumbnail_url, lat, lon, taken_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (strava_photo_id) DO UPDATE
         SET blob_url = EXCLUDED.blob_url,
             thumbnail_url = EXCLUDED.thumbnail_url
       RETURNING id, ride_id, blob_url, thumbnail_url, lat, lon, taken_at,
                 trail_id, trail_lat, trail_lon, accepted`,
      [rideId, photo.unique_id, blobUrl, thumbUrl, lat, lon, photo.created_at || null]
    )

    if (inserted) savedPhotos.push(rowToPhoto(inserted))
  }

  return NextResponse.json({ photos: savedPhotos })
  } catch (err) {
    console.error('GET /api/rides/[id]/photos error:', err)
    return NextResponse.json({ error: 'Failed to load photos' }, { status: 500 })
  }
}
