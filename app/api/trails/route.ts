import { NextRequest, NextResponse } from 'next/server'
import { query, withTransaction } from '@/lib/db'
import { getSessionUserId } from '@/lib/auth'
import type { Trail, SaveTrailRequest, SaveTrailResponse } from '@/lib/types'
import { rowToTrail, type TrailRow } from '@/lib/api/mappers'
import { trailRowToPayload, insertRevision } from '@/lib/api/revisions'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET() {
  try {
    const rows = await query<TrailRow>(`
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
        osm_way_id,
        uploaded_by_email,
        created_at
      FROM trails
      ORDER BY created_at DESC
    `)

    const trails: Trail[] = rows.map(rowToTrail)

    return NextResponse.json({ success: true, trails }, { headers: CORS_HEADERS })
  } catch (error) {
    console.error('GET /api/trails error:', error)
    return NextResponse.json({ success: false, error: String(error), trails: [] }, { status: 500, headers: CORS_HEADERS })
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<SaveTrailResponse>> {
  try {
    const userId = await getSessionUserId()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body: SaveTrailRequest & { changeSetId?: string; summary?: string } = await request.json()

    if (!body.trails || !Array.isArray(body.trails) || body.trails.length === 0) {
      return NextResponse.json({ success: false, error: 'No trails provided' }, { status: 400 })
    }

    const savedTrails: Trail[] = []

    for (const t of body.trails) {
      if (!t.name?.trim()) {
        return NextResponse.json({ success: false, error: 'Trail name is required' }, { status: 400 })
      }

      const trail = await withTransaction(async (tx) => {
        const row = await tx.queryOne<TrailRow>(`
          INSERT INTO trails (
            name, difficulty, direction, polyline,
            distance_km, elevation_gain_ft, notes, source, source_ride_id, osm_way_id,
            uploaded_by_user_id, updated_by_user_id, updated_at
          ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11, $11, now())
          RETURNING
            id, name, difficulty, direction, polyline,
            distance_km, elevation_gain_ft, notes,
            source, source_ride_id, osm_way_id, uploaded_by_email, created_at
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
          t.osmWayId ?? null,
          userId,
        ])

        if (!row) throw new Error('Insert returned no row')

        await insertRevision({
          tx,
          trailId: row.id,
          userId,
          action: 'create',
          payload: trailRowToPayload(row),
          summary: body.summary ?? null,
          changeSetId: body.changeSetId ?? null,
        })

        return rowToTrail(row)
      })

      savedTrails.push(trail)
    }

    return NextResponse.json({ success: true, savedTrails })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('POST /api/trails error:', message)
    return NextResponse.json({ success: false, error: 'Failed to save trail' }, { status: 500 })
  }
}
