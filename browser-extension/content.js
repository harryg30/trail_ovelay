// MAIN world, document_idle.
// Strava uses Mapbox GL JS (not Leaflet). Adds trail polylines via addSource/addLayer.
// Coordinates: DB stores [lat, lng]; Mapbox requires [lng, lat].

const DEFAULT_API_URL = "http://localhost:3000";
const SOURCE_ID = "trail-overlay";
const LAYER_ID = "trail-overlay-lines";

const NETWORK_SOURCE_ID = "network-overlay";
const NETWORK_FILL_LAYER = "network-overlay-fill";
const NETWORK_BORDER_LAYER = "network-overlay-border";
const NETWORK_LABEL_LAYER = "network-overlay-label";

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

function fetchTrails(apiUrl) {
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

function fetchNetworks(apiUrl) {
  return new Promise((resolve) => {
    window.postMessage({ type: "GET_NETWORKS", apiUrl }, "*");
    window.addEventListener("message", function handler(event) {
      if (event.data?.type === "NETWORKS_RESPONSE") {
        window.removeEventListener("message", handler);
        resolve(event.data.networks);
      }
    });
  });
}

function addClickNudge(map) {
  console.log("[TrailOverlay] Adding click nudge to trigger popups on mobile");
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

    console.log("[TrailOverlay] Nudged mouse after click");
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

// --- GEOJSON (networks) ---

function polygonRingEdgesLatLng(polygonLatLng) {
  const n = polygonLatLng.length;
  if (n < 2) return [];
  const closed =
    polygonLatLng[0][0] === polygonLatLng[n - 1][0] &&
    polygonLatLng[0][1] === polygonLatLng[n - 1][1];
  const edges = [];
  if (closed) {
    for (let i = 0; i < n - 1; i++) {
      edges.push([polygonLatLng[i], polygonLatLng[i + 1]]);
    }
  } else {
    for (let i = 0; i < n - 1; i++) {
      edges.push([polygonLatLng[i], polygonLatLng[i + 1]]);
    }
    edges.push([polygonLatLng[n - 1], polygonLatLng[0]]);
  }
  return edges;
}

function longestPolygonEdgeLngLatLine(polygonLatLng) {
  const edges = polygonRingEdgesLatLng(polygonLatLng);
  if (!edges.length) return null;
  let best = edges[0];
  let bestLen = -1;
  for (const [p0, p1] of edges) {
    const dx = p1[0] - p0[0];
    const dy = p1[1] - p0[1];
    const len = dx * dx + dy * dy;
    if (len > bestLen) {
      bestLen = len;
      best = [p0, p1];
    }
  }
  const [[lat0, lng0], [lat1, lng1]] = best;
  return [
    [lng0, lat0],
    [lng1, lat1]
  ];
}

function networksToGeoJSON(networks) {
  const features = [];
  for (const n of networks) {
    if (!n.polygon || n.polygon.length < 3) continue;
    // DB stores [lat, lng]; Mapbox requires [lng, lat]
    const coords = n.polygon.map(([lat, lng]) => [lng, lat]);
    // Close the ring
    if (
      coords[0][0] !== coords[coords.length - 1][0] ||
      coords[0][1] !== coords[coords.length - 1][1]
    ) {
      coords.push(coords[0]);
    }
    features.push({
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [coords] },
      properties: {
        id: n.id,
        name: n.name,
        trailCount: n.trailIds ? n.trailIds.length : 0,
        trailIds: JSON.stringify(n.trailIds || [])
      }
    });
    // Longest boundary segment — label follows this edge (symbol-placement line-center)
    const lineLngLat = longestPolygonEdgeLngLatLine(n.polygon);
    if (lineLngLat) {
      features.push({
        type: "Feature",
        geometry: { type: "LineString", coordinates: lineLngLat },
        properties: { id: n.id, name: n.name, overlayKind: "networkLabel" }
      });
    }
  }
  return { type: "FeatureCollection", features };
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
    filter: ["==", ["geometry-type"], "Polygon"],
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
    filter: ["==", ["geometry-type"], "Polygon"],
    paint: {
      "line-color": "#3b82f6",
      "line-width": 2,
      "line-opacity": 0.7
    }
  });

  // Network name along longest polygon edge (LineString + line-center)
  map.addLayer({
    id: NETWORK_LABEL_LAYER,
    type: "symbol",
    source: NETWORK_SOURCE_ID,
    filter: ["==", ["get", "overlayKind"], "networkLabel"],
    layout: {
      "symbol-placement": "line-center",
      "text-field": ["get", "name"],
      "text-size": 13,
      "text-rotation-alignment": "map",
      "text-pitch-alignment": "map",
      "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"]
    },
    paint: {
      "text-color": "#1d4ed8",
      "text-halo-color": "#ffffff",
      "text-halo-width": 2
    }
  });

  console.log("[TrailOverlay] Networks added to map:", networks.length);
}

function addTrailsToMap(map, trails, networks) {
  if (!map) return;

  // Build a lookup: trailId -> network name
  const trailNetworkName = {};
  if (networks) {
    for (const network of networks) {
      for (const trailId of network.trailIds || []) {
        trailNetworkName[trailId] = network.name;
      }
    }
  }

  // Attach network name to each trail feature
  const geojson = trailsToGeoJSON(trails);
  geojson.features.forEach((f, i) => {
    const networkName = trailNetworkName[trails[i]?.id];
    if (networkName) f.properties.networkName = networkName;
  });

  // Remove old layer if exists
  if (map.getSource(SOURCE_ID)) {
    if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
    map.removeSource(SOURCE_ID);
  }

  map.addSource(SOURCE_ID, { type: "geojson", data: geojson });

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
    const dir =
      p.direction && p.direction !== "not_set" ? ` · ${p.direction}` : "";
    const notes = p.notes ? `<br><em style="opacity:0.75">${p.notes}</em>` : "";
    const network = p.networkName
      ? `<br><span style="opacity:0.7;font-size:11px">&#9432; ${p.networkName}</span>`
      : "";
    infoPanel.innerHTML =
      `<strong>${p.name}</strong><br>` +
      `${p.difficulty !== "not_set" ? p.difficulty : "unrated"} · ` +
      `${Number(p.distanceKm).toFixed(1)} km · ` +
      `${Math.round(p.elevationGainFt)} ft gain` +
      dir +
      notes +
      network;
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
    const network = p.networkName
      ? `<br><small style="color:#6b7280">&#9432; ${p.networkName}</small>`
      : "";
    const html =
      `<strong>${p.name}</strong><br>` +
      `${p.difficulty !== "not_set" ? p.difficulty : "unrated"} · ` +
      `${Number(p.distanceKm).toFixed(1)} km · ` +
      `${Math.round(p.elevationGainFt)} ft gain` +
      dir +
      notes +
      network;

    if (window.mapboxgl) {
      new window.mapboxgl.Popup().setLngLat(e.lngLat).setHTML(html).addTo(map);
    }
  });

  console.log("[TrailOverlay] Trails added to map", trails);
}

// --- TOGGLE HELPERS ---

let overlayEnabled = true; // local cache, synced with storage on load

function getEnabled() {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(true), 2000); // default true if bridge is dead
    window.postMessage({ type: "GET_ENABLED" }, "*");
    window.addEventListener("message", function handler(event) {
      if (event.data?.type === "ENABLED_RESPONSE") {
        clearTimeout(timer);
        window.removeEventListener("message", handler);
        resolve(event.data.enabled);
      }
    });
  });
}

function setEnabled(value) {
  overlayEnabled = value;
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, 2000);
    window.postMessage({ type: "SET_ENABLED", enabled: value }, "*");
    window.addEventListener("message", function handler(event) {
      if (event.data?.type === "ENABLED_SET") {
        clearTimeout(timer);
        window.removeEventListener("message", handler);
        resolve();
      }
    });
  });
}

function removeLayers(map) {
  [NETWORK_LABEL_LAYER, NETWORK_BORDER_LAYER, NETWORK_FILL_LAYER].forEach(
    (id) => {
      if (map.getLayer(id)) map.removeLayer(id);
    }
  );
  if (map.getSource(NETWORK_SOURCE_ID)) map.removeSource(NETWORK_SOURCE_ID);
  if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
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
    if (on) {
      addNetworksToMap(map, cachedNetworks);
      addTrailsToMap(map, cachedTrails, cachedNetworks);
    } else {
      removeLayers(map);
    }
  };

  const ul = await waitForMapDisplayUl();
  if (!ul) {
    console.warn("[TrailOverlay] Map display section not found");
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
  console.log("[TrailOverlay] Toggle injected into Map display section");
}

// --- MAIN EXECUTION ---

let cachedTrails = null;
let cachedNetworks = null;

async function main() {
  try {
    const apiUrl = getApiUrl();
    console.log("[TrailOverlay] Using API:", apiUrl);

    if (!cachedTrails || !cachedNetworks) {
      [cachedTrails, cachedNetworks] = await Promise.all([
        cachedTrails ?? fetchTrails(apiUrl),
        cachedNetworks ?? fetchNetworks(apiUrl)
      ]);
      console.log(
        "[TrailOverlay] Loaded trails:",
        cachedTrails.length,
        "networks:",
        cachedNetworks.length
      );
    }

    const [map, enabled] = await Promise.all([waitForMap(), getEnabled()]);
    overlayEnabled = enabled;
    await waitForStyleLoaded(map);

    if (enabled) {
      addNetworksToMap(map, cachedNetworks);
      addTrailsToMap(map, cachedTrails, cachedNetworks);
      addClickNudge(map);
    }

    // Inject toggle once per page load (the MutationObserver inside handles re-renders)
    if (!document.getElementById("trail-overlay-toggle-li")) {
      injectToggle(map, enabled);
    }

    // Re-add if style reloads (respects current toggle state)
    map.on("style.load", async () => {
      console.log("[TrailOverlay] Style reloaded, re-adding layers");
      if (await getEnabled()) {
        addNetworksToMap(map, cachedNetworks);
        addTrailsToMap(map, cachedTrails, cachedNetworks);
      }
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
