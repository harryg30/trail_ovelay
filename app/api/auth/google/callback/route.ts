import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { queryOne } from '@/lib/db'
import { encryptSession, SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from '@/lib/session'

interface GoogleTokenResponse {
  access_token: string
  expires_in: number
  refresh_token?: string
  scope: string
  token_type: string
  id_token: string
}

interface GoogleUserProfile {
  sub: string
  name: string
  email: string
  picture?: string
  email_verified: boolean
}

/**
 * Parse and verify a Google ID token JWT (without verification, just parse for this simple case).
 * In production, you should verify the signature using Google's public keys.
 * For now, we do basic validation after confirming token exchange succeeded.
 */
function parseIdToken(idToken: string): GoogleUserProfile | null {
  try {
    const parts = idToken.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())
    return payload as GoogleUserProfile
  } catch {
    return null
  }
}

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = request.nextUrl
  const cookieStore = await cookies()

  if (searchParams.get('error')) {
    return Response.redirect(new URL('/?auth_error=denied', request.url))
  }

  const code = searchParams.get('code')
  const state = searchParams.get('state')

  if (!code || !state) {
    return Response.redirect(new URL('/?auth_error=missing_code', request.url))
  }

  // Verify state parameter against stored cookie
  const storedState = cookieStore.get('google_oauth_state')?.value
  if (!storedState || storedState !== state) {
    console.error('Google OAuth state mismatch')
    return Response.redirect(new URL('/?auth_error=state_mismatch', request.url))
  }

  try {
    // Exchange authorization code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`,
      }),
    })

    if (!tokenRes.ok) {
      console.error('Google token exchange failed:', await tokenRes.text())
      return Response.redirect(new URL('/?auth_error=token_exchange', request.url))
    }

    const tokenData: GoogleTokenResponse = await tokenRes.json()
    const { id_token } = tokenData

    // Parse the ID token to extract user profile
    const profile = parseIdToken(id_token)
    if (!profile) {
      console.error('Failed to parse Google ID token')
      return Response.redirect(new URL('/?auth_error=invalid_token', request.url))
    }

    // Upsert user by google_sub
    const row = await queryOne<{ id: string }>(
      `INSERT INTO users (google_sub, name, email, profile_picture, provider, strava_athlete_id, access_token, refresh_token, token_expires_at)
       VALUES ($1, $2, $3, $4, 'google', NULL, $5, $6, to_timestamp($7))
       ON CONFLICT (google_sub) DO UPDATE SET
         name = EXCLUDED.name,
         email = EXCLUDED.email,
         profile_picture = EXCLUDED.profile_picture,
         access_token = EXCLUDED.access_token,
         refresh_token = EXCLUDED.refresh_token,
         token_expires_at = EXCLUDED.token_expires_at,
         updated_at = now()
       RETURNING id`,
      [
        profile.sub,
        profile.name,
        profile.email,
        profile.picture || null,
        tokenData.access_token,
        tokenData.refresh_token || null,
        Math.floor(Date.now() / 1000) + tokenData.expires_in,
      ]
    )

    if (!row) {
      return Response.redirect(new URL('/?auth_error=db', request.url))
    }

    // Issue session cookie with provider='google'
    const token = await encryptSession({ userId: row.id, provider: 'google' })
    cookieStore.set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS)

    // Clear the OAuth state cookie
    cookieStore.set('google_oauth_state', '', { maxAge: 0 })

    return Response.redirect(new URL('/', request.url))
  } catch (err) {
    console.error('Google callback error:', err)
    return Response.redirect(new URL('/?auth_error=server', request.url))
  }
}
