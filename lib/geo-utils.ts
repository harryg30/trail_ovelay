import type { Ride } from "@/lib/types";

// Minimum distance in km from a point to any segment of a polyline
export function pointToPolylineDistanceKm(
  point: [number, number],
  polyline: [number, number][]
): number {
  let min = Infinity;
  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];
    // Project point onto segment a->b (in lat/lon space, close enough for small distances)
    const abLat = b[0] - a[0];
    const abLon = b[1] - a[1];
    const abLen2 = abLat * abLat + abLon * abLon;
    let t = 0;
    if (abLen2 > 0) {
      t = ((point[0] - a[0]) * abLat + (point[1] - a[1]) * abLon) / abLen2;
      t = Math.max(0, Math.min(1, t));
    }
    const nearest: [number, number] = [a[0] + t * abLat, a[1] + t * abLon];
    const d = haversineKm(point, nearest);
    if (d < min) min = d;
  }
  // Fallback for single-point polylines
  if (polyline.length === 1) return haversineKm(point, polyline[0]);
  return min;
}

// Returns the longest contiguous run of points within radiusKm of the reference polyline
export function clipPolylineToCorridor(
  polyline: [number, number][],
  reference: [number, number][],
  radiusKm: number,
  minRunLength = 5
): [number, number][] {
  const inside = polyline.map(
    (pt) => pointToPolylineDistanceKm(pt, reference) <= radiusKm
  );

  // Find all contiguous runs of true values
  let bestStart = -1;
  let bestLen = 0;
  let runStart = -1;

  for (let i = 0; i <= inside.length; i++) {
    if (i < inside.length && inside[i]) {
      if (runStart === -1) runStart = i;
    } else {
      if (runStart !== -1) {
        const len = i - runStart;
        if (len > bestLen) {
          bestLen = len;
          bestStart = runStart;
        }
        runStart = -1;
      }
    }
  }

  if (bestLen < minRunLength) return [];
  return polyline.slice(bestStart, bestStart + bestLen);
}

// Shifts each reference point toward the local mean of nearby ride points.
// Returns null if fewer than minRides have data in the corridor.
export function generateAveragedTrail(
  trimPolyline: [number, number][],
  rides: Ride[],
  corridorRadiusKm = 0.025,
  minRides = 2,
  outputSpacingKm = 0.010,
  maxRides = 25
): { polyline: [number, number][]; rideCount: number } | null {
  // Clip each ride to the corridor and tag points with rideId
  const clipped: { rideId: string; points: [number, number][] }[] = [];
  for (const ride of rides) {
    if (clipped.length >= maxRides) break;
    const clip = clipPolylineToCorridor(
      ride.polyline,
      trimPolyline,
      corridorRadiusKm
    );
    const dense = resamplePolyline(clip, 0.010)
    if (dense.length >= 5) clipped.push({ rideId: ride.id, points: dense });
  }

  if (clipped.length < minRides) return null;
  const rideCount = clipped.length;

  // Pool all clipped points tagged by rideId
  const pool: { point: [number, number]; rideId: string }[] = clipped.flatMap(
    (c) => c.points.map((p) => ({ point: p, rideId: c.rideId }))
  );

  // For each reference point, find nearby pool points and compute mean-of-means
  const refPolyline = resamplePolyline(trimPolyline, outputSpacingKm)
  const result: [number, number][] = refPolyline.map((refPt) => {
    const nearby = pool.filter(
      (p) => haversineKm(p.point, refPt) < corridorRadiusKm
    );

    const rideIds = new Set(nearby.map((p) => p.rideId));
    if (rideIds.size < 2) return refPt;

    // Mean-of-means: average per-ride centroids so each ride has equal weight
    const rideCentroids: [number, number][] = Array.from(rideIds).map((id) => {
      const pts = nearby.filter((p) => p.rideId === id).map((p) => p.point);
      const lat = pts.reduce((s, p) => s + p[0], 0) / pts.length;
      const lon = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      return [lat, lon];
    });

    const lat =
      rideCentroids.reduce((s, p) => s + p[0], 0) / rideCentroids.length;
    const lon =
      rideCentroids.reduce((s, p) => s + p[1], 0) / rideCentroids.length;
    return [lat, lon];
  });

  return { polyline: result, rideCount };
}

// Linearly interpolate a polyline so consecutive points are at most `spacingKm` apart.
export function resamplePolyline(
  polyline: [number, number][],
  spacingKm: number
): [number, number][] {
  if (polyline.length < 2) return polyline
  const out: [number, number][] = [polyline[0]]
  for (let i = 1; i < polyline.length; i++) {
    const a = out[out.length - 1]
    const b = polyline[i]
    const d = haversineKm(a, b)
    const steps = Math.floor(d / spacingKm)
    for (let s = 1; s <= steps; s++) {
      const t = (s * spacingKm) / d
      out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])])
    }
    out.push(b)
  }
  return out
}

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

export function estimatedElevationGainFt(
  ride: Ride,
  startIdx: number,
  endIdx: number
): number {
  if (ride.pointCount <= 1) return 0;
  const fraction = (endIdx - startIdx) / ride.pointCount;
  return fraction * ride.elevation;
}
