/**
 * POST /api/trails/[id]/rollback
 *
 * Restore a trail to the state captured in a specific revision.
 * Inserts a new trail_revisions row (action=rollback) so the forward history
 * is preserved — nothing is deleted.
 *
 * Body: { revisionId: string; summary?: string; changeSetId?: string }
 */
import { NextRequest, NextResponse } from 'next/server'
import { withTransaction, queryOne } from '@/lib/db'
import { getSessionUserId } from '@/lib/auth'
import { rowToTrail, type TrailRow, type TrailRevisionRow } from '@/lib/api/mappers'
import { insertRevision } from '@/lib/api/revisions'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body: { revisionId?: string; summary?: string; changeSetId?: string } = await request.json()

    if (!body.revisionId) {
      return NextResponse.json({ success: false, error: 'revisionId is required' }, { status: 400 })
    }

    // Load the target revision first (outside transaction — read-only)
    const targetRevision = await queryOne<TrailRevisionRow>(`
      SELECT id, trail_id, action, payload
      FROM trail_revisions
      WHERE id = $1 AND trail_id = $2
    `, [body.revisionId, id])

    if (!targetRevision) {
      return NextResponse.json(
        { success: false, error: 'Revision not found for this trail' },
        { status: 404 }
      )
    }

    if (targetRevision.action === 'delete') {
      return NextResponse.json(
        { success: false, error: 'Cannot roll back to a delete revision; the trail no longer exists at that point' },
        { status: 422 }
      )
    }

    const p = targetRevision.payload

    const trail = await withTransaction(async (tx) => {
      const row = await tx.queryOne<TrailRow>(`
        UPDATE trails SET
          name                = $1,
          difficulty          = $2,
          direction           = $3,
          polyline            = $4::jsonb,
          distance_km         = $5,
          elevation_gain_ft   = $6,
          notes               = $7,
          source              = $8,
          source_ride_id      = $9,
          osm_way_id          = $10,
          updated_by_user_id  = $11,
          updated_at          = now()
        WHERE id = $12
        RETURNING id, name, difficulty, direction, polyline,
          distance_km, elevation_gain_ft, notes,
          source, source_ride_id, osm_way_id, uploaded_by_email, created_at
      `, [
        p.name,
        p.difficulty,
        p.direction,
        JSON.stringify(p.polyline),
        p.distanceKm,
        p.elevationGainFt,
        p.notes ?? null,
        p.source,
        p.sourceRideId ?? null,
        p.osmWayId ?? null,
        userId,
        id,
      ])

      if (!row) return null

      await insertRevision({
        tx,
        trailId: row.id,
        userId,
        action: 'rollback',
        payload: p,
        summary: body.summary ?? `Rolled back to revision ${body.revisionId}`,
        changeSetId: body.changeSetId ?? null,
        parentRevisionId: body.revisionId,
      })

      return rowToTrail(row)
    })

    if (!trail) {
      return NextResponse.json({ success: false, error: 'Trail not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, trail })
  } catch (error) {
    console.error('POST /api/trails/[id]/rollback error:', error)
    return NextResponse.json({ success: false, error: 'Failed to roll back trail' }, { status: 500 })
  }
}
