/**
 * Two-point similarity alignment: image pixels (origin top-left, y down) ↔ WGS84
 * using a local tangent plane at point 1 (good for park-sized maps).
 */

export type LatLng = { lat: number; lon: number }
export type ImagePoint = { x: number; y: number }

export type MapOverlayTransform = {
  kind: 'similarity_two_point'
  imageWidth: number
  imageHeight: number
  p1Img: ImagePoint
  p1Ll: LatLng
  p2Img: ImagePoint
  p2Ll: LatLng
  southWest: [number, number]
  northEast: [number, number]
}

function metersPerDegree(lat: number): { lat: number; lon: number } {
  const rad = (lat * Math.PI) / 180
  const mLat = 111_320
  const mLon = 111_320 * Math.cos(rad)
  return { lat: mLat, lon: Math.max(mLon, 1e-6) }
}

/** Image pixel → lat/lon given two control pairs (same order: p1, p2). */
export function imagePixelToLatLng(
  u: number,
  v: number,
  p1Img: ImagePoint,
  p1Ll: LatLng,
  p2Img: ImagePoint,
  p2Ll: LatLng
): LatLng {
  const m = metersPerDegree(p1Ll.lat)
  const x2 = (p2Ll.lon - p1Ll.lon) * m.lon
  const y2 = (p2Ll.lat - p1Ll.lat) * m.lat

  const du = p2Img.x - p1Img.x
  const dv = p2Img.y - p1Img.y
  const lenImg = Math.hypot(du, dv)
  const lenM = Math.hypot(x2, y2)
  if (lenImg < 1e-3 || lenM < 1e-3) {
    throw new Error('Alignment points are too close; pick two features farther apart')
  }

  const scale = lenM / lenImg
  const angleImg = Math.atan2(-dv, du)
  const angleMap = Math.atan2(y2, x2)
  const theta = angleMap - angleImg

  const rx = u - p1Img.x
  const ry = -(v - p1Img.y)

  const mx = scale * (Math.cos(theta) * rx - Math.sin(theta) * ry)
  const my = scale * (Math.sin(theta) * rx + Math.cos(theta) * ry)

  return {
    lat: p1Ll.lat + my / m.lat,
    lon: p1Ll.lon + mx / m.lon,
  }
}

export function buildMapOverlayTransform(
  imageWidth: number,
  imageHeight: number,
  p1Img: ImagePoint,
  p1Ll: LatLng,
  p2Img: ImagePoint,
  p2Ll: LatLng
): MapOverlayTransform {
  const corners: ImagePoint[] = [
    { x: 0, y: 0 },
    { x: imageWidth, y: 0 },
    { x: imageWidth, y: imageHeight },
    { x: 0, y: imageHeight },
  ]
  let minLat = Infinity
  let maxLat = -Infinity
  let minLon = Infinity
  let maxLon = -Infinity
  for (const c of corners) {
    const ll = imagePixelToLatLng(c.x, c.y, p1Img, p1Ll, p2Img, p2Ll)
    minLat = Math.min(minLat, ll.lat)
    maxLat = Math.max(maxLat, ll.lat)
    minLon = Math.min(minLon, ll.lon)
    maxLon = Math.max(maxLon, ll.lon)
  }

  return {
    kind: 'similarity_two_point',
    imageWidth,
    imageHeight,
    p1Img,
    p1Ll,
    p2Img,
    p2Ll,
    southWest: [minLat, minLon],
    northEast: [maxLat, maxLon],
  }
}
