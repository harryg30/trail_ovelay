export async function GET(): Promise<Response> {
  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/strava/callback`,
    response_type: 'code',
    scope: 'read,activity:read_all',
    approval_prompt: 'force',
  })
  return Response.redirect(
    `https://www.strava.com/oauth/authorize?${params.toString()}`
  )
}
