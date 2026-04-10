import { NextRequest } from 'next/server'

/**
 * Base URL Strava will redirect to after authorization.
 * Uses the incoming request origin so local dev works even when
 * `NEXT_PUBLIC_APP_URL` points at production (e.g. for db:pull-prod).
 * Optional override: `AUTH_PUBLIC_ORIGIN` (no trailing slash), e.g. ngrok URL.
 */
function oauthPublicOrigin(request: NextRequest): string {
  const fromEnv = process.env.AUTH_PUBLIC_ORIGIN?.trim().replace(/\/$/, '')
  if (fromEnv) return fromEnv
  return request.nextUrl.origin
}

export async function GET(request: NextRequest): Promise<Response> {
  const clientId = process.env.STRAVA_CLIENT_ID
  if (!clientId) {
    return new Response('STRAVA_CLIENT_ID is not configured', { status: 500 })
  }

  const redirectUri = `${oauthPublicOrigin(request)}/api/auth/strava/callback`
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'read,activity:read_all',
    approval_prompt: 'force',
  })
  return Response.redirect(
    `https://www.strava.com/oauth/authorize?${params.toString()}`
  )
}
