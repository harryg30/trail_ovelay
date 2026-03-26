import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth'
import { encryptSession } from '@/lib/session'

export async function GET(): Promise<Response> {
  const userId = await getSessionUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = await encryptSession({ userId })
  return NextResponse.json({ token })
}
