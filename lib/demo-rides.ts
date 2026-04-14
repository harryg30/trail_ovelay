/**
 * Demo rides for unauthenticated users.
 *
 * To add demo rides:
 * 1. Drop real .gpx files into public/demo-rides/
 * 2. Add their filenames to DEMO_RIDE_FILES below
 *
 * Rides are fetched and parsed client-side on first load for unauthed users.
 */

import type { Ride } from '@/lib/types'

// List the filenames of GPX files in public/demo-rides/
const DEMO_RIDE_FILES: string[] = [
  // e.g. 'lower-loop.gpx',
  // e.g. 'upper-ridge.gpx',
]

export async function loadDemoRides(): Promise<Ride[]> {
  if (DEMO_RIDE_FILES.length === 0) return []

  const results = await Promise.allSettled(
    DEMO_RIDE_FILES.map((filename, index) =>
      fetchAndParseGpx(`/demo-rides/${filename}`, index)
    )
  )

  return results
    .filter((r): r is PromiseFulfilledResult<Ride> => r.status === 'fulfilled')
    .map((r) => r.value)
}

async function fetchAndParseGpx(url: string, index: number): Promise<Ride> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load demo ride: ${url}`)
  const text = await res.text()

  // Dynamically import gpxparser (it's already a dependency)
  const GPXParser = (await import('gpxparser')).default
  const gpx = new GPXParser()
  gpx.parse(text)

  const track = gpx.tracks[0]
  const points: unknown[] = track?.points ?? []
  const polyline: [number, number][] = points
    .map((p) => {
      const lat = (p as { lat?: unknown })?.lat
      const lon = (p as { lon?: unknown })?.lon
      return typeof lat === 'number' && typeof lon === 'number' ? ([lat, lon] as const) : null
    })
    .filter((x): x is [number, number] => x != null)

  return {
    id: `demo-${index + 1}`,
    name: track?.name || url.split('/').pop()?.replace(/\.gpx$/i, '') || `Demo Ride ${index + 1}`,
    distance: track?.distance?.total ?? 0,
    elevation: track?.elevation?.pos ?? 0,
    polyline,
    timestamp:
      typeof (points[0] as { time?: unknown } | undefined)?.time === 'string'
        ? new Date((points[0] as { time: string }).time)
        : new Date(),
    pointCount: polyline.length,
  }
}
