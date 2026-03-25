import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getSessionUserId } from '@/lib/auth'
import type { Network } from '@/lib/types'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body: { name?: string; polygon?: [number, number][]; trailIds?: string[] } = await request.json()

    if (body.name !== undefined && !body.name.trim()) {
      return NextResponse.json({ success: false, error: 'Name cannot be empty' }, { status: 400 })
    }

    const hasPolygon = Array.isArray(body.polygon) && body.polygon.length >= 3

    let networkRow: { id: string; name: string; polygon: [number, number][]; created_at: string } | null

    if (body.name !== undefined && hasPolygon) {
      networkRow = await queryOne(`
        UPDATE networks SET name=$1, polygon=$2::jsonb WHERE id=$3
        RETURNING id, name, polygon, created_at
      `, [body.name.trim(), JSON.stringify(body.polygon), id])
    } else if (body.name !== undefined) {
      networkRow = await queryOne(`
        UPDATE networks SET name=$1 WHERE id=$2
        RETURNING id, name, polygon, created_at
      `, [body.name.trim(), id])
    } else if (hasPolygon) {
      networkRow = await queryOne(`
        UPDATE networks SET polygon=$1::jsonb WHERE id=$2
        RETURNING id, name, polygon, created_at
      `, [JSON.stringify(body.polygon), id])
    } else {
      networkRow = await queryOne(`
        SELECT id, name, polygon, created_at FROM networks WHERE id=$1
      `, [id])
    }

    if (!networkRow) {
      return NextResponse.json({ success: false, error: 'Network not found' }, { status: 404 })
    }

    // Update trail associations if provided
    let trailIds: string[] = []
    if (body.trailIds !== undefined) {
      await query(`DELETE FROM network_trails WHERE network_id=$1`, [id])
      for (const trailId of body.trailIds) {
        await query(`INSERT INTO network_trails (network_id, trail_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [id, trailId])
        trailIds.push(trailId)
      }
    } else {
      const rows = await query<{ trail_id: string }>(`SELECT trail_id FROM network_trails WHERE network_id=$1`, [id])
      trailIds = rows.map((r) => r.trail_id)
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
    console.error('PATCH /api/networks/[id] error:', error)
    return NextResponse.json({ success: false, error: 'Failed to update network' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    await query(`DELETE FROM networks WHERE id=$1`, [id])
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/networks/[id] error:', error)
    return NextResponse.json({ success: false, error: 'Failed to delete network' }, { status: 500 })
  }
}
