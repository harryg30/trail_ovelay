import { getSessionUser } from '@/lib/auth'
import { queryOne } from '@/lib/db'
import { rowToTrail } from '@/lib/api/mappers'
import ClientPage from '@/app/ClientPage'
import type { Trail } from '@/lib/types'
import type { Metadata } from 'next'

type SearchParams = Promise<{
  trail?: string
  tab?: string
  photo?: string
  revision?: string
  lat?: string
  lng?: string
  zoom?: string
}>

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const params = await searchParams
  const trailId = params.trail ?? null
  if (!trailId) return { title: 'Trail Overlay' }
  const row = await queryOne('SELECT name FROM trails WHERE id = $1', [trailId])
  return { title: row ? `${row.name} — Trail Overlay` : 'Trail Overlay' }
}

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const user = await getSessionUser()

  // Pre-fetch trail server-side so the detail panel opens immediately without a client waterfall
  let initialTrail: Trail | null = null
  const trailId = params.trail ?? null
  if (trailId) {
    const row = await queryOne(
      `SELECT id, name, difficulty, direction, polyline, distance_km,
              elevation_gain_ft, notes, source, source_ride_id, osm_way_id,
              uploaded_by_email, created_at
       FROM trails WHERE id = $1`,
      [trailId]
    )
    if (row) initialTrail = rowToTrail(row)
  }

  const initialParams = {
    tab:      params.tab ?? null,
    trailId:  trailId,
    photoId:  params.photo ?? null,
    revision: params.revision ?? null,
    lat:      params.lat  ? parseFloat(params.lat)  : null,
    lng:      params.lng  ? parseFloat(params.lng)  : null,
    zoom:     params.zoom ? parseInt(params.zoom)   : null,
  }

  return <ClientPage user={user} initialTrail={initialTrail} initialParams={initialParams} />
}
