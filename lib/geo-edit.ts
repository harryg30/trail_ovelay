import { haversineKm } from '@/lib/geo-utils'

export type LatLng = [number, number]

export interface PolylineMidpoint {
  /** Insert the midpoint after this vertex index. Segment is points[indexBefore] -> points[indexBefore+1]. */
  indexBefore: number
  latlng: LatLng
}

export interface NearestSegmentResult {
  indexBefore: number
  projectedLatLng: LatLng
  distanceKm: number
}

export function polylineMidpoints(points: LatLng[]): PolylineMidpoint[] {
  const out: PolylineMidpoint[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    out.push({
      indexBefore: i,
      latlng: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
    })
  }
  return out
}

export function insertPointAfter(points: LatLng[], indexBefore: number, latlng: LatLng): LatLng[] {
  const idx = Math.max(-1, Math.min(points.length - 1, indexBefore))
  return [...points.slice(0, idx + 1), latlng, ...points.slice(idx + 1)]
}

export function removePointAt(points: LatLng[], index: number): LatLng[] {
  if (index < 0 || index >= points.length) return points
  return [...points.slice(0, index), ...points.slice(index + 1)]
}

function projectPointToSegmentLatLonSpace(p: LatLng, a: LatLng, b: LatLng): LatLng {
  const abLat = b[0] - a[0]
  const abLon = b[1] - a[1]
  const abLen2 = abLat * abLat + abLon * abLon
  let t = 0
  if (abLen2 > 0) {
    t = ((p[0] - a[0]) * abLat + (p[1] - a[1]) * abLon) / abLen2
    t = Math.max(0, Math.min(1, t))
  }
  return [a[0] + t * abLat, a[1] + t * abLon]
}

export function nearestPolylineSegment(points: LatLng[], click: LatLng): NearestSegmentResult | null {
  if (points.length < 2) return null

  let best: NearestSegmentResult | null = null
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const projectedLatLng = projectPointToSegmentLatLonSpace(click, a, b)
    const distanceKm = haversineKm(click, projectedLatLng)
    if (!best || distanceKm < best.distanceKm) {
      best = { indexBefore: i, projectedLatLng, distanceKm }
    }
  }
  return best
}

