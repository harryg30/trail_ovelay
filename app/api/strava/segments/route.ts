import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getSessionUserId, getSessionProvider } from '@/lib/auth'

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

interface StravaExplorerSegment {
  id: number
  name: string
  climb_category: number
  avg_grade: number
  start_latlng: [number, number]
  end_latlng: [number, number]
  elev_difference: number
  distance: number
  points: string
}

interface CacheEntry {
  data: unknown
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<unknown>>()
const CACHE_TTL_MS = 5 * 60 * 1000

function roundCoord(v: number, precision = 3): number {
  const factor = 10 ** precision
  return Math.round(v * factor) / factor
}

function buildCacheKey(south: number, west: number, north: number, east: number, activityType: string): string {
  return `${roundCoord(south)},${roundCoord(west)},${roundCoord(north)},${roundCoord(east)}|${activityType}`
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

export async function GET(request: NextRequest): Promise<Response> {
  const userId = await getSessionUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Only Strava-authenticated users can access Strava features
  const provider = await getSessionProvider()
  if (provider !== 'strava') {
    return NextResponse.json(
      { error: 'Strava features require authentication with Strava. Please sign in with your Strava account.' },
      { status: 403 }
    )
  }

  const sp = request.nextUrl.searchParams
  const south = Number(sp.get('south'))
  const west = Number(sp.get('west'))
  const north = Number(sp.get('north'))
  const east = Number(sp.get('east'))

  if ([south, west, north, east].some((v) => !Number.isFinite(v))) {
    return NextResponse.json({ error: 'Invalid bbox' }, { status: 400 })
  }

  const activityType = sp.get('activity_type') || 'running'

  const key = buildCacheKey(south, west, north, east, activityType)
  const cached = cache.get(key)
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.data, { headers: { 'X-Cache': 'HIT' } })
  }

  const user = await queryOne<UserTokenRow>(
    `SELECT access_token, refresh_token, token_expires_at FROM users WHERE id = $1`,
    [userId]
  )
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  let accessToken = user.access_token

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

  try {
    let promise = inflight.get(key)
    let coalesced = false
    if (!promise) {
      promise = (async () => {
        const bounds = `${south},${west},${north},${east}`
        const params = new URLSearchParams({ bounds, activity_type: activityType })
        const res = await fetch(
          `https://www.strava.com/api/v3/segments/explore?${params}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )

        if (!res.ok) {
          const body = await res.text()
          console.error('Strava segments explore failed:', res.status, body)
          throw new Error(`Strava: ${res.status} ${res.statusText}`)
        }

        const json = await res.json()
        const rawSegments: StravaExplorerSegment[] = json.segments ?? []

        const segments = rawSegments.map((seg) => ({
          id: seg.id,
          name: seg.name,
          distance: seg.distance,
          avgGrade: seg.avg_grade,
          climbCategory: seg.climb_category,
          elevDifference: seg.elev_difference,
          polyline: decodePolyline(seg.points),
          startLatlng: seg.start_latlng,
          endLatlng: seg.end_latlng,
        }))

        cache.set(key, { data: segments, expiresAt: Date.now() + CACHE_TTL_MS })

        if (cache.size > 200) {
          const now = Date.now()
          for (const [k, v] of cache) {
            if (v.expiresAt < now) cache.delete(k)
          }
        }

        return segments
      })()
      inflight.set(key, promise)
    } else {
      coalesced = true
    }

    const data = await promise
    return NextResponse.json(data, { headers: { 'X-Cache': coalesced ? 'COALESCED' : 'MISS' } })
  } catch (err) {
    console.error('Strava segments proxy error:', err)
    const msg = err instanceof Error ? err.message : 'Failed to fetch segments from Strava'
    return NextResponse.json({ error: msg }, { status: 502 })
  } finally {
    inflight.delete(key)
  }
}
