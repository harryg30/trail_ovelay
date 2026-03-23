import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import type { Trail } from '@/lib/types'

export async function GET() {
  try {
    const rows = await query<{
      id: string
      name: string
      difficulty: Trail['difficulty']
      direction: Trail['direction']
      polyline: [number, number][]
      distance_km: number
      elevation_gain_ft: number
      notes: string | null
      source: string
      source_ride_id: string | null
      uploaded_by_email: string | null
      created_at: string
    }>(`
      SELECT
        id,
        name,
        difficulty,
        direction,
        polyline,
        distance_km,
        elevation_gain_ft,
        notes,
        source,
        source_ride_id,
        uploaded_by_email,
        created_at
      FROM trails
      ORDER BY created_at DESC
    `)

    const trails: Trail[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      difficulty: row.difficulty,
      direction: row.direction,
      polyline: row.polyline,
      distanceKm: row.distance_km,
      elevationGainFt: row.elevation_gain_ft,
      notes: row.notes ?? undefined,
      source: row.source,
      sourceRideId: row.source_ride_id ?? undefined,
      uploadedByEmail: row.uploaded_by_email ?? undefined,
      createdAt: new Date(row.created_at),
    }))

    return NextResponse.json({ success: true, trails })
  } catch (error) {
    console.error('GET /api/trails error:', error)
    return NextResponse.json({ success: true, trails: [] })
  }
}
