import { cookies } from 'next/headers'
import { queryOne } from '@/lib/db'
import { SESSION_COOKIE_NAME, decryptSession, AuthProvider } from '@/lib/session'

export interface SessionUser {
  id: string
  name: string
  profilePicture: string | null
  stravaAthleteId: number | null
  provider: AuthProvider
}

export interface UserCapabilities {
  canPublishAssets: boolean // Any authenticated user
  canCommentAssets: boolean // Any authenticated user
  canUploadGpx: boolean // Any authenticated user
  canUseStrava: boolean // Only Strava-authenticated users
}

/**
 * Derives user capabilities from their authentication provider.
 * Any authenticated user can publish/comment/upload GPX.
 * Only Strava-authenticated users can use Strava features.
 */
export function deriveCapabilities(provider: AuthProvider): UserCapabilities {
  return {
    canPublishAssets: true,
    canCommentAssets: true,
    canUploadGpx: true,
    canUseStrava: provider === 'strava',
  }
}

export async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null
  const payload = await decryptSession(token)
  return payload?.userId ?? null
}

/**
 * Get the authenticated user's provider from the session JWT.
 * Falls back to deriving from user data if provider isn't in the JWT.
 */
export async function getSessionProvider(): Promise<AuthProvider | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null

  const payload = await decryptSession(token)
  if (!payload?.userId) return null

  // If provider is in the JWT, use it
  if (payload.provider) return payload.provider

  // Fallback: derive from user's strava_athlete_id
  const user = await getSessionUser()
  return user?.provider ?? null
}

/**
 * Get the authenticated user's capabilities based on their auth provider.
 */
export async function getSessionCapabilities(): Promise<UserCapabilities | null> {
  const provider = await getSessionProvider()
  if (!provider) return null
  return deriveCapabilities(provider)
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const userId = await getSessionUserId()
  if (!userId) return null

  const row = await queryOne<{
    id: string
    name: string
    profile_picture: string | null
    strava_athlete_id: number | null
  }>(
    `SELECT id, name, profile_picture, strava_athlete_id FROM users WHERE id = $1`,
    [userId]
  )

  if (!row) return null

  // Derive provider from available fields (strava_athlete_id presence)
  // After Phase 2 adds a 'provider' column, read directly from DB
  const isStravaUser = row.strava_athlete_id !== null
  const provider: AuthProvider = isStravaUser ? 'strava' : 'google'

  return {
    id: row.id,
    name: row.name,
    profilePicture: row.profile_picture,
    stravaAthleteId: row.strava_athlete_id,
    provider,
  }
}
