import crypto from 'node:crypto'

export async function GET(): Promise<Response> {
  // Generate a random state parameter for CSRF protection
  const state = crypto.randomBytes(32).toString('hex')

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid profile email',
    access_type: 'offline',
    prompt: 'consent',
    state,
  })

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''

  const response = new Response(null, {
    status: 302,
    headers: {
      Location: googleAuthUrl,
      'Set-Cookie': `google_oauth_state=${state}; HttpOnly; Max-Age=600; SameSite=Lax; Path=/api/auth/google/callback${secure}`,
    },
  })

  return response
}
