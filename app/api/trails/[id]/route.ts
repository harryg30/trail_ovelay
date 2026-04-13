import { NextRequest, NextResponse } from 'next/server'
import { queryOne, query } from '@/lib/db'
import { getSessionUserId } from '@/lib/auth'
import { rowToTrail, type TrailRow } from '@/lib/api/mappers'

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
    const hasOsmWayId = body.osmWayId !== undefined

    const setClauses = ['name=$1', 'difficulty=$2', 'direction=$3', 'notes=$4']
    const queryParams: unknown[] = [body.name.trim(), body.difficulty, body.direction, body.notes ?? null]
    let idx = 5

    if (hasPolyline) {
      setClauses.push(`polyline=$${idx}`, `distance_km=$${idx + 1}`)
      queryParams.push(JSON.stringify(body.polyline), body.distanceKm ?? null)
      idx += 2
    }
    if (hasOsmWayId) {
      setClauses.push(`osm_way_id=$${idx}`)
      queryParams.push(body.osmWayId ?? null)
      idx++
    }

    queryParams.push(id)
    const row = await queryOne<TrailRow>(
      `UPDATE trails SET ${setClauses.join(', ')} WHERE id=$${idx}
       RETURNING id, name, difficulty, direction, polyline,
         distance_km, elevation_gain_ft, notes,
         source, source_ride_id, osm_way_id, uploaded_by_email, created_at`,
      queryParams as string[]
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
