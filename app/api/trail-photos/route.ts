import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { query, queryOne } from '@/lib/db'
import { getSessionUserId } from '@/lib/auth'
import type { TrailPhoto } from '@/lib/types'

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10MB
const DEFAULT_LIMIT = 300
const MAX_LIMIT = 1000

/** GET only — browser extension reads published pins cross-origin. POST stays same-origin + cookie. */
const GET_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: GET_CORS_HEADERS })
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

function parseOptionalNumber(v: FormDataEntryValue | null): number | null {
  if (v == null) return null
  if (typeof v !== 'string') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Community-visible: pinned to a trail only (not other users' unpinned uploads). */
const TRAIL_PHOTOS_PUBLIC_VISIBILITY_SQL = `status = 'published'
           AND accepted = true
           AND trail_id IS NOT NULL
           AND trail_lat IS NOT NULL AND trail_lon IS NOT NULL`

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const trailIdParam = searchParams.get('trailId')
    const trailIdFilter =
      typeof trailIdParam === 'string' && trailIdParam.trim().length > 0
        ? trailIdParam.trim()
        : null

    const limitRaw = Number(searchParams.get('limit'))
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(Math.floor(limitRaw), MAX_LIMIT)
        : DEFAULT_LIMIT

    if (trailIdFilter) {
      const uuidLike =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          trailIdFilter
        )
      if (!uuidLike) {
        return NextResponse.json({ photos: [] }, { headers: GET_CORS_HEADERS })
      }
      // Cast so string query params always match the trails.id FK (extension + web).
      const rows = await query<TrailPhotoRow>(
        `SELECT
           id, blob_url, thumbnail_url, lat, lon, taken_at,
           trail_id, trail_lat, trail_lon, accepted, status, created_by_user_id, created_at
         FROM trail_photos
         WHERE ${TRAIL_PHOTOS_PUBLIC_VISIBILITY_SQL}
           AND trail_id = $1::uuid
         ORDER BY created_at DESC
         LIMIT $2`,
        [trailIdFilter.trim(), limit]
      )
      return NextResponse.json(
        { photos: rows.map(rowToTrailPhoto) },
        { headers: GET_CORS_HEADERS }
      )
    }

    const north = Number(searchParams.get('north'))
    const south = Number(searchParams.get('south'))
    const east = Number(searchParams.get('east'))
    const west = Number(searchParams.get('west'))

    // If bounds are omitted, return a small recent sample rather than the whole world.
    const hasBounds = [north, south, east, west].every((n) => Number.isFinite(n))

    const rows = hasBounds
      ? await query<TrailPhotoRow>(
          `SELECT
           id, blob_url, thumbnail_url, lat, lon, taken_at,
           trail_id, trail_lat, trail_lon, accepted, status, created_by_user_id, created_at
         FROM trail_photos
         WHERE ${TRAIL_PHOTOS_PUBLIC_VISIBILITY_SQL}
           AND trail_lat <= $1 AND trail_lat >= $2
           AND trail_lon <= $3 AND trail_lon >= $4
         ORDER BY created_at DESC
         LIMIT $5`,
          [north, south, east, west, limit]
        )
      : await query<TrailPhotoRow>(
          `SELECT
           id, blob_url, thumbnail_url, lat, lon, taken_at,
           trail_id, trail_lat, trail_lon, accepted, status, created_by_user_id, created_at
         FROM trail_photos
         WHERE ${TRAIL_PHOTOS_PUBLIC_VISIBILITY_SQL}
         ORDER BY created_at DESC
         LIMIT $1`,
          [Math.min(limit, 100)]
        )

    return NextResponse.json(
      { photos: rows.map(rowToTrailPhoto) },
      { headers: GET_CORS_HEADERS }
    )
  } catch (error) {
    console.error('GET /api/trail-photos error:', error)
    return NextResponse.json(
      { photos: [], error: 'Internal server error' },
      { status: 500, headers: GET_CORS_HEADERS }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getSessionUserId()
    if (!userId) {
      return NextResponse.json(
        { error: 'Sign in to upload trail photos to the server.' },
        { status: 401 }
      )
    }

    const recent = await queryOne<{ c: string }>(
      `SELECT COUNT(*)::text AS c
       FROM trail_photos
       WHERE created_by_user_id = $1
         AND created_at > now() - interval '1 minute'`,
      [userId]
    )
    if (recent && Number(recent.c) >= 30) {
      return NextResponse.json({ error: 'Rate limit: too many uploads, try again in a minute' }, { status: 429 })
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
      return NextResponse.json({ error: 'Only JPEG, PNG, or WebP uploads are supported' }, { status: 400 })
    }
    if (file.size <= 0) {
      return NextResponse.json({ error: 'Empty file' }, { status: 400 })
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: `File too large (max ${MAX_UPLOAD_BYTES} bytes)` }, { status: 413 })
    }

    const lat = parseOptionalNumber(form.get('lat'))
    const lon = parseOptionalNumber(form.get('lon'))
    const takenAtRaw = form.get('takenAt')
    let takenAt: string | null = null
    if (typeof takenAtRaw === 'string' && takenAtRaw.trim()) {
      const parsedTakenAt = new Date(takenAtRaw)
      if (Number.isFinite(parsedTakenAt.getTime())) {
        takenAt = parsedTakenAt.toISOString()
      }
    }

    const trailIdRaw = form.get('trailId')
    const trailId =
      typeof trailIdRaw === 'string' && trailIdRaw.trim().length > 0 ? trailIdRaw.trim() : null
    const trailLat = parseOptionalNumber(form.get('trailLat'))
    const trailLon = parseOptionalNumber(form.get('trailLon'))
    const pinInOneShot =
      trailId != null &&
      trailLat != null &&
      trailLon != null &&
      Number.isFinite(trailLat) &&
      Number.isFinite(trailLon)

    const ext =
      file.type === 'image/jpeg' ? 'jpg' :
      file.type === 'image/png' ? 'png' :
      file.type === 'image/webp' ? 'webp' :
      'img'

    const key = `trail-photos/public/${crypto.randomUUID()}.${ext}`

    const buffer = await file.arrayBuffer()
    const blob = await put(key, buffer, {
      access: 'public',
      contentType: file.type,
    })

    const row = pinInOneShot
      ? await queryOne<TrailPhotoRow>(
          `INSERT INTO trail_photos (
             blob_url, thumbnail_url, lat, lon, taken_at, created_by_user_id,
             trail_id, trail_lat, trail_lon, accepted
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
           RETURNING
             id, blob_url, thumbnail_url, lat, lon, taken_at,
             trail_id, trail_lat, trail_lon, accepted, status, created_by_user_id, created_at`,
          [
            blob.url,
            null,
            lat ?? trailLat,
            lon ?? trailLon,
            takenAt,
            userId,
            trailId,
            trailLat,
            trailLon,
          ]
        )
      : await queryOne<TrailPhotoRow>(
          `INSERT INTO trail_photos (
             blob_url, thumbnail_url, lat, lon, taken_at, created_by_user_id
           ) VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING
             id, blob_url, thumbnail_url, lat, lon, taken_at,
             trail_id, trail_lat, trail_lon, accepted, status, created_by_user_id, created_at`,
          [blob.url, null, lat, lon, takenAt, userId]
        )

    if (!row) {
      return NextResponse.json({ error: 'Failed to create trail photo' }, { status: 500 })
    }

    return NextResponse.json({ photo: rowToTrailPhoto(row) })
  } catch (err: unknown) {
    const e = err as { code?: unknown; message?: unknown }
    const code = typeof e?.code === 'string' ? e.code : undefined
    const message = err instanceof Error ? err.message : String(err)
    console.error('POST /api/trail-photos error:', { code, message })

    // Common production misconfig: DB migrations not applied
    if (code === '42P01' || /trail_photos/i.test(message)) {
      return NextResponse.json(
        { error: 'Database schema missing: trail_photos table not found. Run migrations on this environment.' },
        { status: 500 }
      )
    }

    // Common local misconfig: Blob token missing
    if (/BLOB_READ_WRITE_TOKEN|vercel.*blob|blob/i.test(message)) {
      return NextResponse.json(
        {
          error:
            'Failed to upload photo (Blob). If running locally, ensure `BLOB_READ_WRITE_TOKEN` is set in `.env.local` (or run `vercel env pull`).',
          details: process.env.NODE_ENV !== 'production' ? { code, message } : undefined,
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        error: 'Failed to upload photo',
        details: process.env.NODE_ENV !== 'production' ? { code, message } : undefined,
      },
      { status: 500 }
    )
  }
}

