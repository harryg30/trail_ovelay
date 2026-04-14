// Runs at document_start in MAIN world — before any page scripts.
// Intercepts window.mapboxgl being set by Strava, then wraps Map constructor
// to capture the latest map instance at window._trailOverlayMap (fallback when vv_map is absent).
;(function () {
  function patchMapbox(mapboxgl) {
    if (!mapboxgl || !mapboxgl.Map || mapboxgl._trailOverlayPatched) return
    mapboxgl._trailOverlayPatched = true

    const OrigMap = mapboxgl.Map
    function PatchedMap(...args) {
      const instance = new OrigMap(...args)
      window._trailOverlayMap = instance
      return instance
    }
    PatchedMap.prototype = OrigMap.prototype
    Object.setPrototypeOf(PatchedMap, OrigMap)
    for (const key of Object.getOwnPropertyNames(OrigMap)) {
      if (key === 'prototype' || key === 'length' || key === 'name') continue
      try {
        Object.defineProperty(PatchedMap, key, Object.getOwnPropertyDescriptor(OrigMap, key))
      } catch (_) {}
    }
    mapboxgl.Map = PatchedMap
  }

  if (window.mapboxgl) {
    patchMapbox(window.mapboxgl)
    return
  }

  let _mapboxgl
  Object.defineProperty(window, 'mapboxgl', {
    configurable: true,
    enumerable: true,
    get () { return _mapboxgl },
    set (val) {
      _mapboxgl = val
      patchMapbox(val)
      // Restore as a plain writable property
      Object.defineProperty(window, 'mapboxgl', {
        configurable: true, enumerable: true, writable: true, value: val,
      })
    },
  })
})()
