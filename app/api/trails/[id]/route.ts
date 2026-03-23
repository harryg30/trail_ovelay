import { NextRequest, NextResponse } from 'next/server'
import { queryOne, query } from '@/lib/db'
import { getSessionUserId } from '@/lib/auth'
import type { Trail } from '@/lib/types'

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId()
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json()

    if (!body.name?.trim()) {
      return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 })
    }

    const hasPolyline = Array.isArray(body.polyline) && body.polyline.length >= 2

    const row = await queryOne<TrailRow>(
      hasPolyline
        ? `UPDATE trails
           SET name=$1, difficulty=$2, direction=$3, notes=$4, polyline=$5, distance_km=$6
           WHERE id=$7
           RETURNING id, name, difficulty, direction, polyline,
             distance_km, elevation_gain_ft, notes,
             source, source_ride_id, uploaded_by_email, created_at`
        : `UPDATE trails
           SET name=$1, difficulty=$2, direction=$3, notes=$4
           WHERE id=$5
           RETURNING id, name, difficulty, direction, polyline,
             distance_km, elevation_gain_ft, notes,
             source, source_ride_id, uploaded_by_email, created_at`,
      hasPolyline
        ? [body.name.trim(), body.difficulty, body.direction, body.notes ?? null, JSON.stringify(body.polyline), body.distanceKm ?? null, id]
        : [body.name.trim(), body.difficulty, body.direction, body.notes ?? null, id]
    )

    if (!row) {
      return NextResponse.json({ success: false, error: 'Trail not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, trail: rowToTrail(row) })
  } catch (error) {
    console.error('PATCH /api/trails/[id] error:', error)
    return NextResponse.json({ success: false, error: 'Failed to update trail' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    await query(`DELETE FROM trails WHERE id=$1`, [id])
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/trails/[id] error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ success: false, error: 'Failed to delete trail' }, { status: 500 })
  }
}
