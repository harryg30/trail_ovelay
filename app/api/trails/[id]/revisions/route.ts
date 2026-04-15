/**
 * GET /api/trails/[id]/revisions
 *
 * List all revisions for a trail, newest first.
 *
 * Query params:
 *   limit   - max rows (default 50, max 200)
 *   offset  - pagination offset (default 0)
 */
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { rowToRevision, type TrailRevisionRow } from '@/lib/api/mappers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const sp = request.nextUrl.searchParams
    const limit = Math.min(Number(sp.get('limit') ?? 50), 200)
    const offset = Math.max(Number(sp.get('offset') ?? 0), 0)

    const rows = await query<TrailRevisionRow>(`
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
      WHERE r.trail_id = $1
      ORDER BY r.created_at DESC
      LIMIT $2 OFFSET $3
    `, [id, limit, offset])

    return NextResponse.json({ success: true, revisions: rows.map(rowToRevision) })
  } catch (error) {
    console.error('GET /api/trails/[id]/revisions error:', error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
