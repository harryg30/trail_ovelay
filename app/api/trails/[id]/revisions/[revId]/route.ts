/**
 * GET /api/trails/[id]/revisions/[revId]
 *
 * Single revision detail — includes full payload (polyline etc.) for map preview.
 */
import { NextRequest, NextResponse } from 'next/server'
import { queryOne } from '@/lib/db'
import { rowToRevision, type TrailRevisionRow } from '@/lib/api/mappers'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; revId: string }> }
) {
  try {
    const { id, revId } = await params

    const row = await queryOne<TrailRevisionRow>(`
      SELECT
        r.id,
        r.trail_id,
        r.created_at,
        r.created_by_user_id,
        u.name  AS created_by_name,
        r.change_set_id,
        r.parent_revision_id,
        r.action,
        r.summary,
        r.payload
      FROM trail_revisions r
      LEFT JOIN users u ON u.id = r.created_by_user_id
      WHERE r.id = $1 AND r.trail_id = $2
    `, [revId, id])

    if (!row) {
      return NextResponse.json({ success: false, error: 'Revision not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, revision: rowToRevision(row) })
  } catch (error) {
    console.error('GET /api/trails/[id]/revisions/[revId] error:', error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
