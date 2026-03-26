import { cookies } from 'next/headers'
import { type NextRequest } from 'next/server'
import { queryOne } from '@/lib/db'
import { SESSION_COOKIE_NAME, decryptSession } from '@/lib/session'

export interface SessionUser {
  id: string
  name: string
  profilePicture: string | null
  stravaAthleteId: number
}

export async function getUserIdFromBearerToken(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)
  const payload = await decryptSession(token)
  return payload?.userId ?? null
}

export async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null
  const payload = await decryptSession(token)
  return payload?.userId ?? null
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const userId = await getSessionUserId()
  if (!userId) return null

  const row = await queryOne<{
    id: string
    name: string
    profile_picture: string | null
    strava_athlete_id: number
  }>(
    `SELECT id, name, profile_picture, strava_athlete_id FROM users WHERE id = $1`,
    [userId]
  )

  if (!row) return null

  return {
    id: row.id,
    name: row.name,
    profilePicture: row.profile_picture,
    stravaAthleteId: row.strava_athlete_id,
  }
}
