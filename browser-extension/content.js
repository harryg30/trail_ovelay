// MAIN world, document_idle.
// Strava uses Mapbox GL JS (not Leaflet). Adds trail polylines via addSource/addLayer.
// Coordinates: DB stores [lat, lng]; Mapbox requires [lng, lat].

const DEFAULT_API_URL = "http://localhost:3000";
const SOURCE_ID = "trail-overlay";
const LAYER_ID = "trail-overlay-lines";
/** Wider stroke under main line when `bookmarked` feature-state is true (color from extension settings). */
const LAYER_ID_BOOKMARK_HALO = "trail-overlay-lines-bookmark-halo";

const NETWORK_SOURCE_ID = "network-overlay";
const NETWORK_FILL_LAYER = "network-overlay-fill";
const NETWORK_BORDER_LAYER = "network-overlay-border";
const NETWORK_LABEL_LAYER = "network-overlay-label";

/** Unified bottom-right panel: viewport trail list + divider + bookmark stack (inside `.mapboxgl-map`). */
const TRAIL_SONNER_PANEL_ID = "trail-overlay-sonner-panel";
/** Bumps when panel DOM/CSS structure changes so stale roots are recreated. */
const TRAIL_SONNER_PANEL_LAYOUT = "v2-bottom-up-tabs";
/** Negative margin between bookmark cards (min card ~52px → ~14px sliver of tab behind). */
const BOOKMARK_CARD_OVERLAP_PX = 38;
/** Max trails listed in the scroll region (overflow summarized). */
const TRAIL_SONNER_LIST_MAX = 200;
/** Single z-index for the unified panel (below centered trail modal). */
const TRAIL_PANEL_Z = 10040;
/** Centered trail detail modal over the map (above the trail panel). */
const TRAIL_INFO_DRAWER_Z = 10050;
const TRAIL_INFO_DRAWER_ID = "trail-overlay-trail-info-drawer";

/** Main trail line: difficulty color; thick when hovered / detail modal open. */
const TRAIL_LINE_PAINT = {
  "line-color": ["get", "color"],
  "line-width": [
    "case",
    ["boolean", ["feature-state", "highlight"], false],
    10,
    4
  ],
  "line-opacity": [
    "case",
    ["boolean", ["feature-state", "highlight"], false],
    1,
    0.85
  ]
};

const BOOKMARK_HALO_PRESET_HEX = {
  yellow: "#e6c619",
  red: "#ef4444",
  blue: "#3b82f6",
  green: "#22c55e"
};
const DEFAULT_BOOKMARK_HALO_HEX = BOOKMARK_HALO_PRESET_HEX.yellow;

function parseUserHexColor(s) {
  const t = String(s ?? "").trim();
  if (!t.startsWith("#")) return null;
  const h = t.slice(1);
  if (/^[0-9a-f]{6}$/i.test(h)) return `#${h.toLowerCase()}`;
  if (/^[0-9a-f]{3}$/i.test(h)) {
    const a = h[0].toLowerCase();
    const b = h[1].toLowerCase();
    const c = h[2].toLowerCase();
    return `#${a}${a}${b}${b}${c}${c}`;
  }
  return null;
}

/** Preset name or `#rrggbb` / `#rgb` from extension popup → Mapbox line color. */
function resolveBookmarkHaloLineColor(raw) {
  const key = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (BOOKMARK_HALO_PRESET_HEX[key]) return BOOKMARK_HALO_PRESET_HEX[key];
  return parseUserHexColor(key) || DEFAULT_BOOKMARK_HALO_HEX;
}

function buildBookmarkHaloPaint(lineColorHex) {
  return {
    "line-color": lineColorHex,
    "line-width": [
      "case",
      ["boolean", ["feature-state", "bookmarked"], false],
      12,
      0
    ],
    "line-opacity": [
      "case",
      ["boolean", ["feature-state", "bookmarked"], false],
      0.2,
      0
    ],
    "line-blur": 0.85
  };
}

// Match lib/map-theme.ts trailLineColor(MAP) — same hex fallbacks as the website Leaflet map.
const DIFFICULTY_COLORS = {
  easy: "#34a56d",
  intermediate: "#156be8",
  hard: "#242030",
  pro: "#e07828",
  not_set: "#e07828"
};

function difficultyColor(d) {
  return DIFFICULTY_COLORS[d] ?? DIFFICULTY_COLORS.not_set;
}

/** Stable id for Mapbox feature-state / dock (must match GeoJSON promoteId). */
function trailMapFeatureId(trail, index) {
  if (trail.id != null && String(trail.id).length > 0) {
    return String(trail.id);
  }
  return `__trail_idx_${index}`;
}

/** Resolve GeoJSON `properties.trailId` to the cached trail row (same indexing as GeoJSON build). */
function findTrailByFeatureId(trails, featureTrailId) {
  if (!trails?.length || featureTrailId == null) return null;
  const fid = String(featureTrailId);
  for (let i = 0; i < trails.length; i++) {
    if (trailMapFeatureId(trails[i], i) === fid) {
      return { trail: trails[i], index: i, featureId: fid };
    }
  }
  return null;
}

let bridgeRequestSeq = 0;

/** Must match content-bridge.js — avoids Strava/page postMessage collisions (e.g. VV handlers). */
const TO_BRIDGE = "__trailOverlayToBridge";
const FROM_BRIDGE = "__trailOverlayFromBridge";

/** API base URL comes only from the extension popup (chrome.storage), via the isolated bridge. */
function fetchApiUrlFromBridge() {
  const requestId = ++bridgeRequestSeq;
  return new Promise((resolve) => {
    window.postMessage(
      { type: "GET_API_URL", requestId, [TO_BRIDGE]: true },
      "*"
    );
    window.addEventListener("message", function handler(event) {
      if (
        event.data?.type === "API_URL_RESPONSE" &&
        event.data[FROM_BRIDGE] === true &&
        event.data.requestId === requestId
      ) {
        window.removeEventListener("message", handler);
        resolve(event.data.apiUrl || DEFAULT_API_URL);
      }
    });
  });
}

function fetchTrails() {
  const requestId = ++bridgeRequestSeq;
  return new Promise((resolve) => {
    window.postMessage(
      { type: "GET_TRAILS", requestId, [TO_BRIDGE]: true },
      "*"
    );
    window.addEventListener("message", function handler(event) {
      if (
        event.data?.type === "TRAILS_RESPONSE" &&
        event.data[FROM_BRIDGE] === true &&
        event.data.requestId === requestId
      ) {
        window.removeEventListener("message", handler);
        resolve(event.data.trails);
      }
    });
  });
}

function fetchNetworks() {
  const requestId = ++bridgeRequestSeq;
  return new Promise((resolve) => {
    window.postMessage(
      { type: "GET_NETWORKS", requestId, [TO_BRIDGE]: true },
      "*"
    );
    window.addEventListener("message", function handler(event) {
      if (
        event.data?.type === "NETWORKS_RESPONSE" &&
        event.data[FROM_BRIDGE] === true &&
        event.data.requestId === requestId
      ) {
        window.removeEventListener("message", handler);
        resolve(event.data.networks);
      }
    });
  });
}

const DEFAULT_OVERLAY_PREFS = {
  enabled: true,
  trailsVisible: true,
  networksVisible: true,
  photosVisible: true,
  bookmarkHighlightColor: "yellow"
};

function fetchOverlayPrefsFromBridge() {
  const requestId = ++bridgeRequestSeq;
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ...DEFAULT_OVERLAY_PREFS }), 2000);
    window.postMessage(
      { type: "GET_OVERLAY_PREFS", requestId, [TO_BRIDGE]: true },
      "*"
    );
    window.addEventListener("message", function handler(event) {
      if (
        event.data?.type === "OVERLAY_PREFS_RESPONSE" &&
        event.data[FROM_BRIDGE] === true &&
        event.data.requestId === requestId
      ) {
        clearTimeout(timer);
        window.removeEventListener("message", handler);
        resolve({
          enabled: event.data.enabled !== false,
          trailsVisible: event.data.trailsVisible !== false,
          networksVisible: event.data.networksVisible !== false,
          photosVisible: event.data.photosVisible !== false,
          bookmarkHighlightColor:
            typeof event.data.bookmarkHighlightColor === "string" &&
            event.data.bookmarkHighlightColor.trim().length > 0
              ? event.data.bookmarkHighlightColor.trim()
              : DEFAULT_OVERLAY_PREFS.bookmarkHighlightColor
        });
      }
    });
  });
}

function fetchTrailBookmarksFromBridge() {
  const requestId = ++bridgeRequestSeq;
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve([]), 2000);
    window.postMessage(
      { type: "GET_TRAIL_BOOKMARKS", requestId, [TO_BRIDGE]: true },
      "*"
    );
    window.addEventListener("message", function handler(event) {
      if (
        event.data?.type === "TRAIL_BOOKMARKS_RESPONSE" &&
        event.data[FROM_BRIDGE] === true &&
        event.data.requestId === requestId
      ) {
        clearTimeout(timer);
        window.removeEventListener("message", handler);
        const ids = Array.isArray(event.data.ids) ? event.data.ids : [];
        resolve(ids.map((x) => String(x ?? "").trim()).filter(Boolean));
      }
    });
  });
}

function persistTrailBookmarksToBridge(ids) {
  const requestId = ++bridgeRequestSeq;
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(), 2000);
    window.postMessage(
      { type: "SET_TRAIL_BOOKMARKS", requestId, ids, [TO_BRIDGE]: true },
      "*"
    );
    window.addEventListener("message", function handler(event) {
      if (
        event.data?.type === "TRAIL_BOOKMARKS_SET" &&
        event.data[FROM_BRIDGE] === true &&
        event.data.requestId === requestId
      ) {
        clearTimeout(timer);
        window.removeEventListener("message", handler);
        resolve();
      }
    });
  });
}

function fetchTrailPhotosFromBridge(bounds) {
  const requestId = ++bridgeRequestSeq;
  return new Promise((resolve) => {
    window.postMessage(
      {
        type: "GET_TRAIL_PHOTOS",
        requestId,
        [TO_BRIDGE]: true,
        north: bounds.north,
        south: bounds.south,
        east: bounds.east,
        west: bounds.west,
        limit: bounds.limit ?? 500
      },
      "*"
    );
    window.addEventListener("message", function handler(event) {
      if (
        event.data?.type === "TRAIL_PHOTOS_RESPONSE" &&
        event.data[FROM_BRIDGE] === true &&
        event.data.requestId === requestId
      ) {
        window.removeEventListener("message", handler);
        resolve(event.data.photos || []);
      }
    });
  });
}

function fetchTrailPhotosByTrailFromBridge(trailId, limit = 80) {
  const requestId = ++bridgeRequestSeq;
  const tid = normalizeTrailIdKey(trailId);
  return new Promise((resolve) => {
    window.postMessage(
      {
        type: "GET_TRAIL_PHOTOS_BY_TRAIL",
        requestId,
        [TO_BRIDGE]: true,
        trailId: tid,
        limit
      },
      "*"
    );
    window.addEventListener("message", function handler(event) {
      if (
        event.data?.type === "TRAIL_PHOTOS_RESPONSE" &&
        event.data[FROM_BRIDGE] === true &&
        event.data.requestId === requestId
      ) {
        window.removeEventListener("message", handler);
        resolve(event.data.photos || []);
      }
    });
  });
}

function addClickNudge(map) {
  const canvas = map.getCanvas();

  map.on("click", (e) => {
    const rect = canvas.getBoundingClientRect();

    // Convert lngLat to screen pixel coords
    const point = map.project(e.lngLat);

    const clientX = rect.left + point.x;
    const clientY = rect.top + point.y;

    // Small offset (tweak this!)
    const offsetX = 3;
    const offsetY = 3;

    // Dispatch a synthetic mousemove
    const moveEvent = new MouseEvent("mousemove", {
      bubbles: true,
      cancelable: true,
      clientX: clientX + offsetX,
      clientY: clientY + offsetY,
      view: window
    });

    canvas.dispatchEvent(moveEvent);
  });
}

// --- MAP DETECTION ---

function isMapboxLikeMap(v) {
  return (
    v &&
    typeof v === "object" &&
    typeof v.addSource === "function" &&
    typeof v.addLayer === "function" &&
    typeof v.isStyleLoaded === "function"
  );
}

function tryFindMap() {
  // Strava route builder exposes the live map here; prefer it over an older captured instance.
  if (isMapboxLikeMap(window.vv_map)) {
    return window.vv_map;
  }

  if (isMapboxLikeMap(window._trailOverlayMap)) return window._trailOverlayMap;

  const mbContainer = document.querySelector(".mapboxgl-map");
  if (mbContainer?._mapboxgl_map) return mbContainer._mapboxgl_map;

  try {
    const pv = window.pageView;
    if (pv) {
      const m =
        pv.map?.() || pv.mapContext?.()?.map?.() || pv.activity?.()?.map?.();
      if (m && typeof m.addLayer === "function") return m;
    }
  } catch (_) {}

  for (const key in window) {
    try {
      const v = window[key];
      if (isMapboxLikeMap(v)) {
        return v;
      }
    } catch (_) {}
  }

  return null;
}

function waitForMap(timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const existing = tryFindMap();
    if (existing) return resolve(existing);

    const deadline = Date.now() + timeoutMs;

    const poll = setInterval(() => {
      const found = tryFindMap();
      if (found) {
        clearInterval(poll);
        resolve(found);
      } else if (Date.now() > deadline) {
        clearInterval(poll);
        reject(new Error("Map not found"));
      }
    }, 250);
  });
}

function waitForStyleLoaded(map) {
  return new Promise((resolve) => {
    if (map.isStyleLoaded()) return resolve();
    map.once("style.load", resolve);
  });
}

// --- GEOJSON ---

function trailsToGeoJSON(trails) {
  return {
    type: "FeatureCollection",
    features: trails.map((trail, i) => ({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: trail.polyline.map(([lat, lng]) => [lng, lat])
      },
      properties: {
        trailId: trailMapFeatureId(trail, i),
        name: trail.name,
        difficulty: trail.difficulty,
        direction: trail.direction,
        distanceKm: trail.distanceKm,
        elevationGainFt: trail.elevationGainFt,
        notes: trail.notes || "",
        color: difficultyColor(trail.difficulty)
      }
    }))
  };
}

// --- GEOJSON (networks) ---

function networksToGeoJSON(networks) {
  return {
    type: "FeatureCollection",
    features: networks
      .filter((n) => n.polygon && n.polygon.length >= 3)
      .map((n) => {
        // DB stores [lat, lng]; Mapbox requires [lng, lat]
        const coords = n.polygon.map(([lat, lng]) => [lng, lat]);
        // Close the ring
        if (
          coords[0][0] !== coords[coords.length - 1][0] ||
          coords[0][1] !== coords[coords.length - 1][1]
        ) {
          coords.push(coords[0]);
        }
        return {
          type: "Feature",
          geometry: { type: "Polygon", coordinates: [coords] },
          properties: {
            id: n.id,
            name: n.name,
            trailCount: n.trailIds ? n.trailIds.length : 0,
            trailIds: JSON.stringify(n.trailIds || [])
          }
        };
      })
  };
}

// --- MAP RENDERING ---

function addNetworksToMap(map, networks) {
  if (!map) return;

  // Remove old layers/source if present
  [NETWORK_LABEL_LAYER, NETWORK_BORDER_LAYER, NETWORK_FILL_LAYER].forEach(
    (id) => {
      if (map.getLayer(id)) map.removeLayer(id);
    }
  );
  if (map.getSource(NETWORK_SOURCE_ID)) map.removeSource(NETWORK_SOURCE_ID);

  if (!networks.length) return;

  map.addSource(NETWORK_SOURCE_ID, {
    type: "geojson",
    data: networksToGeoJSON(networks)
  });

  // Semi-transparent fill
  map.addLayer({
    id: NETWORK_FILL_LAYER,
    type: "fill",
    source: NETWORK_SOURCE_ID,
    paint: {
      "fill-color": "#3b82f6",
      "fill-opacity": 0.1
    }
  });

  // Solid border
  map.addLayer({
    id: NETWORK_BORDER_LAYER,
    type: "line",
    source: NETWORK_SOURCE_ID,
    paint: {
      "line-color": "#3b82f6",
      "line-width": 2,
      "line-opacity": 0.7
    }
  });

  // Network name label at polygon centroid
  map.addLayer({
    id: NETWORK_LABEL_LAYER,
    type: "symbol",
    source: NETWORK_SOURCE_ID,
    layout: {
      "text-field": ["get", "name"],
      "text-size": 13,
      "text-anchor": "center",
      "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"]
    },
    paint: {
      "text-color": "#1d4ed8",
      "text-halo-color": "#ffffff",
      "text-halo-width": 2
    }
  });
}

function detachTrailLineLayerInteractions(map) {
  const h = map.__trailOverlayLineHandlers;
  if (!h) return;
  map.off("mousemove", LAYER_ID, h.onMousemove);
  map.off("mouseleave", LAYER_ID, h.onMouseleave);
  map.off("click", LAYER_ID, h.onClick);
  map.__trailOverlayLineHandlers = null;
}

function refreshSonnerQuickBookmarkBar(map) {
  const panel = document.getElementById(TRAIL_SONNER_PANEL_ID);
  const btn = panel?.querySelector?.("[data-trail-overlay-quick-bm]");
  if (!btn) return;
  const ref = lastMapClickedTrailRef;
  const disabled = !ref || ref.featureId == null;
  btn.disabled = disabled;
  Object.assign(btn.style, {
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? "0.55" : "1"
  });
  const starSlot = btn.querySelector(".trail-overlay-sonner-quick-bm-star");
  if (starSlot) {
    starSlot.setAttribute("aria-hidden", "true");
    if (!disabled) {
      updateDockCardBookmarkStar(starSlot, ref.featureId);
      starSlot.removeAttribute("aria-label");
      starSlot.removeAttribute("title");
    } else {
      starSlot.textContent = "☆";
    }
  }
  const lab = btn.querySelector(".trail-overlay-sonner-quick-bm-label");
  if (lab) {
    const nm = ref?.trail?.name;
    lab.textContent = nm ? `Map trail: ${nm}` : "Bookmark map trail";
  }
  btn.setAttribute(
    "aria-label",
    disabled
      ? "Bookmark map trail — click a trail line on the map first"
      : bookmarkedTrailIds.has(String(ref.featureId))
        ? `Remove bookmark for ${ref.trail?.name || "trail"}`
        : `Bookmark ${ref.trail?.name || "trail"}`
  );
}

function attachTrailLineLayerInteractions(map) {
  detachTrailLineLayerInteractions(map);

  const onMousemove = (e) => {
    map.getCanvas().style.cursor =
      e.features && e.features.length > 0 ? "pointer" : "";
  };

  const onMouseleave = () => {
    map.getCanvas().style.cursor = "";
  };

  const onClick = (e) => {
    if (!e.features?.length) return;
    const fid = e.features[0].properties?.trailId;
    const resolved = findTrailByFeatureId(cachedTrails, fid);
    if (!resolved) return;
    lastMapClickedTrailRef = {
      trail: resolved.trail,
      featureId: resolved.featureId
    };
    refreshSonnerQuickBookmarkBar(map);
    openTrailInfoDrawer(map, resolved.trail, {
      focusReturnEl: map.getCanvas?.() ?? null,
      featureId: resolved.featureId
    });
  };

  map.on("mousemove", LAYER_ID, onMousemove);
  map.on("mouseleave", LAYER_ID, onMouseleave);
  map.on("click", LAYER_ID, onClick);
  map.__trailOverlayLineHandlers = { onMousemove, onMouseleave, onClick };
}

function buildTrailsGeoJSONWithNetworks(trails, networks) {
  const trailNetworkName = {};
  if (networks) {
    for (const network of networks) {
      for (const trailId of network.trailIds || []) {
        trailNetworkName[trailId] = network.name;
      }
    }
  }
  const geojson = trailsToGeoJSON(trails);
  geojson.features.forEach((f, i) => {
    const networkName = trailNetworkName[trails[i]?.id];
    if (networkName) f.properties.networkName = networkName;
  });
  return geojson;
}

function applyBookmarkHaloPaintIfNeeded(map) {
  if (!map?.getLayer?.(LAYER_ID_BOOKMARK_HALO)) return;
  if (map.__trailOverlayBookmarkHaloHex === overlayBookmarkHaloHex) return;
  try {
    map.setPaintProperty(
      LAYER_ID_BOOKMARK_HALO,
      "line-color",
      overlayBookmarkHaloHex
    );
  } catch (_) {}
  map.__trailOverlayBookmarkHaloHex = overlayBookmarkHaloHex;
}

function ensureTrailBookmarkHaloLayer(map) {
  if (!map?.getSource?.(SOURCE_ID) || map.getLayer(LAYER_ID_BOOKMARK_HALO)) {
    return;
  }
  if (!map.getLayer(LAYER_ID)) return;
  map.addLayer(
    {
      id: LAYER_ID_BOOKMARK_HALO,
      type: "line",
      source: SOURCE_ID,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: buildBookmarkHaloPaint(overlayBookmarkHaloHex)
    },
    LAYER_ID
  );
  map.__trailOverlayBookmarkHaloHex = overlayBookmarkHaloHex;
}

function addTrailsToMap(map, trails, networks) {
  if (!map) return;

  const geojson = buildTrailsGeoJSONWithNetworks(trails, networks);

  const existingSource = map.getSource(SOURCE_ID);
  const existingLayer = map.getLayer(LAYER_ID);
  if (existingSource && existingLayer) {
    try {
      existingSource.setData(geojson);
    } catch (_) {
      stripTrailLineLayersFromMap(map);
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: geojson,
        promoteId: "trailId"
      });
      map.addLayer({
        id: LAYER_ID_BOOKMARK_HALO,
        type: "line",
        source: SOURCE_ID,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: buildBookmarkHaloPaint(overlayBookmarkHaloHex)
      });
      map.__trailOverlayBookmarkHaloHex = overlayBookmarkHaloHex;
      map.addLayer({
        id: LAYER_ID,
        type: "line",
        source: SOURCE_ID,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: TRAIL_LINE_PAINT
      });
    }
    ensureTrailBookmarkHaloLayer(map);
    attachTrailLineLayerInteractions(map);
    restoreOpenTrailInfoDrawerHighlight(map);
    applyBookmarkFeatureStatesToMap(map);
    return;
  }

  if (existingSource || existingLayer) {
    stripTrailLineLayersFromMap(map);
  }

  map.addSource(SOURCE_ID, {
    type: "geojson",
    data: geojson,
    promoteId: "trailId"
  });

  map.addLayer({
    id: LAYER_ID_BOOKMARK_HALO,
    type: "line",
    source: SOURCE_ID,
    layout: { "line-join": "round", "line-cap": "round" },
    paint: buildBookmarkHaloPaint(overlayBookmarkHaloHex)
  });
  map.__trailOverlayBookmarkHaloHex = overlayBookmarkHaloHex;
  map.addLayer({
    id: LAYER_ID,
    type: "line",
    source: SOURCE_ID,
    layout: { "line-join": "round", "line-cap": "round" },
    paint: TRAIL_LINE_PAINT
  });

  attachTrailLineLayerInteractions(map);
  applyBookmarkFeatureStatesToMap(map);
}

/** Remove network overlay only (does not close trail drawer or hide dock). */
function stripNetworkLayersFromMap(map) {
  if (!map) return;
  [NETWORK_LABEL_LAYER, NETWORK_BORDER_LAYER, NETWORK_FILL_LAYER].forEach(
    (id) => {
      if (map.getLayer(id)) map.removeLayer(id);
    }
  );
  if (map.getSource(NETWORK_SOURCE_ID)) map.removeSource(NETWORK_SOURCE_ID);
}

/** Remove trail line source/layer and pointer handlers (does not close drawer). */
function stripTrailLineLayersFromMap(map) {
  if (!map) return;
  detachTrailLineLayerInteractions(map);
  try {
    document.getElementById("trail-overlay-info-panel")?.remove();
    document.getElementById("trail-overlay-dock-root")?.remove();
    document.getElementById("trail-overlay-bookmark-toasts")?.remove();
  } catch (_) {
    /* ignore */
  }
  clearDockLineHighlight(map);
  lastAppliedBookmarkIds = new Set();
  if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
  if (map.getLayer(LAYER_ID_BOOKMARK_HALO)) {
    map.removeLayer(LAYER_ID_BOOKMARK_HALO);
  }
  try {
    delete map.__trailOverlayBookmarkHaloHex;
  } catch (_) {}
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
}

// --- TOGGLE HELPERS ---

let overlayEnabled = true;
let overlayTrailsVisible = true;
let overlayNetworksVisible = true;
let overlayTrailPhotosVisible = true;
/** Raw value from extension settings: `yellow` / `red` / … or `#rrggbb`. */
let overlayBookmarkHighlightColor = DEFAULT_OVERLAY_PREFS.bookmarkHighlightColor;
/** Resolved `#rrggbb` for bookmark halo; updated from overlay prefs before trail layers are built. */
let overlayBookmarkHaloHex = DEFAULT_BOOKMARK_HALO_HEX;

/** Debounced viewport fetch for trail list thumbnails only (no map markers). */
let viewportPhotoPreviewTimer = null;

/** Last bbox `GET /api/trail-photos` payload (for gallery merge + strip thumbnails). */
let lastViewportTrailPhotos = [];

/** trail DB id string -> preview image URL (from latest viewport photo fetch). */
let trailPhotoPreviewByTrailId = new Map();

function normalizeTrailIdKey(v) {
  if (v == null) return "";
  return String(v).trim().toLowerCase();
}
let dockHighlightClearTimer = null;
let dockRefreshTimer = null;
let lastDockHighlightedId = null;

/** Trail feature ids (Mapbox promoteId / `trailMapFeatureId`) persisted in `chrome.storage.local`. */
let bookmarkedTrailIds = new Set();
/** For clearing `bookmarked` feature-state when ids are removed from the set. */
let lastAppliedBookmarkIds = new Set();

/** Last trail picked from the map line click (for quick bookmark row). `{ trail, featureId }` or `null`. */
let lastMapClickedTrailRef = null;

function scheduleViewportPhotoPreviewFetch(map) {
  if (!map) return;
  clearTimeout(viewportPhotoPreviewTimer);
  viewportPhotoPreviewTimer = setTimeout(() => {
    void refreshViewportTrailPhotoPreviews(map);
  }, 500);
}

async function refreshViewportTrailPhotoPreviews(map) {
  if (!map || !overlayEnabled || !overlayTrailPhotosVisible) {
    lastViewportTrailPhotos = [];
    rebuildTrailPhotoPreviewsFromPhotos([]);
    scheduleTrailDockRefresh(map);
    return;
  }
  const b = map.getBounds();
  const photos = await fetchTrailPhotosFromBridge({
    north: b.getNorth(),
    south: b.getSouth(),
    east: b.getEast(),
    west: b.getWest(),
    limit: 500
  });
  lastViewportTrailPhotos = Array.isArray(photos) ? photos : [];
  rebuildTrailPhotoPreviewsFromPhotos(photos);
  scheduleTrailDockRefresh(map);
}

function setEnabled(value) {
  overlayEnabled = value;
  const requestId = ++bridgeRequestSeq;
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, 2000);
    window.postMessage(
      { type: "SET_ENABLED", enabled: value, requestId, [TO_BRIDGE]: true },
      "*"
    );
    window.addEventListener("message", function handler(event) {
      if (
        event.data?.type === "ENABLED_SET" &&
        event.data[FROM_BRIDGE] === true &&
        event.data.requestId === requestId
      ) {
        clearTimeout(timer);
        window.removeEventListener("message", handler);
        resolve();
      }
    });
  });
}

/** Full teardown: close UI and strip all overlay map sources/layers. */
function removeLayers(map) {
  closeTrailInfoDrawer();
  hideTrailDock();
  if (!map) return;
  stripNetworkLayersFromMap(map);
  stripTrailLineLayersFromMap(map);
}

function rebuildTrailPhotoPreviewsFromPhotos(photos) {
  trailPhotoPreviewByTrailId = new Map();
  if (!photos?.length) return;
  for (const p of photos) {
    if (p.trailId == null) continue;
    const sid = normalizeTrailIdKey(p.trailId);
    if (!sid) continue;
    if (!trailPhotoPreviewByTrailId.has(sid)) {
      const url = p.thumbnailUrl || p.blobUrl;
      if (url) trailPhotoPreviewByTrailId.set(sid, url);
    }
  }
}

function trailPolylineBBoxIntersectsBounds(trail, north, south, east, west) {
  const poly = trail.polyline;
  if (!poly?.length) return false;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const pair of poly) {
    const lat = pair[0];
    const lng = pair[1];
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  if (maxLat < south || minLat > north) return false;
  if (east >= west) {
    if (maxLng < west || minLng > east) return false;
  } else if (maxLng < west && minLng > east) {
    return false;
  }
  return true;
}

function getTrailsInViewport(map, trails) {
  if (!map || !trails?.length) return [];
  const b = map.getBounds();
  const north = b.getNorth();
  const south = b.getSouth();
  const east = b.getEast();
  const west = b.getWest();
  const out = [];
  for (let index = 0; index < trails.length; index++) {
    const trail = trails[index];
    if (!trail.polyline?.length) continue;
    if (trailPolylineBBoxIntersectsBounds(trail, north, south, east, west)) {
      out.push({ trail, index });
    }
  }
  return out;
}

function clearDockLineHighlight(map) {
  if (dockHighlightClearTimer) {
    clearTimeout(dockHighlightClearTimer);
    dockHighlightClearTimer = null;
  }
  if (!lastDockHighlightedId) return;
  if (map?.getSource?.(SOURCE_ID)) {
    try {
      map.setFeatureState(
        { source: SOURCE_ID, id: lastDockHighlightedId },
        { highlight: false }
      );
    } catch (_) {}
  }
  lastDockHighlightedId = null;
}

function scheduleClearDockLineHighlight(map, delay = 70) {
  if (dockHighlightClearTimer) clearTimeout(dockHighlightClearTimer);
  dockHighlightClearTimer = setTimeout(() => {
    dockHighlightClearTimer = null;
    clearDockLineHighlight(map);
  }, delay);
}

function cancelScheduleClearDockHighlight() {
  if (dockHighlightClearTimer) {
    clearTimeout(dockHighlightClearTimer);
    dockHighlightClearTimer = null;
  }
}

function setDockLineHighlight(map, featureId) {
  if (!map?.getSource?.(SOURCE_ID) || !featureId) return;
  cancelScheduleClearDockHighlight();
  if (lastDockHighlightedId && lastDockHighlightedId !== featureId) {
    try {
      map.setFeatureState(
        { source: SOURCE_ID, id: lastDockHighlightedId },
        { highlight: false }
      );
    } catch (_) {}
  }
  try {
    map.setFeatureState(
      { source: SOURCE_ID, id: featureId },
      { highlight: true }
    );
    lastDockHighlightedId = featureId;
  } catch (_) {}
}

function closeTrailInfoDrawer() {
  const drawer = document.getElementById(TRAIL_INFO_DRAWER_ID);
  if (!drawer) return;
  const map = drawer.__trailOverlayMap;
  const prev = drawer.__trailOverlayRestoreFocus;
  const escHandler = drawer.__trailOverlayEscHandler;
  const resizeHandler = drawer.__trailOverlayResizeHandler;
  if (escHandler) {
    document.removeEventListener("keydown", escHandler);
  }
  if (resizeHandler) {
    window.removeEventListener("resize", resizeHandler);
  }
  drawer.remove();
  if (map) clearDockLineHighlight(map);
  if (prev && typeof prev.focus === "function") {
    try {
      prev.focus({ preventScroll: true });
    } catch (_) {}
  }
}

/** Re-apply Mapbox highlight for the open drawer (e.g. after style.load rebuild). */
function restoreOpenTrailInfoDrawerHighlight(map) {
  const drawer = document.getElementById(TRAIL_INFO_DRAWER_ID);
  if (!drawer || !map || !map.getSource?.(SOURCE_ID)) return;
  const fid = drawer.__trailOverlayFeatureId;
  if (fid == null) return;
  cancelScheduleClearDockHighlight();
  try {
    map.setFeatureState({ source: SOURCE_ID, id: fid }, { highlight: true });
    lastDockHighlightedId = fid;
  } catch (_) {}
}

/** Refresh drawer title/body from `cachedTrails` without closing the shell. */
function refreshOpenTrailInfoDrawerFromCache() {
  const drawer = document.getElementById(TRAIL_INFO_DRAWER_ID);
  if (!drawer || !cachedTrails?.length) return;
  const fid = drawer.__trailOverlayFeatureId;
  if (fid == null) return;
  const resolved = findTrailByFeatureId(cachedTrails, fid);
  if (!resolved) return;
  const title = drawer.querySelector("#trail-overlay-drawer-title");
  if (title) title.textContent = resolved.trail.name || "Trail";
  const inner = drawer.querySelector(".trail-overlay-drawer-inner");
  const scroll = inner?.children[1];
  if (!scroll) return;
  scroll.replaceChildren();
  appendTrailDetailMainSections(scroll, resolved.trail);
}

function hideTrailDock() {
  const root = document.getElementById(TRAIL_SONNER_PANEL_ID);
  if (root) root.style.display = "none";
  closeTrailInfoDrawer();
}

/** Mapbox map root for overlay UI (unified trail panel + modal). */
function getTrailOverlayMapDomContainer(map) {
  try {
    const canvas = map?.getCanvas?.();
    if (!canvas) return null;
    const container = canvas.closest(".mapboxgl-map") || canvas.parentElement;
    if (!container) return null;
    if (window.getComputedStyle(container).position === "static") {
      container.style.position = "relative";
    }
    return container;
  } catch (_) {
    return null;
  }
}

function isMapboxGlMapCanvas(el) {
  if (!el || el.tagName !== "CANVAS") return false;
  const cls = typeof el.className === "string" ? el.className : "";
  return cls.includes("mapboxgl-canvas");
}

/** Top inset inside the map box so the panel max-height clears Strava chrome above the canvas. */
function measureTrailPanelTopInsetPx(map) {
  if (!map?.getCanvas) return 64;
  try {
    const canvas = map.getCanvas();
    const r = canvas.getBoundingClientRect();
    if (r.width <= 2 || r.height <= 2) return 64;
    const probe = Math.min(72, Math.max(24, Math.floor(r.height * 0.08)));
    const cx = r.left + r.width * 0.5;
    const cy = r.top + probe;
    let n = document.elementFromPoint(cx, cy);
    let safety = 0;
    while (n && n !== canvas && n !== document.documentElement && safety++ < 16) {
      if (
        (n instanceof HTMLElement || n instanceof SVGElement) &&
        n.closest?.(".mapboxgl-popup")
      ) {
        return Math.max(48, probe + 8);
      }
      if (isMapboxGlMapCanvas(n)) return Math.max(48, probe);
      n = n.parentElement;
    }
    if (n === canvas) return Math.max(48, probe);
  } catch (_) {}
  return 64;
}

/** Pixels to leave empty at the map bottom so the unified trail panel stays uncovered (modal inset). */
function measureTrailDockBottomReservePx() {
  const root = document.getElementById(TRAIL_SONNER_PANEL_ID);
  if (!root) return 0;
  const cs = window.getComputedStyle(root);
  if (cs.display === "none" || cs.visibility === "hidden") return 0;
  const h = root.getBoundingClientRect().height;
  if (h < 4) return 0;
  return Math.ceil(h) + 12;
}

function refreshSonnerPanelLayout(map) {
  const panel = document.getElementById(TRAIL_SONNER_PANEL_ID);
  if (!panel || panel.style.display === "none") return;
  const m = map && isMapboxLikeMap(map) ? map : trailOverlayMapRef;
  const container = getTrailOverlayMapDomContainer(m);
  const topInset = measureTrailPanelTopInsetPx(m);
  panel.style.pointerEvents = "auto";
  // Bottom-anchored: panel grows upward from the bottom of the map box.
  panel.style.top = "auto";
  panel.style.right = "10px";
  panel.style.bottom = "10px";
  panel.style.left = "auto";
  if (container) {
    const ch =
      container.clientHeight ||
      Math.floor(container.getBoundingClientRect().height);
    const reserveBottom = 16;
    const avail = Math.max(160, ch - topInset - reserveBottom);
    const cap = Math.min(760, Math.floor(window.innerHeight * 0.86));
    panel.style.maxHeight = `${Math.min(cap, avail)}px`;
  } else {
    panel.style.maxHeight = "min(86vh, 760px)";
  }
  const bmHost = panel.querySelector(".trail-overlay-sonner-bookmarks");
  if (bmHost) {
    // Default (non-hover) keeps it compact; hover mode overrides to fill panel.
    bmHost.style.maxHeight = "min(56vh, 420px)";
    bmHost.style.minHeight = "0";
    bmHost.style.overflowY = "auto";
    bmHost.style.overflowX = "hidden";
    bmHost.style.overscrollBehavior = "contain";
  }
}

function refreshTrailInfoDrawerLayoutIfOpen() {
  const dr = document.getElementById(TRAIL_INFO_DRAWER_ID);
  if (dr && typeof dr.__trailOverlayApplyInsets === "function") {
    dr.__trailOverlayApplyInsets();
  }
  refreshSonnerPanelLayout(trailOverlayMapRef);
}

function ensureBookmarkToastStyles() {
  if (document.getElementById("trail-overlay-bookmark-styles")) return;
  const s = document.createElement("style");
  s.id = "trail-overlay-bookmark-styles";
  s.textContent =
    "@keyframes trailOverlayToastIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}" +
    ".trail-overlay-bookmark-toast-card{animation:trailOverlayToastIn .22s ease-out}";
  document.head.appendChild(s);
}

function ensureSonnerPanelRoot(map) {
  const container = getTrailOverlayMapDomContainer(map);
  if (!container) return null;

  let panel = document.getElementById(TRAIL_SONNER_PANEL_ID);
  if (panel && panel.parentElement !== container) {
    try {
      panel.remove();
    } catch (_) {}
    panel = null;
  }
  if (
    panel &&
    panel.getAttribute("data-trail-overlay-layout") !== TRAIL_SONNER_PANEL_LAYOUT
  ) {
    try {
      panel.remove();
    } catch (_) {}
    panel = null;
  }
  if (panel) return panel;

  ensureBookmarkToastStyles();
  panel = document.createElement("div");
  panel.id = TRAIL_SONNER_PANEL_ID;
  panel.setAttribute("data-trail-overlay-layout", TRAIL_SONNER_PANEL_LAYOUT);
  panel.setAttribute("role", "region");
  panel.setAttribute("aria-label", "Trails and bookmarks");
  Object.assign(panel.style, {
    position: "absolute",
    zIndex: String(TRAIL_PANEL_Z),
    display: "none",
    flexDirection: "column-reverse",
    width: "min(300px, 42vw)",
    maxWidth: "100%",
    boxSizing: "border-box",
    fontFamily:
      'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, sans-serif',
    // No wrapper background: let the map show through between cards.
    overflow: "visible",
    borderRadius: "0",
    border: "none",
    background: "transparent",
    boxShadow: "none",
    backdropFilter: "none",
    minHeight: "0"
  });

  const trailsCol = document.createElement("div");
  trailsCol.className = "trail-overlay-sonner-trails-col";
  Object.assign(trailsCol.style, {
    flex: "1",
    minHeight: "0",
    display: "flex",
    flexDirection: "column-reverse",
    overflow: "hidden",
    padding: "8px 10px 0"
  });

  const label = document.createElement("div");
  label.className = "trail-overlay-sonner-trails-label";
  Object.assign(label.style, {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    fontSize: "11px",
    fontWeight: "600",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.55)",
    flex: "0 0 auto",
    marginBottom: "6px"
  });
  const labelText = document.createElement("span");
  labelText.textContent = "Trails in view";
  Object.assign(labelText.style, { flex: "1", minWidth: "0" });
  const minBtn = document.createElement("button");
  minBtn.type = "button";
  minBtn.setAttribute("data-trail-overlay-minimize-btn", "1");
  minBtn.setAttribute("aria-label", "Minimize trail panel");
  minBtn.textContent = "▾";
  Object.assign(minBtn.style, {
    flex: "0 0 auto",
    marginLeft: "10px",
    width: "22px",
    height: "22px",
    padding: "0",
    borderRadius: "6px",
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(0,0,0,0.32)",
    color: "rgba(244,244,245,0.75)",
    cursor: "pointer",
    lineHeight: "20px",
    fontSize: "14px"
  });
  minBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const next = panel.getAttribute("data-trail-overlay-minimized") !== "1";
    setSonnerPanelMinimized(panel, next);
  });
  label.appendChild(labelText);
  label.appendChild(minBtn);

  const scroll = document.createElement("div");
  scroll.className = "trail-overlay-sonner-trails-scroll";
  scroll.setAttribute("role", "list");
  Object.assign(scroll.style, {
    flex: "1",
    minHeight: "0",
    display: "flex",
    flexDirection: "column-reverse",
    gap: "6px",
    overflowY: "auto",
    overflowX: "hidden",
    overscrollBehavior: "contain",
    paddingTop: "10px",
    scrollbarWidth: "thin",
    WebkitMaskImage:
      "linear-gradient(to bottom, transparent 0%, transparent 8px, black 36px)",
    maskImage:
      "linear-gradient(to bottom, transparent 0%, transparent 8px, black 36px)"
  });
  scroll.style.setProperty("-webkit-overflow-scrolling", "touch");

  const more = document.createElement("div");
  more.className = "trail-overlay-sonner-trails-more";
  Object.assign(more.style, {
    fontSize: "11px",
    color: "rgba(255,255,255,0.5)",
    display: "none",
    flex: "0 0 auto",
    padding: "4px 0 6px"
  });

  const quickWrap = document.createElement("div");
  quickWrap.className = "trail-overlay-sonner-quick-bm-wrap";
  Object.assign(quickWrap.style, {
    flex: "0 0 auto",
    padding: "6px 0 8px",
    borderTop: "1px solid rgba(255,255,255,0.08)"
  });

  const quickBtn = document.createElement("button");
  quickBtn.type = "button";
  quickBtn.setAttribute("data-trail-overlay-quick-bm", "1");
  quickBtn.disabled = true;
  Object.assign(quickBtn.style, {
    width: "100%",
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: "8px",
    padding: "8px 10px",
    borderRadius: "8px",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "#f4f4f5",
    cursor: "pointer",
    textAlign: "left",
    fontSize: "12px"
  });
  const quickStar = document.createElement("span");
  quickStar.className = "trail-overlay-sonner-quick-bm-star";
  quickStar.textContent = "☆";
  Object.assign(quickStar.style, {
    flex: "0 0 auto",
    width: "28px",
    textAlign: "center",
    fontSize: "16px",
    lineHeight: "1"
  });
  const quickLab = document.createElement("span");
  quickLab.className = "trail-overlay-sonner-quick-bm-label";
  quickLab.textContent = "Bookmark map trail";
  Object.assign(quickLab.style, {
    flex: "1",
    minWidth: "0",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  });
  quickBtn.appendChild(quickStar);
  quickBtn.appendChild(quickLab);
  quickBtn.addEventListener("click", () => {
    const m = trailOverlayMapRef;
    if (!lastMapClickedTrailRef?.featureId || !m) return;
    void toggleBookmarkForFeatureId(m, lastMapClickedTrailRef.featureId);
  });
  quickWrap.appendChild(quickBtn);

  /* column-reverse: bottom of map → quick row, “+ more”, trail rows (grow upward), label at top. */
  trailsCol.appendChild(quickWrap);
  trailsCol.appendChild(more);
  trailsCol.appendChild(scroll);
  trailsCol.appendChild(label);

  const divider = document.createElement("div");
  divider.className = "trail-overlay-sonner-divider";
  divider.setAttribute("role", "separator");
  Object.assign(divider.style, {
    flex: "0 0 auto",
    height: "1px",
    background: "rgba(255,255,255,0.1)",
    margin: "2px 10px"
  });

  const bookmarks = document.createElement("div");
  bookmarks.className = "trail-overlay-sonner-bookmarks";
  bookmarks.setAttribute("role", "list");
  Object.assign(bookmarks.style, {
    flex: "0 1 auto",
    display: "flex",
    flexDirection: "column",
    gap: "0",
    padding: "2px 10px 8px",
    minHeight: "0",
    overflowY: "auto",
    overflowX: "hidden",
    overscrollBehavior: "contain",
    alignItems: "stretch"
  });
  bookmarks.style.setProperty("-webkit-overflow-scrolling", "touch");
  bookmarks.addEventListener("mouseenter", () => {
    setSonnerBookmarkHoverMode(panel, true);
  });
  panel.addEventListener("mouseleave", () => {
    setSonnerBookmarkHoverMode(panel, false);
  });

  /* column-reverse on panel: first child sits at map bottom (bookmark stack). */
  panel.appendChild(bookmarks);
  panel.appendChild(divider);
  panel.appendChild(trailsCol);

  container.appendChild(panel);
  refreshSonnerQuickBookmarkBar(map);
  refreshSonnerPanelLayout(map);
  // Default to expanded.
  setSonnerPanelMinimized(panel, false);
  return panel;
}

function setBookmarkStateOnMap(map, featureId, on) {
  if (!map?.getSource?.(SOURCE_ID) || featureId == null) return;
  try {
    map.setFeatureState(
      { source: SOURCE_ID, id: String(featureId) },
      { bookmarked: !!on }
    );
  } catch (_) {}
}

function applyBookmarkFeatureStatesToMap(map) {
  if (!map?.getSource?.(SOURCE_ID)) return;
  for (const fid of lastAppliedBookmarkIds) {
    if (!bookmarkedTrailIds.has(fid)) {
      try {
        map.setFeatureState(
          { source: SOURCE_ID, id: String(fid) },
          { bookmarked: false }
        );
      } catch (_) {}
    }
  }
  for (const fid of bookmarkedTrailIds) {
    setBookmarkStateOnMap(map, fid, true);
  }
  lastAppliedBookmarkIds = new Set(bookmarkedTrailIds);
}

function updateDockCardBookmarkStar(btn, featureId) {
  if (!btn) return;
  const on = bookmarkedTrailIds.has(featureId);
  btn.textContent = on ? "★" : "☆";
  btn.setAttribute(
    "aria-label",
    on ? "Remove bookmark" : "Bookmark trail"
  );
  btn.setAttribute("title", on ? "Remove bookmark" : "Bookmark trail");
}

function updateDrawerBookmarkAffordanceIfOpen() {
  const dr = document.getElementById(TRAIL_INFO_DRAWER_ID);
  if (!dr) return;
  const fid = dr.__trailOverlayFeatureId;
  const btn = dr.querySelector("[data-trail-overlay-drawer-bookmark]");
  if (!btn || fid == null) return;
  const on = bookmarkedTrailIds.has(String(fid));
  btn.textContent = on ? "★" : "☆";
  btn.setAttribute(
    "aria-label",
    on ? "Remove bookmark" : "Bookmark trail"
  );
}

function updateSonnerPanelDisplayVisibility(map) {
  const panel = document.getElementById(TRAIL_SONNER_PANEL_ID);
  if (!panel) return;
  if (!map || !overlayEnabled) {
    panel.style.display = "none";
    return;
  }
  const hasBm = bookmarkedTrailIds.size > 0;
  let hasTrails = false;
  if (
    overlayTrailsVisible &&
    cachedTrails?.length &&
    map.getSource?.(SOURCE_ID)
  ) {
    hasTrails = getTrailsInViewport(map, cachedTrails).length > 0;
  }
  panel.style.display = hasBm || hasTrails ? "flex" : "none";
  if (panel.style.display === "flex") refreshSonnerPanelLayout(map);
}

async function persistBookmarksAndRefreshUi(map) {
  const ids = Array.from(bookmarkedTrailIds);
  await persistTrailBookmarksToBridge(ids);
  syncBookmarkToastStack(map);
  updateDrawerBookmarkAffordanceIfOpen();
  refreshTrailInfoDrawerLayoutIfOpen();
  const panel = document.getElementById(TRAIL_SONNER_PANEL_ID);
  if (panel) {
    for (const row of panel.querySelectorAll(
      ".trail-overlay-sonner-trail-row[data-feature-id]"
    )) {
      const fid = row.getAttribute("data-feature-id");
      const bm = row.querySelector(".trail-overlay-sonner-trail-bm");
      if (fid && bm) updateDockCardBookmarkStar(bm, fid);
    }
  }
  refreshSonnerQuickBookmarkBar(map);
  updateSonnerPanelDisplayVisibility(map);
}

async function toggleBookmarkForFeatureId(map, featureId) {
  if (featureId == null) return;
  const fid = String(featureId);
  if (bookmarkedTrailIds.has(fid)) {
    bookmarkedTrailIds.delete(fid);
    lastAppliedBookmarkIds.delete(fid);
    setBookmarkStateOnMap(map, fid, false);
  } else {
    bookmarkedTrailIds.add(fid);
    lastAppliedBookmarkIds.add(fid);
    setBookmarkStateOnMap(map, fid, true);
  }
  await persistBookmarksAndRefreshUi(map);
}

function syncBookmarkToastStack(map) {
  if (!map || !overlayEnabled) {
    const panel = document.getElementById(TRAIL_SONNER_PANEL_ID);
    const stack = panel?.querySelector?.(".trail-overlay-sonner-bookmarks");
    if (stack) {
      for (const el of [...stack.querySelectorAll("[data-bookmark-feature-id]")]) {
        try {
          el.remove();
        } catch (_) {}
      }
      ensureBookmarksCover(stack);
    }
    updateSonnerPanelDisplayVisibility(map);
    return;
  }
  const panel = ensureSonnerPanelRoot(map);
  if (!panel) return;
  const stack = panel.querySelector(".trail-overlay-sonner-bookmarks");
  if (!stack) return;
  ensureBookmarksCover(stack);
  // “Bookmarks” card opens the list on hover (expanded mode).
  const cover = stack.querySelector(".trail-overlay-sonner-bookmarks-cover");
  if (cover && !cover.__trailOverlayHoverHooked) {
    cover.__trailOverlayHoverHooked = true;
    cover.addEventListener("mouseenter", () => setSonnerBookmarkHoverMode(panel, true));
  }

  if (bookmarkedTrailIds.size === 0) {
    for (const el of [...stack.querySelectorAll("[data-bookmark-feature-id]")]) {
      try {
        el.remove();
      } catch (_) {}
    }
    updateSonnerPanelDisplayVisibility(map);
    refreshSonnerPanelLayout(map);
    return;
  }

  updateSonnerPanelDisplayVisibility(map);
  refreshSonnerPanelLayout(map);

  const existing = new Map();
  for (const el of stack.querySelectorAll("[data-bookmark-feature-id]")) {
    const id = el.getAttribute("data-bookmark-feature-id");
    if (id) existing.set(id, el);
  }

  for (const fid of bookmarkedTrailIds) {
    let card = existing.get(fid);
    if (!card) {
      card = document.createElement("div");
      card.setAttribute("data-bookmark-feature-id", fid);
      card.setAttribute("role", "listitem");
      card.className = "trail-overlay-bookmark-toast-card";
      Object.assign(card.style, {
        pointerEvents: "auto",
        display: "flex",
        flexDirection: "row",
        alignItems: "stretch",
        gap: "0",
        flexShrink: "0",
        borderRadius: "10px",
        border: "1px solid rgba(255,255,255,0.14)",
        background: "rgba(22,22,26,0.96)",
        color: "#f4f4f5",
        boxShadow: "0 6px 24px rgba(0,0,0,0.45)",
        backdropFilter: "blur(8px)",
        overflow: "hidden",
        cursor: "pointer",
        minHeight: "52px"
      });

      const thumb = document.createElement("div");
      thumb.className = "trail-overlay-bm-toast-thumb";
      Object.assign(thumb.style, {
        width: "52px",
        flex: "0 0 52px",
        background: "rgba(60,60,68,0.9)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      });

      const mid = document.createElement("div");
      Object.assign(mid.style, {
        flex: "1",
        minWidth: "0",
        padding: "8px 8px 8px 4px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: "2px"
      });
      const titleEl = document.createElement("div");
      titleEl.className = "trail-overlay-bm-toast-title";
      Object.assign(titleEl.style, {
        fontSize: "13px",
        fontWeight: "600",
        lineHeight: "1.25",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      });
      mid.appendChild(titleEl);

      const sub = document.createElement("div");
      sub.className = "trail-overlay-bm-toast-sub";
      Object.assign(sub.style, {
        fontSize: "11px",
        color: "rgba(244,244,245,0.55)"
      });
      mid.appendChild(sub);

      const actions = document.createElement("div");
      Object.assign(actions.style, {
        flex: "0 0 auto",
        display: "flex",
        flexDirection: "column",
        borderLeft: "1px solid rgba(255,255,255,0.1)"
      });
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.setAttribute("aria-label", "Remove bookmark");
      removeBtn.textContent = "×";
      Object.assign(removeBtn.style, {
        flex: "1",
        minHeight: "44px",
        width: "40px",
        border: "none",
        margin: "0",
        padding: "0",
        cursor: "pointer",
        fontSize: "20px",
        lineHeight: "1",
        color: "#fff",
        background: "rgba(255,255,255,0.06)"
      });
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        void toggleBookmarkForFeatureId(map, fid);
      });
      actions.appendChild(removeBtn);

      card.appendChild(thumb);
      card.appendChild(mid);
      card.appendChild(actions);

      card.addEventListener("click", () => {
        const resolved = cachedTrails?.length
          ? findTrailByFeatureId(cachedTrails, fid)
          : null;
        if (resolved) {
          openTrailInfoDrawer(map, resolved.trail, {
            focusReturnEl: card,
            featureId: resolved.featureId
          });
        }
      });

      attachBookmarkCardHighlightListeners(map, card, fid);
      stack.appendChild(card);
    }

    const resolved = cachedTrails?.length
      ? findTrailByFeatureId(cachedTrails, fid)
      : null;
    const titleEl = card.querySelector(".trail-overlay-bm-toast-title");
    const sub = card.querySelector(".trail-overlay-bm-toast-sub");
    const thumb = card.querySelector(".trail-overlay-bm-toast-thumb");
    if (titleEl) {
      titleEl.textContent = resolved?.trail?.name || "Trail unavailable";
    }
    if (sub) {
      sub.textContent = resolved
        ? `${Number(resolved.trail.distanceKm ?? 0).toFixed(1)} km`
        : "Not in current trail list — remove bookmark";
    }
    if (thumb) {
      const url = resolved?.trail
        ? trailDockThumbUrlForTrail(resolved.trail)
        : null;
      fillTrailDockThumbWrap(thumb, url || "", resolved?.trail ?? null, {
        variant: "toast"
      });
    }
  }

  for (const el of stack.querySelectorAll("[data-bookmark-feature-id]")) {
    const id = el.getAttribute("data-bookmark-feature-id");
    if (id && !bookmarkedTrailIds.has(id)) {
      try {
        el.remove();
      } catch (_) {}
    }
  }

  layoutBookmarkCardStackOverlap(stack);
}

function hydrateBookmarksFromIds(ids) {
  bookmarkedTrailIds = new Set(
    (ids || []).map((x) => String(x ?? "").trim()).filter(Boolean)
  );
}

function applyExternalBookmarkIds(map, ids) {
  hydrateBookmarksFromIds(ids);
  applyBookmarkFeatureStatesToMap(map);
  syncBookmarkToastStack(map);
  updateDrawerBookmarkAffordanceIfOpen();
  const panel = document.getElementById(TRAIL_SONNER_PANEL_ID);
  if (panel) {
    for (const row of panel.querySelectorAll(
      ".trail-overlay-sonner-trail-row[data-feature-id]"
    )) {
      const fid = row.getAttribute("data-feature-id");
      const bm = row.querySelector(".trail-overlay-sonner-trail-bm");
      if (fid && bm) updateDockCardBookmarkStar(bm, fid);
    }
  }
  refreshSonnerQuickBookmarkBar(map);
  updateSonnerPanelDisplayVisibility(map);
}

function renderTrailPhotoGalleryInto(container, photos) {
  container.replaceChildren();
  if (!photos?.length) {
    const empty = document.createElement("p");
    empty.textContent = "No published photos pinned to this trail yet.";
    Object.assign(empty.style, {
      fontSize: "12px",
      margin: "0",
      color: "rgba(244,244,245,0.55)"
    });
    container.appendChild(empty);
    return;
  }
  const grid = document.createElement("div");
  Object.assign(grid.style, {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))",
    gap: "8px",
    maxHeight: "340px",
    overflowY: "auto",
    overscrollBehavior: "contain"
  });
  for (const photo of photos) {
    const url = photo.thumbnailUrl || photo.blobUrl;
    const full = photo.blobUrl || url;
    if (!url) continue;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("aria-label", "Open full-size photo in a new tab");
    Object.assign(btn.style, {
      padding: "0",
      border: "1px solid rgba(255,255,255,0.15)",
      borderRadius: "8px",
      overflow: "hidden",
      cursor: "pointer",
      background: "#2a2a30",
      aspectRatio: "1",
      display: "block",
      width: "100%"
    });
    const img = document.createElement("img");
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.src = url;
    Object.assign(img.style, {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      display: "block"
    });
    btn.appendChild(img);
    btn.addEventListener("click", () => {
      window.open(full, "_blank", "noopener,noreferrer");
    });
    grid.appendChild(btn);
  }
  container.appendChild(grid);
}

function mergeTrailPhotosForGallery(trailIdKey, fromApi, fromViewport) {
  const seen = new Set();
  const out = [];
  for (const p of fromApi || []) {
    if (p?.id && !seen.has(p.id)) {
      seen.add(p.id);
      out.push(p);
    }
  }
  for (const p of fromViewport || []) {
    if (!p?.id || seen.has(p.id)) continue;
    if (p.trailId == null || normalizeTrailIdKey(p.trailId) !== trailIdKey) {
      continue;
    }
    seen.add(p.id);
    out.push(p);
  }
  out.sort((a, b) => {
    const ta = a.createdAt != null ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt != null ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });
  return out;
}

async function loadTrailPhotoGalleryInto(bodyEl, trail) {
  const loading = document.createElement("p");
  loading.className = "trail-overlay-gallery-status";
  loading.textContent = "Loading photos…";
  Object.assign(loading.style, {
    fontSize: "12px",
    margin: "0",
    color: "rgba(244,244,245,0.55)"
  });
  bodyEl.replaceChildren(loading);

  const trailIdKey = normalizeTrailIdKey(trail.id);
  if (!trailIdKey) {
    loading.textContent =
      "Photo gallery needs a trail id from the server (this trail has none).";
    return;
  }

  const fromViewport = lastViewportTrailPhotos.filter(
    (p) => p.trailId != null && normalizeTrailIdKey(p.trailId) === trailIdKey
  );

  try {
    const fromApi = await fetchTrailPhotosByTrailFromBridge(trail.id, 80);
    const merged = mergeTrailPhotosForGallery(
      trailIdKey,
      fromApi,
      fromViewport
    );
    renderTrailPhotoGalleryInto(bodyEl, merged);
  } catch (_) {
    if (fromViewport.length > 0) {
      renderTrailPhotoGalleryInto(bodyEl, fromViewport);
    } else {
      loading.textContent = "Could not load photos.";
    }
  }
}

/** Stats, notes, network, photo gallery, and comments (shared by the in-map drawer). */
function appendTrailDetailMainSections(host, trail) {
  const stats = document.createElement("p");
  const diff =
    trail.difficulty && trail.difficulty !== "not_set"
      ? trail.difficulty
      : "unrated";
  const dist =
    typeof trail.distanceKm === "number"
      ? `${Number(trail.distanceKm).toFixed(1)} km`
      : "";
  const gain =
    typeof trail.elevationGainFt === "number"
      ? `${Math.round(trail.elevationGainFt)} ft gain`
      : "";
  const dir =
    trail.direction && trail.direction !== "not_set" ? trail.direction : "";
  stats.textContent = [diff, dist, gain, dir].filter(Boolean).join(" · ");
  Object.assign(stats.style, {
    margin: "0 0 12px",
    fontSize: "14px",
    color: "rgba(244,244,245,0.85)"
  });
  host.appendChild(stats);

  if (trail.notes) {
    const notes = document.createElement("p");
    notes.textContent = trail.notes;
    Object.assign(notes.style, {
      margin: "0 0 16px",
      fontSize: "13px",
      fontStyle: "italic",
      color: "rgba(244,244,245,0.75)"
    });
    host.appendChild(notes);
  }

  let netName;
  if (trail.id != null && cachedNetworks?.length) {
    const tid = String(trail.id);
    for (const n of cachedNetworks) {
      if ((n.trailIds || []).some((id) => String(id) === tid)) {
        netName = n.name;
        break;
      }
    }
  }
  if (netName) {
    const networkLine = document.createElement("p");
    networkLine.textContent = `Network: ${netName}`;
    Object.assign(networkLine.style, {
      margin: "0 0 16px",
      fontSize: "12px",
      color: "rgba(244,244,245,0.55)"
    });
    host.appendChild(networkLine);
  }

  const secPhotos = document.createElement("div");
  const hP = document.createElement("div");
  hP.textContent = "Trail photos";
  Object.assign(hP.style, {
    fontWeight: "600",
    fontSize: "13px",
    marginBottom: "6px"
  });
  secPhotos.appendChild(hP);
  const galleryBody = document.createElement("div");
  galleryBody.className = "trail-overlay-gallery-body";
  Object.assign(galleryBody.style, {
    marginBottom: "0",
    minHeight: "36px"
  });
  secPhotos.appendChild(galleryBody);
  host.appendChild(secPhotos);
  void loadTrailPhotoGalleryInto(galleryBody, trail);

  const secCom = document.createElement("div");
  const hC = document.createElement("div");
  hC.textContent = "Comments";
  Object.assign(hC.style, {
    fontWeight: "600",
    fontSize: "13px",
    marginBottom: "6px"
  });
  secCom.appendChild(hC);
  const pC = document.createElement("p");
  pC.textContent = "Coming soon.";
  Object.assign(pC.style, {
    fontSize: "12px",
    margin: "0 0 16px",
    color: "rgba(244,244,245,0.55)"
  });
  secCom.appendChild(pC);
  host.appendChild(secCom);
}

/**
 * Large centered modal over the Mapbox map (dimmed backdrop; click backdrop to close).
 * Keeps line highlight via featureId while open; clears on close.
 */
function openTrailInfoDrawer(map, trail, opts) {
  const focusReturnEl = opts?.focusReturnEl ?? null;
  const featureId = opts?.featureId;
  if (!map || !featureId) return;

  closeTrailInfoDrawer();
  cancelScheduleClearDockHighlight();
  setDockLineHighlight(map, featureId);

  const container = getTrailOverlayMapDomContainer(map);
  if (!container) return;

  const font =
    'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, sans-serif';

  const drawer = document.createElement("div");
  drawer.id = TRAIL_INFO_DRAWER_ID;
  drawer.__trailOverlayMap = map;
  drawer.setAttribute("role", "dialog");
  drawer.setAttribute("aria-modal", "true");
  drawer.setAttribute("aria-labelledby", "trail-overlay-drawer-title");
  Object.assign(drawer.style, {
    position: "absolute",
    inset: "0",
    zIndex: String(TRAIL_INFO_DRAWER_Z),
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding:
      "max(12px, env(safe-area-inset-top, 0px)) max(12px, env(safe-area-inset-right, 0px)) max(12px, env(safe-area-inset-bottom, 0px)) max(12px, env(safe-area-inset-left, 0px))",
    fontFamily: font,
    pointerEvents: "auto",
    background: "rgba(0,0,0,0.52)",
    backdropFilter: "blur(3px)"
  });
  drawer.addEventListener("click", (e) => {
    if (e.target === drawer) closeTrailInfoDrawer();
  });

  const inner = document.createElement("div");
  inner.className = "trail-overlay-drawer-inner";
  Object.assign(inner.style, {
    flex: "0 1 auto",
    minHeight: "0",
    width: "min(720px, calc(100% - 8px))",
    maxWidth: "100%",
    display: "flex",
    flexDirection: "column",
    margin: "0",
    background: "rgba(18,18,20,0.97)",
    color: "#f4f4f5",
    borderRadius: "14px",
    border: "1px solid rgba(255,255,255,0.14)",
    boxShadow: "0 24px 72px rgba(0,0,0,0.55)",
    backdropFilter: "blur(10px)",
    overflow: "hidden",
    boxSizing: "border-box"
  });
  inner.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  const header = document.createElement("div");
  Object.assign(header.style, {
    flex: "0 0 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    padding: "12px 14px",
    borderBottom: "1px solid rgba(255,255,255,0.1)"
  });

  const title = document.createElement("h2");
  title.id = "trail-overlay-drawer-title";
  title.textContent = trail.name || "Trail";
  Object.assign(title.style, {
    margin: "0",
    fontSize: "18px",
    fontWeight: "700",
    lineHeight: "1.25",
    flex: "1",
    minWidth: "0",
    overflow: "hidden",
    wordBreak: "break-word"
  });
  title.style.setProperty("display", "-webkit-box");
  title.style.setProperty("-webkit-box-orient", "vertical");
  title.style.setProperty("-webkit-line-clamp", "2");
  header.appendChild(title);

  const bmHeaderBtn = document.createElement("button");
  bmHeaderBtn.type = "button";
  bmHeaderBtn.setAttribute("data-trail-overlay-drawer-bookmark", "1");
  bmHeaderBtn.textContent = bookmarkedTrailIds.has(String(featureId))
    ? "★"
    : "☆";
  bmHeaderBtn.setAttribute(
    "aria-label",
    bookmarkedTrailIds.has(String(featureId))
      ? "Remove bookmark"
      : "Bookmark trail"
  );
  Object.assign(bmHeaderBtn.style, {
    flex: "0 0 auto",
    width: "36px",
    height: "36px",
    padding: "0",
    fontSize: "18px",
    lineHeight: "34px",
    cursor: "pointer",
    borderRadius: "8px",
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.08)",
    color: "#fff"
  });
  bmHeaderBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    void toggleBookmarkForFeatureId(map, featureId);
  });
  header.appendChild(bmHeaderBtn);

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Close trail details");
  closeBtn.textContent = "×";
  Object.assign(closeBtn.style, {
    flex: "0 0 auto",
    width: "36px",
    height: "36px",
    padding: "0",
    fontSize: "22px",
    lineHeight: "34px",
    cursor: "pointer",
    borderRadius: "8px",
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.08)",
    color: "#fff"
  });
  closeBtn.addEventListener("click", () => closeTrailInfoDrawer());
  header.appendChild(closeBtn);

  const scroll = document.createElement("div");
  Object.assign(scroll.style, {
    flex: "1",
    minHeight: "0",
    overflowY: "auto",
    overscrollBehavior: "contain",
    padding: "14px 16px 20px",
    WebkitOverflowScrolling: "touch"
  });
  appendTrailDetailMainSections(scroll, trail);

  inner.appendChild(header);
  inner.appendChild(scroll);
  drawer.appendChild(inner);
  drawer.__trailOverlayFeatureId = featureId;
  container.appendChild(drawer);

  const applyDrawerEdgeInsets = () => {
    const cr = container.getBoundingClientRect();
    const pad = 28;
    const bottomReserve = measureTrailDockBottomReservePx();
    const maxH = Math.max(300, Math.floor(cr.height - pad - bottomReserve));
    const maxW = Math.max(300, Math.floor(cr.width - 16));
    inner.style.maxHeight = `${maxH}px`;
    inner.style.width = `min(720px, ${maxW}px)`;
  };
  drawer.__trailOverlayApplyInsets = applyDrawerEdgeInsets;
  applyDrawerEdgeInsets();
  requestAnimationFrame(() => {
    applyDrawerEdgeInsets();
    requestAnimationFrame(applyDrawerEdgeInsets);
  });
  const resizeHandler = () => applyDrawerEdgeInsets();
  drawer.__trailOverlayResizeHandler = resizeHandler;
  window.addEventListener("resize", resizeHandler);

  drawer.__trailOverlayRestoreFocus =
    document.activeElement &&
    document.activeElement !== document.body &&
    typeof document.activeElement.focus === "function"
      ? document.activeElement
      : focusReturnEl;

  const escHandler = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeTrailInfoDrawer();
    }
  };
  drawer.__trailOverlayEscHandler = escHandler;
  document.addEventListener("keydown", escHandler);

  closeBtn.focus({ preventScroll: true });
  cancelScheduleClearDockHighlight();
  setDockLineHighlight(map, featureId);
}

function trailDockThumbUrlForTrail(trail) {
  const tidKey =
    trail.id != null && String(trail.id).length > 0
      ? normalizeTrailIdKey(trail.id)
      : null;
  if (tidKey && trailPhotoPreviewByTrailId.has(tidKey)) {
    return trailPhotoPreviewByTrailId.get(tidKey);
  }
  return null;
}

function trailDockStripFullSignature(inViewCount, capped, overflow) {
  const rows = capped.map(({ trail, index }) => {
    const fid = trailMapFeatureId(trail, index);
    const thumb = trailDockThumbUrlForTrail(trail) || "";
    const name = trail.name || "Trail";
    const diff = trail.difficulty || "not_set";
    return `${fid}\t${name}\t${thumb}\t${diff}`;
  });
  return `iv=${inViewCount};ov=${overflow};` + rows.join("|");
}

function trailDockStripIdSignature(inViewCount, capped, overflow) {
  const ids = capped.map(({ trail, index }) => trailMapFeatureId(trail, index));
  return `iv=${inViewCount};ov=${overflow};` + ids.join("|");
}

/**
 * When a trail has no preview photo, show ski-style difficulty shapes (circle / square / diamond(s)).
 */
function fillDifficultyIconPlaceholder(thumbWrap, difficulty) {
  const d =
    difficulty && typeof difficulty === "string" ? difficulty : "not_set";
  const row = document.createElement("div");
  row.setAttribute("role", "img");
  row.setAttribute(
    "aria-label",
    d === "easy"
      ? "Green circle, easy difficulty"
      : d === "intermediate"
        ? "Blue square, intermediate difficulty"
        : d === "hard"
          ? "Black diamond, hard difficulty"
          : d === "pro"
            ? "Double black diamond, pro difficulty"
            : "Difficulty not set"
  );
  Object.assign(row.style, {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
    gap: "5px",
    pointerEvents: "none"
  });

  const diamond = (sizePx) => {
    const el = document.createElement("div");
    Object.assign(el.style, {
      width: `${sizePx}px`,
      height: `${sizePx}px`,
      background: "#1c1b22",
      border: "1.5px solid rgba(244,244,245,0.85)",
      boxSizing: "border-box",
      transform: "rotate(45deg)",
      borderRadius: "1px",
      flexShrink: "0"
    });
    return el;
  };

  if (d === "easy") {
    const c = document.createElement("div");
    Object.assign(c.style, {
      width: "24px",
      height: "24px",
      borderRadius: "50%",
      background: "#34a56d",
      border: "2px solid rgba(255,255,255,0.45)",
      boxSizing: "border-box",
      flexShrink: "0"
    });
    row.appendChild(c);
  } else if (d === "intermediate") {
    const s = document.createElement("div");
    Object.assign(s.style, {
      width: "22px",
      height: "22px",
      borderRadius: "3px",
      background: "#156be8",
      border: "2px solid rgba(255,255,255,0.45)",
      boxSizing: "border-box",
      flexShrink: "0"
    });
    row.appendChild(s);
  } else if (d === "hard") {
    row.appendChild(diamond(13));
  } else if (d === "pro") {
    row.appendChild(diamond(11));
    row.appendChild(diamond(11));
  } else {
    const c = document.createElement("div");
    Object.assign(c.style, {
      width: "22px",
      height: "22px",
      borderRadius: "50%",
      background: "rgba(120,120,132,0.85)",
      border: "2px dashed rgba(255,255,255,0.35)",
      boxSizing: "border-box",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "11px",
      fontWeight: "700",
      color: "rgba(255,255,255,0.65)"
    });
    c.textContent = "?";
    row.appendChild(c);
  }

  thumbWrap.appendChild(row);
}

/**
 * @param trail Optional trail row — used for difficulty placeholder when `thumbUrl` is empty.
 * @param opts Optional `{ variant: "toast" }` for bookmark stack (taller slot).
 */
function fillTrailDockThumbWrap(thumbWrap, thumbUrl, trail, opts) {
  thumbWrap.replaceChildren();
  const isToast = opts?.variant === "toast";
  Object.assign(thumbWrap.style, {
    width: "100%",
    height: isToast ? "100%" : "44px",
    minHeight: isToast ? "52px" : "",
    background: "rgba(60,60,68,0.9)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  });
  if (thumbUrl) {
    const img = document.createElement("img");
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.src = thumbUrl;
    Object.assign(img.style, {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      display: "block"
    });
    thumbWrap.appendChild(img);
  } else {
    fillDifficultyIconPlaceholder(
      thumbWrap,
      trail && typeof trail === "object" ? trail.difficulty : null
    );
  }
}

function attachTrailDockCardListeners(map, card, featureId, trail) {
  card.addEventListener("pointerenter", () => {
    setDockLineHighlight(map, featureId);
  });
  card.addEventListener("pointerleave", () => {
    const dr = document.getElementById(TRAIL_INFO_DRAWER_ID);
    if (
      dr &&
      dr.__trailOverlayFeatureId != null &&
      dr.__trailOverlayFeatureId === featureId
    ) {
      return;
    }
    scheduleClearDockLineHighlight(map);
  });
  card.addEventListener("focus", () => {
    setDockLineHighlight(map, featureId);
  });
  card.addEventListener("blur", () => {
    const dr = document.getElementById(TRAIL_INFO_DRAWER_ID);
    if (
      dr &&
      dr.__trailOverlayFeatureId != null &&
      dr.__trailOverlayFeatureId === featureId
    ) {
      return;
    }
    scheduleClearDockLineHighlight(map);
  });
  card.addEventListener("click", () => {
    openTrailInfoDrawer(map, trail, { focusReturnEl: card, featureId });
  });
}

function attachBookmarkCardHighlightListeners(map, card, featureId) {
  if (!card || !featureId) return;
  const enter = () => setDockLineHighlight(map, featureId);
  const leave = () => {
    const dr = document.getElementById(TRAIL_INFO_DRAWER_ID);
    if (dr && dr.__trailOverlayFeatureId != null && dr.__trailOverlayFeatureId === featureId) {
      return;
    }
    scheduleClearDockLineHighlight(map);
  };
  card.addEventListener("pointerenter", enter);
  card.addEventListener("pointerleave", leave);
  card.addEventListener("focus", enter);
  card.addEventListener("blur", leave);
}

function createSonnerTrailListRow(map, trail, index) {
  const featureId = trailMapFeatureId(trail, index);
  const thumbUrl = trailDockThumbUrlForTrail(trail);

  const row = document.createElement("div");
  row.className = "trail-overlay-sonner-trail-row";
  row.setAttribute("data-feature-id", featureId);
  row.setAttribute("role", "listitem");
  Object.assign(row.style, {
    display: "flex",
    flexDirection: "row",
    alignItems: "stretch",
    flexShrink: "0",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(22,22,26,0.96)",
    overflow: "hidden",
    minHeight: "52px"
  });

  const main = document.createElement("div");
  main.className = "trail-overlay-sonner-trail-main";
  main.setAttribute("role", "button");
  main.setAttribute("tabindex", "0");
  Object.assign(main.style, {
    flex: "1",
    minWidth: "0",
    display: "flex",
    flexDirection: "row",
    alignItems: "stretch",
    cursor: "pointer",
    textAlign: "left",
    color: "#f4f4f5"
  });

  const thumbWrap = document.createElement("div");
  thumbWrap.className = "trail-overlay-sonner-trail-thumb";
  Object.assign(thumbWrap.style, {
    width: "52px",
    flex: "0 0 52px",
    background: "rgba(60,60,68,0.9)"
  });
  fillTrailDockThumbWrap(thumbWrap, thumbUrl, trail, { variant: "toast" });

  const mid = document.createElement("div");
  Object.assign(mid.style, {
    flex: "1",
    minWidth: "0",
    padding: "8px 8px 8px 6px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: "2px"
  });
  const titleEl = document.createElement("div");
  titleEl.className = "trail-overlay-sonner-trail-title";
  titleEl.textContent = trail.name || "Trail";
  Object.assign(titleEl.style, {
    fontSize: "13px",
    fontWeight: "600",
    lineHeight: "1.25",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  });
  const sub = document.createElement("div");
  sub.className = "trail-overlay-sonner-trail-sub";
  sub.textContent = `${Number(trail.distanceKm ?? 0).toFixed(1)} km`;
  Object.assign(sub.style, {
    fontSize: "11px",
    color: "rgba(244,244,245,0.55)"
  });
  mid.appendChild(titleEl);
  mid.appendChild(sub);

  main.appendChild(thumbWrap);
  main.appendChild(mid);
  main.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openTrailInfoDrawer(map, trail, { focusReturnEl: main, featureId });
    }
  });
  attachTrailDockCardListeners(map, main, featureId, trail);

  const bmBtn = document.createElement("button");
  bmBtn.type = "button";
  bmBtn.className = "trail-overlay-sonner-trail-bm";
  Object.assign(bmBtn.style, {
    flex: "0 0 40px",
    width: "40px",
    border: "none",
    borderLeft: "1px solid rgba(255,255,255,0.1)",
    margin: "0",
    padding: "0",
    cursor: "pointer",
    fontSize: "16px",
    lineHeight: "1",
    color: "#fff",
    background: "rgba(255,255,255,0.06)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  });
  bmBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    void toggleBookmarkForFeatureId(map, featureId);
  });
  updateDockCardBookmarkStar(bmBtn, featureId);

  row.appendChild(main);
  row.appendChild(bmBtn);
  return row;
}

function applyTrailDockOverflowLine(more, overflow) {
  if (overflow > 0) {
    more.style.display = "block";
    more.textContent = `+ ${overflow} more trails in view`;
  } else {
    more.style.display = "none";
    more.textContent = "";
  }
}

function sonnerTrailScrollDistanceFromEnd(scrollEl) {
  if (!scrollEl || scrollEl.clientHeight < 1) return 0;
  return Math.max(
    0,
    scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight
  );
}

function sonnerTrailScrollSetDistanceFromEnd(scrollEl, distFromEnd) {
  if (!scrollEl) return;
  scrollEl.scrollTop = Math.max(
    0,
    scrollEl.scrollHeight - scrollEl.clientHeight - distFromEnd
  );
}

/** Safari-style stacked tabs: each card overlaps the one below; scroll pinned to newest (bottom). */
function layoutBookmarkCardStackOverlap(stack) {
  if (!stack) return;
  if (stack.getAttribute("data-trail-overlay-expanded") === "1") return;
  const cards = [...stack.querySelectorAll("[data-bookmark-feature-id]")];
  cards.forEach((card, i) => {
    card.style.position = "relative";
    card.style.zIndex = String(100 + i);
    card.style.marginTop = i === 0 ? "0" : `-${BOOKMARK_CARD_OVERLAP_PX}px`;
  });
  requestAnimationFrame(() => {
    stack.scrollTop = Math.max(0, stack.scrollHeight - stack.clientHeight);
  });
}

function setSonnerBookmarkHoverMode(panel, on) {
  if (!panel) return;
  const trailsCol = panel.querySelector(".trail-overlay-sonner-trails-col");
  const divider = panel.querySelector(".trail-overlay-sonner-divider");
  const stack = panel.querySelector(".trail-overlay-sonner-bookmarks");
  if (!stack) return;
  if (panel.getAttribute("data-trail-overlay-minimized") === "1") return;
  // When hovering bookmarks we want the cover to act like the entry card only.
  const cover = stack.querySelector(".trail-overlay-sonner-bookmarks-cover");

  if (on) {
    panel.setAttribute("data-trail-overlay-bm-hover", "1");
    stack.setAttribute("data-trail-overlay-expanded", "1");
    if (trailsCol) trailsCol.style.display = "none";
    if (divider) divider.style.display = "none";

    // Take over the panel height and unstack the cards.
    stack.style.flex = "1";
    stack.style.maxHeight = "none";
    stack.style.gap = "8px";
    stack.style.paddingTop = "10px";
    stack.style.paddingBottom = "12px";
    if (cover) {
      cover.style.marginBottom = "10px";
      const hint = cover.querySelector(".trail-overlay-sonner-bookmarks-cover-hint");
      if (hint) hint.textContent = "Bookmarks";
    }

    const cards = [...stack.querySelectorAll("[data-bookmark-feature-id]")];
    cards.forEach((card, i) => {
      card.style.marginTop = "0";
      card.style.zIndex = String(200 + i);
    });
    return;
  }

  panel.removeAttribute("data-trail-overlay-bm-hover");
  stack.removeAttribute("data-trail-overlay-expanded");
  if (trailsCol) trailsCol.style.display = "flex";
  if (divider) divider.style.display = "block";

  // Restore overlap style.
  stack.style.flex = "0 1 auto";
  stack.style.gap = "0";
  stack.style.paddingTop = "6px";
  stack.style.paddingBottom = "10px";
  if (cover) {
    cover.style.marginBottom = "6px";
    const hint = cover.querySelector(".trail-overlay-sonner-bookmarks-cover-hint");
    if (hint) hint.textContent = "Hover to open";
  }
  layoutBookmarkCardStackOverlap(stack);
  refreshSonnerPanelLayout(trailOverlayMapRef);
}

function setSonnerPanelMinimized(panel, on) {
  if (!panel) return;
  const trailsCol = panel.querySelector(".trail-overlay-sonner-trails-col");
  const divider = panel.querySelector(".trail-overlay-sonner-divider");
  const stack = panel.querySelector(".trail-overlay-sonner-bookmarks");
  const toggleBtn = panel.querySelector("[data-trail-overlay-minimize-btn]");
  if (!stack) return;

  if (on) {
    panel.setAttribute("data-trail-overlay-minimized", "1");
    if (trailsCol) trailsCol.style.display = "none";
    if (divider) divider.style.display = "none";
    stack.style.flex = "0 0 auto";
    stack.style.maxHeight = "92px";
    stack.style.overflowY = "auto";
    stack.style.paddingTop = "6px";
    stack.style.paddingBottom = "10px";
    stack.style.gap = "0";
    layoutBookmarkCardStackOverlap(stack);
    if (toggleBtn) toggleBtn.textContent = "▴";
    return;
  }

  panel.removeAttribute("data-trail-overlay-minimized");
  if (trailsCol) trailsCol.style.display = "flex";
  if (divider) divider.style.display = "block";
  stack.style.flex = "0 1 auto";
  stack.style.gap = "0";
  if (toggleBtn) toggleBtn.textContent = "▾";
  refreshSonnerPanelLayout(trailOverlayMapRef);
  layoutBookmarkCardStackOverlap(stack);
}

function ensureBookmarksCover(stack) {
  if (!stack) return null;
  let cover = stack.querySelector(".trail-overlay-sonner-bookmarks-cover");
  if (cover) return cover;
  cover = document.createElement("div");
  cover.className = "trail-overlay-sonner-bookmarks-cover";
  Object.assign(cover.style, {
    position: "sticky",
    top: "0",
    zIndex: "500",
    height: "40px",
    margin: "0 0 6px",
    display: "flex",
    alignItems: "center",
    pointerEvents: "auto",
    backdropFilter: "blur(8px)",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(22,22,26,0.92)",
    boxShadow: "0 6px 20px rgba(0,0,0,0.35)",
    cursor: "pointer"
  });
  const label = document.createElement("div");
  label.textContent = "Bookmarks";
  Object.assign(label.style, {
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "rgba(244,244,245,0.72)",
    paddingLeft: "10px",
    flex: "1",
    minWidth: "0",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  });
  const hint = document.createElement("div");
  hint.className = "trail-overlay-sonner-bookmarks-cover-hint";
  hint.textContent = "Hover to open";
  Object.assign(hint.style, {
    fontSize: "11px",
    color: "rgba(244,244,245,0.45)",
    paddingRight: "10px",
    flex: "0 0 auto"
  });
  cover.appendChild(label);
  cover.appendChild(hint);
  stack.prepend(cover);
  return cover;
}

function updateTrailDockCore(map) {
  const existingPanel = document.getElementById(TRAIL_SONNER_PANEL_ID);

  if (!map || !overlayEnabled) {
    clearDockLineHighlight(map);
    if (map) {
      map.__trailOverlayDockFullSig = null;
      map.__trailOverlayDockIdSig = null;
    }
    if (existingPanel) {
      const sc = existingPanel.querySelector(".trail-overlay-sonner-trails-scroll");
      if (sc) sc.replaceChildren();
      const moreEl = existingPanel.querySelector(".trail-overlay-sonner-trails-more");
      if (moreEl) applyTrailDockOverflowLine(moreEl, 0);
    }
    updateSonnerPanelDisplayVisibility(map);
    return;
  }

  if (
    !overlayTrailsVisible ||
    !cachedTrails?.length ||
    !map.getSource(SOURCE_ID)
  ) {
    clearDockLineHighlight(map);
    if (map) {
      map.__trailOverlayDockFullSig = null;
      map.__trailOverlayDockIdSig = null;
    }
    if (existingPanel) {
      const scroll = existingPanel.querySelector(".trail-overlay-sonner-trails-scroll");
      if (scroll) scroll.replaceChildren();
      const moreEl = existingPanel.querySelector(".trail-overlay-sonner-trails-more");
      if (moreEl) applyTrailDockOverflowLine(moreEl, 0);
    }
    updateSonnerPanelDisplayVisibility(map);
    return;
  }

  const root = ensureSonnerPanelRoot(map);
  if (!root) {
    updateSonnerPanelDisplayVisibility(map);
    return;
  }

  const scroll = root.querySelector(".trail-overlay-sonner-trails-scroll");
  const more = root.querySelector(".trail-overlay-sonner-trails-more");
  if (!scroll || !more) return;

  const inView = getTrailsInViewport(map, cachedTrails);
  const capped = inView.slice(0, TRAIL_SONNER_LIST_MAX);
  const overflow = inView.length - capped.length;

  const fullSig = trailDockStripFullSignature(inView.length, capped, overflow);
  if (fullSig === map.__trailOverlayDockFullSig) {
    applyTrailDockOverflowLine(more, overflow);
    updateSonnerPanelDisplayVisibility(map);
    if (inView.length === 0) clearDockLineHighlight(map);
    return;
  }

  const idSig = trailDockStripIdSignature(inView.length, capped, overflow);
  const prevDistFromEnd = sonnerTrailScrollDistanceFromEnd(scroll);

  if (
    idSig === map.__trailOverlayDockIdSig &&
    scroll.children.length === capped.length &&
    capped.length > 0
  ) {
    let structureOk = true;
    for (let i = 0; i < capped.length; i++) {
      const { trail, index } = capped[i];
      const featureId = trailMapFeatureId(trail, index);
      const row = scroll.children[i];
      if (
        !row ||
        row.getAttribute("data-feature-id") !== featureId ||
        !row.classList.contains("trail-overlay-sonner-trail-row")
      ) {
        structureOk = false;
        break;
      }
      const thumbUrl = trailDockThumbUrlForTrail(trail);
      const thumbWrap = row.querySelector(".trail-overlay-sonner-trail-thumb");
      if (thumbWrap) {
        fillTrailDockThumbWrap(thumbWrap, thumbUrl, trail, { variant: "toast" });
      }
      const titleEl = row.querySelector(".trail-overlay-sonner-trail-title");
      if (titleEl) titleEl.textContent = trail.name || "Trail";
      const subEl = row.querySelector(".trail-overlay-sonner-trail-sub");
      if (subEl) {
        subEl.textContent = `${Number(trail.distanceKm ?? 0).toFixed(1)} km`;
      }
      const bm = row.querySelector(".trail-overlay-sonner-trail-bm");
      if (bm) updateDockCardBookmarkStar(bm, featureId);
    }
    if (structureOk) {
      map.__trailOverlayDockFullSig = fullSig;
      sonnerTrailScrollSetDistanceFromEnd(scroll, prevDistFromEnd);
      applyTrailDockOverflowLine(more, overflow);
      updateSonnerPanelDisplayVisibility(map);
      if (inView.length === 0) clearDockLineHighlight(map);
      return;
    }
  }

  scroll.replaceChildren();
  for (const { trail, index } of capped) {
    scroll.appendChild(createSonnerTrailListRow(map, trail, index));
  }

  map.__trailOverlayDockFullSig = fullSig;
  map.__trailOverlayDockIdSig = idSig;
  sonnerTrailScrollSetDistanceFromEnd(scroll, prevDistFromEnd);

  applyTrailDockOverflowLine(more, overflow);

  updateSonnerPanelDisplayVisibility(map);
  if (inView.length === 0) {
    clearDockLineHighlight(map);
  }
}

function updateTrailDock(map) {
  updateTrailDockCore(map);
  refreshTrailInfoDrawerLayoutIfOpen();
}

function scheduleTrailDockRefresh(map) {
  if (!map) return;
  clearTimeout(dockRefreshTimer);
  dockRefreshTimer = setTimeout(() => {
    dockRefreshTimer = null;
    updateTrailDock(map);
  }, 400);
}

// Find the <ul> inside Strava's "Map display" section, then wait 500 ms for it to
// stop changing before resolving — so we inject after the sidebar has settled.
function waitForMapDisplayUl(timeoutMs = 10000) {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    let settleTimer = null;

    const findUl = () => {
      for (const h4 of document.querySelectorAll("h4")) {
        if (h4.textContent.trim().toLowerCase() === "map display") {
          const section =
            h4.closest('[class*="RoutePreferenceSidebar_section"]') ||
            h4.parentElement;
          const ul = section?.querySelector("ul");
          if (ul?.querySelector("li")) return ul;
        }
      }
      return null;
    };

    const poll = setInterval(() => {
      const ul = findUl();
      if (ul) {
        clearInterval(poll);
        // Wait for sidebar to stop mutating before we inject
        clearTimeout(settleTimer);
        const observer = new MutationObserver(() => {
          clearTimeout(settleTimer);
          settleTimer = setTimeout(() => {
            observer.disconnect();
            resolve(ul);
          }, 500);
        });
        observer.observe(ul, {
          childList: true,
          subtree: true,
          attributes: true
        });
        // Kick off the timer in case there are no mutations at all
        settleTimer = setTimeout(() => {
          observer.disconnect();
          resolve(ul);
        }, 500);
      } else if (Date.now() > deadline) {
        clearInterval(poll);
        resolve(null);
      }
    }, 300);
  });
}

async function injectToggle(map, enabled) {
  document.getElementById("trail-overlay-toggle-li")?.remove();

  const onChange = async (on) => {
    await setEnabled(on);
    overlayEnabled = on;
    if (on) {
      applyMapLayersFromPrefs(map, {
        enabled: true,
        trailsVisible: overlayTrailsVisible,
        networksVisible: overlayNetworksVisible,
        photosVisible: overlayTrailPhotosVisible,
        bookmarkHighlightColor: overlayBookmarkHighlightColor
      });
    } else {
      removeLayers(map);
    }
  };

  const ul = await waitForMapDisplayUl();
  if (!ul) {
    return;
  }

  // Clone the first <li> so we inherit all of Strava's CSS module classes
  const li = ul.querySelector("li").cloneNode(true);
  li.id = "trail-overlay-toggle-li";

  // Swap icon for a simple trail/mountain SVG
  const existingIcon = li.querySelector("label > div > svg, label > div > img");
  if (existingIcon) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("fill", "currentColor");
    // Simple mountain/trail path
    svg.innerHTML = '<path d="M8 2L2 13h12L8 2zm0 2.8L12.2 12H3.8L8 4.8z"/>';
    existingIcon.replaceWith(svg);
  }

  // Update label text (the innermost span inside the content div)
  const textSpan = li.querySelector("label > div > span");
  if (textSpan) textSpan.textContent = "Trail Overlay";

  // Remove conflicting id/name/for attributes
  li.querySelector("label")?.removeAttribute("for");
  const input = li.querySelector('input[type="checkbox"]');
  if (input) {
    input.removeAttribute("id");
    input.removeAttribute("name");
  }

  // Detect the "active" modifier class from any currently-active switch
  const activeSwitch = ul.querySelector(
    'span[role="checkbox"][aria-checked="true"]'
  );
  const activeClass = activeSwitch
    ? [...activeSwitch.classList].find((c) => /active/i.test(c))
    : null;

  // Apply initial enabled state
  const switchSpan = li.querySelector('span[role="checkbox"]');
  if (switchSpan) {
    const applyState = (on) => {
      if (activeClass) switchSpan.classList.toggle(activeClass, on);
      switchSpan.setAttribute("aria-checked", String(on));
      if (input) input.checked = on;
    };
    applyState(enabled);

    const toggle = () => {
      const nowOn = switchSpan.getAttribute("aria-checked") !== "true";
      applyState(nowOn);
      onChange(nowOn);
    };
    switchSpan.addEventListener("click", toggle);
    switchSpan.addEventListener("keydown", (e) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        toggle();
      }
    });
  }

  ul.appendChild(li);
}

function normalizeOverlayPrefs(prefs) {
  const raw =
    typeof prefs.bookmarkHighlightColor === "string" &&
    prefs.bookmarkHighlightColor.trim().length > 0
      ? prefs.bookmarkHighlightColor.trim()
      : DEFAULT_OVERLAY_PREFS.bookmarkHighlightColor;
  return {
    enabled: prefs.enabled !== false,
    trailsVisible: prefs.trailsVisible !== false,
    networksVisible: prefs.networksVisible !== false,
    photosVisible: prefs.photosVisible !== false,
    bookmarkHaloHex: resolveBookmarkHaloLineColor(raw)
  };
}

function overlayPrefsShallowEqual(a, b) {
  return (
    a.enabled === b.enabled &&
    a.trailsVisible === b.trailsVisible &&
    a.networksVisible === b.networksVisible &&
    a.photosVisible === b.photosVisible &&
    a.bookmarkHaloHex === b.bookmarkHaloHex
  );
}

/** True when Mapbox still has the sources/layers this pref set expects. */
function overlayMapMatchesPrefs(map, n) {
  const trailOk =
    !n.trailsVisible || (map.getSource(SOURCE_ID) && map.getLayer(LAYER_ID));
  const netOk =
    !n.networksVisible ||
    (map.getSource(NETWORK_SOURCE_ID) && map.getLayer(NETWORK_FILL_LAYER));
  return trailOk && netOk;
}

/** Keep Strava sidebar switch in sync when overlayEnabled changes from the extension popup. */
function syncStravaMapDisplayToggle(enabled) {
  const li = document.getElementById("trail-overlay-toggle-li");
  if (!li) return;
  const ul = li.closest("ul");
  const activeSwitch = ul?.querySelector(
    'span[role="checkbox"][aria-checked="true"]'
  );
  const activeClass = activeSwitch
    ? [...activeSwitch.classList].find((c) => /active/i.test(c))
    : null;
  const switchSpan = li.querySelector('span[role="checkbox"]');
  const input = li.querySelector('input[type="checkbox"]');
  if (!switchSpan) return;
  if (activeClass) switchSpan.classList.toggle(activeClass, enabled);
  switchSpan.setAttribute("aria-checked", String(enabled));
  if (input) input.checked = enabled;
}

/** Add/remove trail and network layers according to prefs (master + per-asset). */
function applyMapLayersFromPrefs(map, prefs) {
  if (!map) return;
  const n = normalizeOverlayPrefs(prefs);
  overlayBookmarkHaloHex = n.bookmarkHaloHex;
  applyBookmarkHaloPaintIfNeeded(map);

  if (!n.enabled) {
    map.__trailOverlayLastAppliedPrefs = { ...n };
    removeLayers(map);
    return;
  }

  const prev = map.__trailOverlayLastAppliedPrefs;
  if (
    prev &&
    overlayPrefsShallowEqual(prev, n) &&
    overlayMapMatchesPrefs(map, n)
  ) {
    scheduleTrailDockRefresh(map);
    syncBookmarkToastStack(map);
    return;
  }

  if (cachedTrails == null || cachedNetworks == null) {
    closeTrailInfoDrawer();
    stripTrailLineLayersFromMap(map);
    stripNetworkLayersFromMap(map);
    map.__trailOverlayLastAppliedPrefs = { ...n };
    scheduleTrailDockRefresh(map);
    syncBookmarkToastStack(map);
    return;
  }

  if (n.networksVisible) {
    if (!map.getSource(NETWORK_SOURCE_ID)) {
      addNetworksToMap(map, cachedNetworks);
    }
  } else {
    stripNetworkLayersFromMap(map);
  }

  if (!n.trailsVisible) {
    closeTrailInfoDrawer();
    stripTrailLineLayersFromMap(map);
  } else {
    addTrailsToMap(map, cachedTrails, cachedNetworks);
  }

  if (n.photosVisible) {
    scheduleViewportPhotoPreviewFetch(map);
  } else {
    lastViewportTrailPhotos = [];
    rebuildTrailPhotoPreviewsFromPhotos([]);
  }

  map.__trailOverlayLastAppliedPrefs = { ...n };
  scheduleTrailDockRefresh(map);
  syncBookmarkToastStack(map);
}

/** Sync prefs from storage (popup / other tabs / Strava master switch). */
function applyOverlayPrefsFromMessage(prefs) {
  overlayEnabled = prefs.enabled !== false;
  overlayTrailsVisible = prefs.trailsVisible !== false;
  overlayNetworksVisible = prefs.networksVisible !== false;
  overlayTrailPhotosVisible = prefs.photosVisible !== false;
  if (
    prefs.bookmarkHighlightColor != null &&
    String(prefs.bookmarkHighlightColor).trim().length > 0
  ) {
    overlayBookmarkHighlightColor = String(prefs.bookmarkHighlightColor).trim();
  }
  syncStravaMapDisplayToggle(overlayEnabled);
  const map =
    trailOverlayMapRef && isMapboxLikeMap(trailOverlayMapRef)
      ? trailOverlayMapRef
      : tryFindMap();
  if (!map) return;
  applyMapLayersFromPrefs(map, {
    enabled: overlayEnabled,
    trailsVisible: overlayTrailsVisible,
    networksVisible: overlayNetworksVisible,
    photosVisible: overlayTrailPhotosVisible,
    bookmarkHighlightColor: overlayBookmarkHighlightColor
  });
}

// --- MAIN EXECUTION ---

let cachedTrails = null;
let cachedNetworks = null;

/** Map instance we last drew on (prefs updates must hit the same Mapbox object). */
let trailOverlayMapRef = null;

let extensionInitLogged = false;

async function main() {
  try {
    await fetchApiUrlFromBridge();

    if (!cachedTrails || !cachedNetworks) {
      [cachedTrails, cachedNetworks] = await Promise.all([
        cachedTrails ?? fetchTrails(),
        cachedNetworks ?? fetchNetworks()
      ]);
    }

    const bookmarkIds = await fetchTrailBookmarksFromBridge();
    hydrateBookmarksFromIds(bookmarkIds);

    const [map, prefs] = await Promise.all([
      waitForMap(),
      fetchOverlayPrefsFromBridge()
    ]);
    trailOverlayMapRef = map;
    overlayEnabled = prefs.enabled;
    overlayTrailsVisible = prefs.trailsVisible;
    overlayNetworksVisible = prefs.networksVisible;
    overlayTrailPhotosVisible = prefs.photosVisible !== false;
    overlayBookmarkHighlightColor =
      typeof prefs.bookmarkHighlightColor === "string" &&
      prefs.bookmarkHighlightColor.trim().length > 0
        ? prefs.bookmarkHighlightColor.trim()
        : DEFAULT_OVERLAY_PREFS.bookmarkHighlightColor;
    await waitForStyleLoaded(map);

    if (prefs.enabled) {
      applyMapLayersFromPrefs(map, prefs);
      if (!map.__trailOverlayNudgeAttached) {
        map.__trailOverlayNudgeAttached = true;
        addClickNudge(map);
      }
    }

    if (!map.__trailOverlayViewportPhotoMoveEnd) {
      map.__trailOverlayViewportPhotoMoveEnd = true;
      map.on("moveend", () => {
        scheduleViewportPhotoPreviewFetch(map);
        scheduleTrailDockRefresh(map);
      });
    }

    // Inject toggle once per page load (the MutationObserver inside handles re-renders)
    if (!document.getElementById("trail-overlay-toggle-li")) {
      injectToggle(map, prefs.enabled);
    }

    // Re-add if style reloads (respects current toggle state)
    if (!map.__trailOverlayStyleHook) {
      map.__trailOverlayStyleHook = true;
      map.on("style.load", async () => {
        const next = await fetchOverlayPrefsFromBridge();
        overlayEnabled = next.enabled;
        overlayTrailsVisible = next.trailsVisible;
        overlayNetworksVisible = next.networksVisible;
        overlayTrailPhotosVisible = next.photosVisible !== false;
        overlayBookmarkHighlightColor =
          typeof next.bookmarkHighlightColor === "string" &&
          next.bookmarkHighlightColor.trim().length > 0
            ? next.bookmarkHighlightColor.trim()
            : DEFAULT_OVERLAY_PREFS.bookmarkHighlightColor;
        if (next.enabled) {
          applyMapLayersFromPrefs(map, next);
          restoreOpenTrailInfoDrawerHighlight(map);
          refreshOpenTrailInfoDrawerFromCache();
        } else {
          removeLayers(map);
        }
      });
    }

    if (!extensionInitLogged) {
      extensionInitLogged = true;
      console.log("[TrailOverlay] Initialized");
    }
  } catch (err) {
    alert("[TrailOverlay ERROR] " + (err instanceof Error ? err.message : String(err)));
  }
}

// Run once
main();

window.addEventListener("message", (event) => {
  if (event.data?.[FROM_BRIDGE] !== true) return;

  if (event.data.type === "API_URL_CHANGED") {
    const m =
      trailOverlayMapRef && isMapboxLikeMap(trailOverlayMapRef)
        ? trailOverlayMapRef
        : tryFindMap();
    if (m) {
      m.__trailOverlayLastAppliedPrefs = null;
      m.__trailOverlayDockFullSig = null;
      m.__trailOverlayDockIdSig = null;
    }
    cachedTrails = null;
    cachedNetworks = null;
    main();
    return;
  }

  if (event.data.type === "LAYER_PREFS_CHANGED") {
    applyOverlayPrefsFromMessage({
      enabled: event.data.enabled,
      trailsVisible: event.data.trailsVisible,
      networksVisible: event.data.networksVisible,
      photosVisible: event.data.photosVisible,
      bookmarkHighlightColor: event.data.bookmarkHighlightColor
    });
    return;
  }

  if (event.data.type === "TRAIL_BOOKMARKS_CHANGED") {
    const m =
      trailOverlayMapRef && isMapboxLikeMap(trailOverlayMapRef)
        ? trailOverlayMapRef
        : tryFindMap();
    const ids = Array.isArray(event.data.ids) ? event.data.ids : [];
    if (m) applyExternalBookmarkIds(m, ids);
  }
});

// Re-run on Strava SPA navigation
let lastUrl = location.href;

new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;

    setTimeout(() => {
      main();
    }, 1000);
  }
}).observe(document, { subtree: true, childList: true });
