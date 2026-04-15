/**
 * GET /api/trails/activity
 *
 * Activity feed: recent trail_revisions newest-first.
 *
 * Query params:
 *   limit   - max rows (default 50, max 200)
 *   offset  - pagination offset (default 0)
 *
 * No auth required (public feed of public trail data).
 */
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { rowToActivityItem, type TrailActivityRow } from '@/lib/api/mappers'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const limit = Math.min(Number(sp.get('limit') ?? 50), 200)
    const offset = Math.max(Number(sp.get('offset') ?? 0), 0)

    const rows = await query<TrailActivityRow>(`
      SELECT
        r.id              AS revision_id,
        r.trail_id,
        -- Use payload name so deleted-trail names are still visible
        r.payload->>'name' AS trail_name,
        r.action,
        r.summary,
        r.change_set_id,
        cs.comment        AS change_set_comment,
        r.created_at,
        r.created_by_user_id,
        u.name            AS created_by_name
      FROM trail_revisions r
      LEFT JOIN trail_change_sets cs ON cs.id = r.change_set_id
      LEFT JOIN users u ON u.id = r.created_by_user_id
      ORDER BY r.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset])

    return NextResponse.json(
      { success: true, activity: rows.map(rowToActivityItem) },
      { headers: CORS_HEADERS }
    )
  } catch (error) {
    console.error('GET /api/trails/activity error:', error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}
