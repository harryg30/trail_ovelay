import type { Ride } from "@/lib/types";

export function haversineKm(
  a: [number, number],
  b: [number, number]
): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const lat1 = (a[0] * Math.PI) / 180;
  const lat2 = (b[0] * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function polylineDistanceKm(points: [number, number][]): number {
  return points
    .slice(1)
    .reduce((sum, p, i) => sum + haversineKm(points[i], p), 0);
}

export function snapToNearestTrail(
  point: [number, number],
  trails: { id: string; polyline: [number, number][] }[],
  thresholdKm = 0.05
): { trailId: string; lat: number; lon: number } | null {
  let bestDist = Infinity
  let bestResult: { trailId: string; lat: number; lon: number } | null = null

  for (const trail of trails) {
    for (const [lat, lon] of trail.polyline) {
      const d = haversineKm(point, [lat, lon])
      if (d < bestDist) {
        bestDist = d
        bestResult = { trailId: trail.id, lat, lon }
      }
    }
  }

  return bestDist <= thresholdKm ? bestResult : null
}

export function estimatedElevationGainFt(
  ride: Ride,
  startIdx: number,
  endIdx: number
): number {
  if (ride.pointCount <= 1) return 0;
  const fraction = (endIdx - startIdx) / ride.pointCount;
  return fraction * ride.elevation;
}
