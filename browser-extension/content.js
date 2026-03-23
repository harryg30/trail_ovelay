// MAIN world, document_idle.
// Strava uses Mapbox GL JS (not Leaflet). Adds trail polylines via addSource/addLayer.
// Coordinates: our DB stores [lat, lng]; Mapbox requires [lng, lat] — we swap below.

const DEFAULT_API_URL = 'https://trail-overlay.vercel.app'
const SOURCE_ID = 'trail-overlay'
const LAYER_ID  = 'trail-overlay-lines'

const DIFFICULTY_COLORS = {
  easy:         '#22c55e',
  intermediate: '#f59e0b',
  hard:         '#ef4444',
  not_set:      '#94a3b8',
}

function difficultyColor(d) {
  return DIFFICULTY_COLORS[d] ?? DIFFICULTY_COLORS.not_set
}

function getApiUrl() {
  return localStorage.getItem('trailOverlayApiUrl') || DEFAULT_API_URL
}

async function fetchTrails(apiUrl) {
  const resp = await fetch(`${apiUrl}/api/trails`)
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const data = await resp.json()
  if (!data.success) throw new Error('API returned success:false')
  return data.trails
}

// Try every known way to get the Mapbox GL map instance.
function tryFindMap() {
  // 1. Captured by content-init.js constructor intercept
  if (window._trailOverlayMap) return window._trailOverlayMap

  // 2. Mapbox GL sets this on the container element (v1/v2)
  const mbContainer = document.querySelector('.mapboxgl-map')
  if (mbContainer?._mapboxgl_map) return mbContainer._mapboxgl_map

  // 3. Strava exposes pageView globally on activity pages
  try {
    const pv = window.pageView
    if (pv) {
      // Try common Strava map accessors
      const m = pv.map?.() || pv.mapContext?.()?.map?.() || pv.activity?.()?.map?.()
      if (m && typeof m.addLayer === 'function') return m
    }
  } catch (_) {}

  // 4. Scan window globals for a Mapbox GL map (has addSource + addLayer + isStyleLoaded)
  for (const key in window) {
    try {
      const v = window[key]
      if (
        v && typeof v === 'object' &&
        typeof v.addSource === 'function' &&
        typeof v.addLayer === 'function' &&
        typeof v.isStyleLoaded === 'function'
      ) {
        console.log('[TrailOverlay] Found map at window.' + key)
        return v
      }
    } catch (_) {}
  }

  return null
}

function waitForMap(timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const m = tryFindMap()
    if (m) return resolve(m)

    const deadline = Date.now() + timeoutMs
    const poll = setInterval(() => {
      const found = tryFindMap()
      if (found) {
        clearInterval(poll)
        resolve(found)
      } else if (Date.now() > deadline) {
        clearInterval(poll)
        // Log what IS on the page to help debug
        console.warn('[TrailOverlay] Timed out. mapboxgl-map el:', document.querySelector('.mapboxgl-map'))
        console.warn('[TrailOverlay] window.mapboxgl:', !!window.mapboxgl)
        console.warn('[TrailOverlay] window.pageView:', !!window.pageView)
        reject(new Error('Timed out waiting for map'))
      }
    }, 250)
  })
}

function waitForStyleLoaded(map) {
  return new Promise(resolve => {
    if (map.isStyleLoaded()) return resolve()
    map.once('style.load', resolve)
  })
}

function trailsToGeoJSON(trails) {
  return {
    type: 'FeatureCollection',
    features: trails.map(trail => ({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        // DB stores [lat, lng] — Mapbox needs [lng, lat]
        coordinates: trail.polyline.map(([lat, lng]) => [lng, lat]),
      },
      properties: {
        name:             trail.name,
        difficulty:       trail.difficulty,
        direction:        trail.direction,
        distanceKm:       trail.distanceKm,
        elevationGainFt:  trail.elevationGainFt,
        notes:            trail.notes || '',
        color:            difficultyColor(trail.difficulty),
      },
    })),
  }
}

function addTrailsToMap(map, trails) {
  // Clean up if re-running (e.g. style reload)
  if (map.getSource(SOURCE_ID)) {
    if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID)
    map.removeSource(SOURCE_ID)
  }

  map.addSource(SOURCE_ID, { type: 'geojson', data: trailsToGeoJSON(trails) })

  map.addLayer({
    id:     LAYER_ID,
    type:   'line',
    source: SOURCE_ID,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint:  {
      'line-color':   ['get', 'color'],
      'line-width':   4,
      'line-opacity': 0.85,
    },
  })

  // Pointer cursor on hover
  map.on('mouseenter', LAYER_ID, () => { map.getCanvas().style.cursor = 'pointer' })
  map.on('mouseleave', LAYER_ID, () => { map.getCanvas().style.cursor = ''        })

  // Popup on click
  map.on('click', LAYER_ID, (e) => {
    const p = e.features[0].properties
    const dir   = p.direction && p.direction !== 'not_set' ? ` · ${p.direction}` : ''
    const notes = p.notes ? `<br><em>${p.notes}</em>` : ''
    const html  =
      `<strong>${p.name}</strong><br>` +
      `${p.difficulty !== 'not_set' ? p.difficulty : 'unrated'} · ` +
      `${Number(p.distanceKm).toFixed(1)} km · ` +
      `${Math.round(p.elevationGainFt)} ft gain` +
      dir + notes

    if (window.mapboxgl) {
      new window.mapboxgl.Popup().setLngLat(e.lngLat).setHTML(html).addTo(map)
    }
  })
}

;(async function main() {
  console.log('[TrailOverlay] Starting')
  try {
    const apiUrl = getApiUrl()
    console.log('[TrailOverlay] API URL:', apiUrl)

    const [trails, map] = await Promise.all([fetchTrails(apiUrl), waitForMap()])
    console.log(`[TrailOverlay] ${trails.length} trails fetched, map:`, map)

    if (trails.length === 0) {
      console.log('[TrailOverlay] No trails in database — nothing to add')
      return
    }

    await waitForStyleLoaded(map)
    addTrailsToMap(map, trails)
    console.log(`[TrailOverlay] ${trails.length} trails added to map`)
  } catch (err) {
    console.error('[TrailOverlay] Error:', err)
  }
})()
