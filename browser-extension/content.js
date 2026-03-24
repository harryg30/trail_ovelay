// MAIN world, document_idle.
// Strava uses Mapbox GL JS (not Leaflet). Adds trail polylines via addSource/addLayer.
// Coordinates: DB stores [lat, lng]; Mapbox requires [lng, lat].

const DEFAULT_API_URL = "http://localhost:3000";
const SOURCE_ID = "trail-overlay";
const LAYER_ID = "trail-overlay-lines";

const DIFFICULTY_COLORS = {
  easy: "#22c55e",
  intermediate: "#f59e0b",
  hard: "#ef4444",
  not_set: "#94a3b8"
};

function difficultyColor(d) {
  return DIFFICULTY_COLORS[d] ?? DIFFICULTY_COLORS.not_set;
}

function getApiUrl() {
  return localStorage.getItem("trailOverlayApiUrl") || DEFAULT_API_URL;
}

async function fetchTrails(apiUrl) {
  return new Promise((resolve) => {
    window.postMessage({ type: "GET_TRAILS", apiUrl }, "*");

    window.addEventListener("message", function handler(event) {
      if (event.data?.type === "TRAILS_RESPONSE") {
        window.removeEventListener("message", handler);
        resolve(event.data.trails);
      }
    });
  });
}

// --- MAP DETECTION ---

function tryFindMap() {
  if (window._trailOverlayMap) return window._trailOverlayMap;

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
      if (
        v &&
        typeof v === "object" &&
        typeof v.addSource === "function" &&
        typeof v.addLayer === "function" &&
        typeof v.isStyleLoaded === "function"
      ) {
        console.log("[TrailOverlay] Found map at window." + key);
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
        console.warn("[TrailOverlay] Timed out waiting for map");
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
    features: trails.map((trail) => ({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: trail.polyline.map(([lat, lng]) => [lng, lat])
      },
      properties: {
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

// --- MAP RENDERING ---

function addTrailsToMap(map, trails) {
  if (!map) return;

  // Remove old layer if exists
  if (map.getSource(SOURCE_ID)) {
    if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
    map.removeSource(SOURCE_ID);
  }

  map.addSource(SOURCE_ID, {
    type: "geojson",
    data: trailsToGeoJSON(trails)
  });

  map.addLayer({
    id: LAYER_ID,
    type: "line",
    source: SOURCE_ID,
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": ["get", "color"],
      "line-width": 4,
      "line-opacity": 0.85
    }
  });

  // Create floating info panel anchored to bottom-right of the map canvas
  let infoPanel = document.getElementById("trail-overlay-info-panel");
  if (!infoPanel) {
    const canvas = map.getCanvas();
    const container = canvas.closest(".mapboxgl-map") || canvas.parentElement;
    container.style.position = "relative";

    infoPanel = document.createElement("div");
    infoPanel.id = "trail-overlay-info-panel";
    Object.assign(infoPanel.style, {
      position: "absolute",
      bottom: "12px",
      right: "12px",
      background: "rgba(20,20,20,0.85)",
      color: "#fff",
      padding: "10px 14px",
      borderRadius: "8px",
      fontSize: "13px",
      lineHeight: "1.5",
      pointerEvents: "none",
      display: "none",
      maxWidth: "220px",
      zIndex: "9999",
      backdropFilter: "blur(4px)"
    });
    container.appendChild(infoPanel);
  }

  map.on("mousemove", LAYER_ID, (e) => {
    map.getCanvas().style.cursor = "pointer";
    if (!e.features.length) return;

    const p = e.features[0].properties;
    const dir = p.direction && p.direction !== "not_set" ? ` · ${p.direction}` : "";
    const notes = p.notes ? `<br><em style="opacity:0.75">${p.notes}</em>` : "";
    infoPanel.innerHTML =
      `<strong>${p.name}</strong><br>` +
      `${p.difficulty !== "not_set" ? p.difficulty : "unrated"} · ` +
      `${Number(p.distanceKm).toFixed(1)} km · ` +
      `${Math.round(p.elevationGainFt)} ft gain` +
      dir +
      notes;
    infoPanel.style.display = "block";
  });

  map.on("mouseleave", LAYER_ID, () => {
    map.getCanvas().style.cursor = "";
    infoPanel.style.display = "none";
  });

  map.on("click", LAYER_ID, (e) => {
    const p = e.features[0].properties;

    const dir =
      p.direction && p.direction !== "not_set" ? ` · ${p.direction}` : "";

    const notes = p.notes ? `<br><em>${p.notes}</em>` : "";

    const html =
      `<strong>${p.name}</strong><br>` +
      `${p.difficulty !== "not_set" ? p.difficulty : "unrated"} · ` +
      `${Number(p.distanceKm).toFixed(1)} km · ` +
      `${Math.round(p.elevationGainFt)} ft gain` +
      dir +
      notes;

    if (window.mapboxgl) {
      new window.mapboxgl.Popup().setLngLat(e.lngLat).setHTML(html).addTo(map);
    }
  });

  console.log("[TrailOverlay] Trails added to map", trails);
}

// --- MAIN EXECUTION ---

let cachedTrails = null;

async function main() {
  try {
    const apiUrl = getApiUrl();
    console.log("[TrailOverlay] Using API:", apiUrl);

    if (!cachedTrails) {
      cachedTrails = await fetchTrails(apiUrl);
      console.log("[TrailOverlay] Loaded trails:", cachedTrails.length);
    }

    const map = await waitForMap();
    await waitForStyleLoaded(map);

    addTrailsToMap(map, cachedTrails);

    // Re-add if style reloads
    map.on("style.load", () => {
      console.log("[TrailOverlay] Style reloaded, re-adding trails");
      addTrailsToMap(map, cachedTrails);
    });
  } catch (err) {
    console.error("[TrailOverlay ERROR]", err);
    alert("[TrailOverlay ERROR] " + err.message);
  }
}

// Run once
main();

// Re-run on Strava SPA navigation
let lastUrl = location.href;

new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    console.log("[TrailOverlay] Page changed");

    setTimeout(() => {
      main();
    }, 1000);
  }
}).observe(document, { subtree: true, childList: true });
