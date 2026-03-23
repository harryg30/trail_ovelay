import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getSessionUserId } from '@/lib/auth'
import type { Trail, SaveTrailRequest, SaveTrailResponse } from '@/lib/types'

export async function GET() {
  try {
    const rows = await query<{
      id: string
      name: string
      difficulty: Trail['difficulty']
      direction: Trail['direction']
      polyline: [number, number][]
      distance_km: number
      elevation_gain_ft: number
      notes: string | null
      source: string
      source_ride_id: string | null
      uploaded_by_email: string | null
      created_at: string
    }>(`
      SELECT
        id,
        name,
        difficulty,
        direction,
        polyline,
        distance_km,
        elevation_gain_ft,
        notes,
        source,
        source_ride_id,
        uploaded_by_email,
        created_at
      FROM trails
      ORDER BY created_at DESC
    `)

    const trails: Trail[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      difficulty: row.difficulty,
      direction: row.direction,
      polyline: row.polyline,
      distanceKm: row.distance_km,
      elevationGainFt: row.elevation_gain_ft,
      notes: row.notes ?? undefined,
      source: row.source,
      sourceRideId: row.source_ride_id ?? undefined,
      uploadedByEmail: row.uploaded_by_email ?? undefined,
      createdAt: new Date(row.created_at),
    }))

    return NextResponse.json({ success: true, trails })
  } catch (error) {
    console.error('GET /api/trails error:', error)
    return NextResponse.json({ success: true, trails: [] })
  }
}

type TrailRow = {
  id: string
  name: string
  difficulty: Trail['difficulty']
  direction: Trail['direction']
  polyline: [number, number][]
  distance_km: number
  elevation_gain_ft: number
  notes: string | null
  source: string
  source_ride_id: string | null
  uploaded_by_email: string | null
  created_at: string
}

function rowToTrail(row: TrailRow): Trail {
  return {
    id: row.id,
    name: row.name,
    difficulty: row.difficulty,
    direction: row.direction,
    polyline: row.polyline,
    distanceKm: row.distance_km,
    elevationGainFt: row.elevation_gain_ft,
    notes: row.notes ?? undefined,
    source: row.source,
    sourceRideId: row.source_ride_id ?? undefined,
    uploadedByEmail: row.uploaded_by_email ?? undefined,
    createdAt: new Date(row.created_at),
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<SaveTrailResponse>> {
  try {
    const userId = await getSessionUserId()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body: SaveTrailRequest = await request.json()

    if (!body.trails || !Array.isArray(body.trails) || body.trails.length === 0) {
      return NextResponse.json({ success: false, error: 'No trails provided' }, { status: 400 })
    }

    const savedTrails: Trail[] = []

    for (const t of body.trails) {
      if (!t.name?.trim()) {
        return NextResponse.json({ success: false, error: 'Trail name is required' }, { status: 400 })
      }

      const row = await queryOne<TrailRow>(`
        INSERT INTO trails (
          name, difficulty, direction, polyline,
          distance_km, elevation_gain_ft, notes, source, source_ride_id, uploaded_by_user_id
        ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10)
        RETURNING
          id, name, difficulty, direction, polyline,
          distance_km, elevation_gain_ft, notes,
          source, source_ride_id, uploaded_by_email, created_at
      `, [
        t.name.trim(),
        t.difficulty,
        t.direction,
        JSON.stringify(t.polyline),
        t.distanceKm,
        t.elevationGainFt,
        t.notes ?? null,
        t.source,
        t.sourceRideId ?? null,
        userId,
      ])

      if (row) savedTrails.push(rowToTrail(row))
    }

    return NextResponse.json({ success: true, savedTrails })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('POST /api/trails error:', message)
    return NextResponse.json({ success: false, error: 'Failed to save trail' }, { status: 500 })
  }
}
