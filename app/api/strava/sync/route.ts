import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getSessionUserId } from '@/lib/auth'

interface StravaActivity {
  id: number
  name: string
  distance: number
  total_elevation_gain: number
  start_date: string
  map: {
    summary_polyline: string | null
  }
}

interface UserTokenRow {
  access_token: string
  refresh_token: string
  token_expires_at: string
}

interface RefreshResponse {
  access_token: string
  refresh_token: string
  expires_at: number
}

// Decode Google encoded polyline format into [lat, lng][] array
function decodePolyline(encoded: string): [number, number][] {
  const coords: [number, number][] = []
  let index = 0
  let lat = 0
  let lng = 0

  while (index < encoded.length) {
    let shift = 0
    let result = 0
    let byte: number
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    const dlat = result & 1 ? ~(result >> 1) : result >> 1
    lat += dlat

    shift = 0
    result = 0
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    const dlng = result & 1 ? ~(result >> 1) : result >> 1
    lng += dlng

    coords.push([lat / 1e5, lng / 1e5])
  }

  return coords
}

export async function POST(): Promise<Response> {
  const userId = await getSessionUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch user tokens
  const user = await queryOne<UserTokenRow>(
    `SELECT access_token, refresh_token, token_expires_at FROM users WHERE id = $1`,
    [userId]
  )
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  let accessToken = user.access_token

  // Refresh token if expired
  if (new Date(user.token_expires_at) <= new Date()) {
    const refreshRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: user.refresh_token,
      }),
    })

    if (!refreshRes.ok) {
      const body = await refreshRes.text()
      console.error('Strava token refresh failed:', refreshRes.status, body)
      return NextResponse.json({ error: 'Failed to refresh Strava token' }, { status: 502 })
    }

    const refreshData: RefreshResponse = await refreshRes.json()
    accessToken = refreshData.access_token

    await query(
      `UPDATE users SET access_token = $1, refresh_token = $2, token_expires_at = to_timestamp($3), updated_at = now() WHERE id = $4`,
      [refreshData.access_token, refreshData.refresh_token, refreshData.expires_at, userId]
    )
  }

  // Paginate through Strava activities
  let synced = 0
  let skipped = 0
  let page = 1

  while (true) {
    const res = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?per_page=100&page=${page}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    if (!res.ok) {
      const body = await res.text()
      console.error('Strava activities fetch failed:', res.status, body)
      return NextResponse.json({ error: 'Failed to fetch Strava activities' }, { status: 502 })
    }

    const activities: StravaActivity[] = await res.json()
    if (activities.length === 0) break

    for (const activity of activities) {
      const encodedPolyline = activity.map?.summary_polyline
      if (!encodedPolyline) {
        skipped++
        continue
      }

      const polyline = decodePolyline(encodedPolyline)
      if (polyline.length === 0) {
        skipped++
        continue
      }

      const result = await query<{ id: string }>(
        `INSERT INTO rides (user_id, name, distance, elevation, polyline, point_count, timestamp, strava_activity_id)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
         ON CONFLICT (strava_activity_id) DO NOTHING
         RETURNING id`,
        [
          userId,
          activity.name,
          activity.distance,
          activity.total_elevation_gain,
          JSON.stringify(polyline),
          polyline.length,
          activity.start_date,
          activity.id,
        ]
      )

      if (result.length > 0) {
        synced++
      } else {
        skipped++
      }
    }

    page++
  }

  return NextResponse.json({ synced, skipped })
}
