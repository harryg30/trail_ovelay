import { NextRequest, NextResponse } from 'next/server'
import { queryOne } from '@/lib/db'
import { getSessionUserId, getUserIdFromBearerToken } from '@/lib/auth'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

async function resolveUserId(request: NextRequest): Promise<string | null> {
  const userId = await getSessionUserId()
  if (userId) return userId
  return getUserIdFromBearerToken(request)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const userId = await resolveUserId(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS })
  }

  const { id } = await params
  const { pinLat, pinLon } = await request.json()

  const row = await queryOne<{ id: string }>(
    `UPDATE trail_photos SET pin_lat = $1, pin_lon = $2
     WHERE id = $3 AND uploaded_by_user_id = $4
     RETURNING id`,
    [pinLat ?? null, pinLon ?? null, id, userId]
  )

  if (!row) {
    return NextResponse.json({ error: 'Not found or forbidden' }, { status: 404, headers: CORS_HEADERS })
  }

  return NextResponse.json({ success: true }, { headers: CORS_HEADERS })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const userId = await resolveUserId(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS })
  }

  const { id } = await params

  const row = await queryOne<{ id: string }>(
    `DELETE FROM trail_photos WHERE id = $1 AND uploaded_by_user_id = $2 RETURNING id`,
    [id, userId]
  )

  if (!row) {
    return NextResponse.json({ error: 'Not found or forbidden' }, { status: 404, headers: CORS_HEADERS })
  }

  return NextResponse.json({ success: true }, { headers: CORS_HEADERS })
}
