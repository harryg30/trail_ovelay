/**
 * GET /api/trails/[id]/comments  — list comments for a trail (newest last)
 * POST /api/trails/[id]/comments — create a comment (auth required)
 */
import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getSessionUserId } from '@/lib/auth'
import type { TrailRevisionComment } from '@/lib/types'

type CommentRow = {
  id: string
  trail_id: string
  revision_id: string | null
  author_user_id: string
  author_name: string | null
  body: string
  created_at: string
}

function rowToComment(row: CommentRow): TrailRevisionComment {
  return {
    id: row.id,
    trailId: row.trail_id,
    revisionId: row.revision_id ?? undefined,
    authorUserId: row.author_user_id,
    authorName: row.author_name ?? undefined,
    body: row.body,
    createdAt: new Date(row.created_at),
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const rows = await query<CommentRow>(`
      SELECT
        c.id,
        c.trail_id,
        c.revision_id,
        c.author_user_id,
        u.name AS author_name,
        c.body,
        c.created_at
      FROM trail_revision_comments c
      LEFT JOIN users u ON u.id = c.author_user_id
      WHERE c.trail_id = $1
      ORDER BY c.created_at ASC
    `, [id])

    return NextResponse.json({ success: true, comments: rows.map(rowToComment) })
  } catch (error) {
    console.error('GET /api/trails/[id]/comments error:', error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}

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
    const body: { body?: string; revisionId?: string } = await request.json()

    if (!body.body?.trim()) {
      return NextResponse.json({ success: false, error: 'Comment body is required' }, { status: 400 })
    }

    const row = await queryOne<CommentRow>(`
      INSERT INTO trail_revision_comments (id, trail_id, revision_id, author_user_id, body)
      VALUES (gen_random_uuid(), $1, $2, $3, $4)
      RETURNING
        id,
        trail_id,
        revision_id,
        author_user_id,
        (SELECT name FROM users WHERE id = $3) AS author_name,
        body,
        created_at
    `, [id, body.revisionId ?? null, userId, body.body.trim()])

    if (!row) {
      return NextResponse.json({ success: false, error: 'Insert failed' }, { status: 500 })
    }

    return NextResponse.json({ success: true, comment: rowToComment(row) }, { status: 201 })
  } catch (error) {
    console.error('POST /api/trails/[id]/comments error:', error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
