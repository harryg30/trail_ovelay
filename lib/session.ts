import { EncryptJWT, jwtDecrypt } from 'jose'

export const SESSION_COOKIE_NAME = 'session'

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 30, // 30 days in seconds
}

export type AuthProvider = 'strava' | 'google' | 'dev'

export interface SessionPayload {
  userId: string
  provider?: AuthProvider // Default to 'strava' for backward compatibility
}

function getKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET env var is not set')
  // Accept hex string (openssl rand -hex 32) or raw string
  if (/^[0-9a-f]{64}$/i.test(secret)) {
    const bytes = new Uint8Array(32)
    for (let i = 0; i < 32; i++) {
      bytes[i] = parseInt(secret.slice(i * 2, i * 2 + 2), 16)
    }
    return bytes
  }
  return new TextEncoder().encode(secret).slice(0, 32)
}

export async function encryptSession(payload: SessionPayload): Promise<string> {
  const provider = payload.provider || 'strava'
  return new EncryptJWT({ userId: payload.userId, provider })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .encrypt(getKey())
}

export async function decryptSession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtDecrypt(token, getKey())
    if (typeof payload.userId !== 'string') return null
    const rawProvider = payload.provider
    const provider: AuthProvider =
      rawProvider === 'google' || rawProvider === 'dev' || rawProvider === 'strava'
        ? rawProvider
        : 'strava'
    return { userId: payload.userId, provider }
  } catch {
    return null
  }
}
