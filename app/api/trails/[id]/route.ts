import { NextRequest, NextResponse } from 'next/server'
import { withTransaction } from '@/lib/db'
import { getSessionUserId } from '@/lib/auth'
import { rowToTrail, type TrailRow } from '@/lib/api/mappers'
import { trailRowToPayload, insertRevision } from '@/lib/api/revisions'

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
    const body: {
      name?: string
      difficulty?: string
      direction?: string
      notes?: string
      polyline?: [number, number][]
      distanceKm?: number
      osmWayId?: number | null
      summary?: string
      changeSetId?: string
    } = await request.json()

    if (!body.name?.trim()) {
      return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 })
    }

    const hasPolyline = Array.isArray(body.polyline) && body.polyline.length >= 2
    const hasOsmWayId = body.osmWayId !== undefined

    const trail = await withTransaction(async (tx) => {
      const setClauses = ['name=$1', 'difficulty=$2', 'direction=$3', 'notes=$4',
        'updated_by_user_id=$5', 'updated_at=now()']
      const queryParams: unknown[] = [
        body.name!.trim(), body.difficulty, body.direction, body.notes ?? null, userId,
      ]
      let idx = 6

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
      const row = await tx.queryOne<TrailRow>(
        `UPDATE trails SET ${setClauses.join(', ')} WHERE id=$${idx}
         RETURNING id, name, difficulty, direction, polyline,
           distance_km, elevation_gain_ft, notes,
           source, source_ride_id, osm_way_id, uploaded_by_email, created_at`,
        queryParams as string[]
      )

      if (!row) return null

      await insertRevision({
        tx,
        trailId: row.id,
        userId,
        action: 'update',
        payload: trailRowToPayload(row),
        summary: body.summary ?? null,
        changeSetId: body.changeSetId ?? null,
      })

      return rowToTrail(row)
    })

    if (!trail) {
      return NextResponse.json({ success: false, error: 'Trail not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, trail })
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

    await withTransaction(async (tx) => {
      // Snapshot the trail before deletion for the tombstone revision
      const row = await tx.queryOne<TrailRow>(
        `SELECT id, name, difficulty, direction, polyline,
           distance_km, elevation_gain_ft, notes,
           source, source_ride_id, osm_way_id, uploaded_by_email, created_at
         FROM trails WHERE id=$1`,
        [id]
      )

      if (row) {
        await insertRevision({
          tx,
          trailId: row.id,
          userId,
          action: 'delete',
          payload: trailRowToPayload(row),
        })
      }

      await tx.query(`DELETE FROM trails WHERE id=$1`, [id])
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/trails/[id] error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ success: false, error: 'Failed to delete trail' }, { status: 500 })
  }
}
