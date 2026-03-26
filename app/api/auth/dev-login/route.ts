import { cookies } from 'next/headers'
import { queryOne } from '@/lib/db'
import { encryptSession, SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from '@/lib/session'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest): Promise<Response> {
  if (process.env.NODE_ENV !== 'development') {
    return new Response('Not found', { status: 404 })
  }

  const row = await queryOne<{ id: string; name: string }>(
    `SELECT id, name FROM users ORDER BY created_at LIMIT 1`
  )

  if (!row) {
    return new Response('No users in database', { status: 404 })
  }

  const token = await encryptSession({ userId: row.id })
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS)

  return Response.redirect(new URL('/', request.url))
}
