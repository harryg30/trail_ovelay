import { NextRequest, NextResponse } from 'next/server'
import { queryOne } from '@/lib/db'
import { getSessionUserId, getUserIdFromBearerToken } from '@/lib/auth'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  let userId = await getSessionUserId()
  if (!userId) userId = await getUserIdFromBearerToken(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS })
  }

  const { id } = await params
  const { value } = await request.json()

  if (value !== 1 && value !== -1) {
    return NextResponse.json({ error: 'value must be 1 or -1' }, { status: 400, headers: CORS_HEADERS })
  }

  await queryOne(
    `INSERT INTO photo_votes (photo_id, user_id, value)
     VALUES ($1, $2, $3)
     ON CONFLICT (photo_id, user_id) DO UPDATE SET value = EXCLUDED.value`,
    [id, userId, value]
  )

  const row = await queryOne<{ score: string }>(
    `SELECT COALESCE(SUM(value), 0) AS score FROM photo_votes WHERE photo_id = $1`,
    [id]
  )

  return NextResponse.json({ success: true, score: Number(row?.score ?? 0) }, { headers: CORS_HEADERS })
}
