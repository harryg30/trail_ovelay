import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getSessionUserId } from '@/lib/auth'
import type { Network } from '@/lib/types'
import { rowToNetwork, type NetworkRow } from '@/lib/api/mappers'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET() {
  try {
    const rows = await query<NetworkRow>(`
      SELECT
        n.id,
        n.name,
        n.polygon,
        n.created_at,
        array_agg(nt.trail_id) FILTER (WHERE nt.trail_id IS NOT NULL) AS trail_ids,
        COALESCE(BOOL_OR(mo.id IS NOT NULL), false) AS has_official_map,
        COALESCE(BOOL_OR(mo.transform IS NOT NULL), false) AS official_map_aligned
      FROM networks n
      LEFT JOIN network_trails nt ON nt.network_id = n.id
      LEFT JOIN map_overlays mo ON mo.network_id = n.id
      GROUP BY n.id
      ORDER BY n.created_at DESC
    `)

    return NextResponse.json({ success: true, networks: rows.map(rowToNetwork) }, { headers: CORS_HEADERS })
  } catch (error) {
    console.error('GET /api/networks error:', error)
    return NextResponse.json({ success: false, error: String(error), networks: [] }, { status: 500, headers: CORS_HEADERS })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getSessionUserId()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body: { name: string; polygon: [number, number][]; trailIds: string[] } = await request.json()

    if (!body.name?.trim()) {
      return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 })
    }
    if (!Array.isArray(body.polygon) || body.polygon.length < 3) {
      return NextResponse.json({ success: false, error: 'Polygon must have at least 3 points' }, { status: 400 })
    }

    const networkRow = await queryOne<{ id: string; name: string; polygon: [number, number][]; created_at: string }>(`
      INSERT INTO networks (name, polygon) VALUES ($1, $2::jsonb)
      RETURNING id, name, polygon, created_at
    `, [body.name.trim(), JSON.stringify(body.polygon)])

    if (!networkRow) {
      return NextResponse.json({ success: false, error: 'Failed to create network' }, { status: 500 })
    }

    const trailIds: string[] = []
    if (body.trailIds?.length) {
      for (const trailId of body.trailIds) {
        await query(`INSERT INTO network_trails (network_id, trail_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [networkRow.id, trailId])
        trailIds.push(trailId)
      }
    }

    const network: Network = {
      id: networkRow.id,
      name: networkRow.name,
      polygon: networkRow.polygon,
      trailIds,
      createdAt: new Date(networkRow.created_at),
    }

    return NextResponse.json({ success: true, network })
  } catch (error) {
    console.error('POST /api/networks error:', error)
    return NextResponse.json({ success: false, error: 'Failed to save network' }, { status: 500 })
  }
}
