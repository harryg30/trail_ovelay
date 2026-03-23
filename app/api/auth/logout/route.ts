import { cookies } from 'next/headers'
import { SESSION_COOKIE_NAME } from '@/lib/session'

export async function POST(): Promise<Response> {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, '', { maxAge: 0, path: '/' })
  return Response.json({ success: true })
}
