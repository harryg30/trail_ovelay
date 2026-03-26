import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getSessionUserId } from '@/lib/auth'
import { rowToRide } from '@/lib/api/mappers'

export async function GET() {
  const userId = await getSessionUserId()
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const rows = await query(
      `SELECT id, name, distance, elevation, polyline, point_count, timestamp, strava_activity_id
       FROM rides
       WHERE user_id = $1
       ORDER BY COALESCE(timestamp, created_at) DESC`,
      [userId]
    )

    const rides = rows.map(rowToRide)

    return NextResponse.json({ success: true, rides })
  } catch (error) {
    console.error('GET /api/rides error:', error)
    return NextResponse.json({ success: false, error: 'Failed to load rides' }, { status: 500 })
  }
}
