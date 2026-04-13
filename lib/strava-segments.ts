export interface StravaSegmentFeature {
  segmentId: number
  name: string
  distance: number
  avgGrade: number
  climbCategory: number
  elevDifference: number
  polyline: [number, number][]
}

export type StravaActivityType = 'running' | 'riding'

export async function fetchStravaSegments(
  bounds: { south: number; west: number; north: number; east: number },
  activityType: StravaActivityType = 'running',
  signal?: AbortSignal
): Promise<StravaSegmentFeature[]> {
  const sp = new URLSearchParams({
    south: String(bounds.south),
    west: String(bounds.west),
    north: String(bounds.north),
    east: String(bounds.east),
    activity_type: activityType,
  })
  const res = await fetch(`/api/strava/segments?${sp}`, { signal })
  if (!res.ok) {
    if (res.status === 401) throw new Error('Sign in to browse Strava segments')
    throw new Error(`Strava segments error: ${res.status}`)
  }
  const data: Array<{
    id: number
    name: string
    distance: number
    avgGrade: number
    climbCategory: number
    elevDifference: number
    polyline: [number, number][]
  }> = await res.json()

  return data.map((seg) => ({
    segmentId: seg.id,
    name: seg.name,
    distance: seg.distance,
    avgGrade: seg.avgGrade,
    climbCategory: seg.climbCategory,
    elevDifference: seg.elevDifference,
    polyline: seg.polyline,
  }))
}
