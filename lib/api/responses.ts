import { NextResponse } from 'next/server'

/**
 * Standard error response shape: { success: false, error: string }
 *
 * NOTE: Do NOT change the public response shape for /api/trails and /api/networks
 * (e.g. adding/removing the top-level `trails` or `networks` key). The browser
 * extension reads these fields directly.
 */
export function apiError(message: string, status: number): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status })
}

/**
 * Standard success response shape: { success: true, ...data }
 * Pass optional headers (e.g. CORS) as the second argument.
 */
export function apiSuccess<T extends Record<string, unknown>>(
  data: T,
  headers?: Record<string, string>
): NextResponse {
  return NextResponse.json({ success: true, ...data }, { headers })
}
