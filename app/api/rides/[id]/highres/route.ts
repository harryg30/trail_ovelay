import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getSessionUserId } from '@/lib/auth'

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

interface StravaActivity {
  map: {
    polyline: string | null
  }
}

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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const userId = await getSessionUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: rideId } = await params

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
    return NextResponse.json({ error: 'No Strava activity linked to this ride' }, { status: 400 })
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

  const activityRes = await fetch(
    `https://www.strava.com/api/v3/activities/${row.strava_activity_id}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!activityRes.ok) {
    console.error('Strava activity fetch failed:', activityRes.status, await activityRes.text())
    return NextResponse.json({ error: 'Failed to fetch activity from Strava' }, { status: 502 })
  }

  const activity: StravaActivity = await activityRes.json()
  const encoded = activity.map?.polyline

  if (!encoded) {
    return NextResponse.json({ error: 'Activity has no polyline' }, { status: 400 })
  }

  const polyline = decodePolyline(encoded)
  return NextResponse.json({ polyline })
}
