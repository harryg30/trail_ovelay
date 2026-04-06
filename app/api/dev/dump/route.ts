import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(request: Request) {
  const secret = process.env.DEV_DUMP_SECRET
  const provided = request.headers.get('x-dev-dump-secret')
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [trails, networks, networkTrails] = await Promise.all([
    query('SELECT * FROM trails ORDER BY created_at'),
    query('SELECT * FROM networks ORDER BY created_at'),
    query('SELECT * FROM network_trails'),
  ])

  return NextResponse.json({ trails, networks, networkTrails })
}
