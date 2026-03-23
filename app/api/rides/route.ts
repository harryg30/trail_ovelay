import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getSessionUserId } from '@/lib/auth'
import type { Ride } from '@/lib/types'

export async function GET() {
  const userId = await getSessionUserId()
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const rows = await query<{
      id: string
      name: string
      distance: number
      elevation: number
      polyline: [number, number][]
      point_count: number
      timestamp: string | null
    }>(
      `SELECT id, name, distance, elevation, polyline, point_count, timestamp
       FROM rides
       WHERE user_id = $1
       ORDER BY COALESCE(timestamp, created_at) DESC`,
      [userId]
    )

    const rides: Ride[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      distance: row.distance,
      elevation: row.elevation,
      polyline: row.polyline,
      pointCount: row.point_count,
      timestamp: row.timestamp ? new Date(row.timestamp) : new Date(0),
    }))

    return NextResponse.json({ success: true, rides })
  } catch (error) {
    console.error('GET /api/rides error:', error)
    return NextResponse.json({ success: true, rides: [] })
  }
}
