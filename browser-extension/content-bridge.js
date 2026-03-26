// ISOLATED world: handles extension APIs + fetching

const DEFAULT_API_URL = "http://localhost:3000";

async function getApiUrl() {
  const items = await chrome.storage.sync.get({ apiUrl: DEFAULT_API_URL });
  return items.apiUrl.replace(/^https:\/\/localhost/, 'http://localhost');
}

window.addEventListener("message", async (event) => {
  if (event.data?.type === "GET_ENABLED") {
    try {
      const items = await chrome.storage.sync.get({ overlayEnabled: true });
      window.postMessage({ type: "ENABLED_RESPONSE", enabled: items.overlayEnabled }, "*");
    } catch (_) {
      window.postMessage({ type: "ENABLED_RESPONSE", enabled: true }, "*");
    }
  }

  if (event.data?.type === "SET_ENABLED") {
    try {
      await chrome.storage.sync.set({ overlayEnabled: event.data.enabled });
    } catch (_) {}
    window.postMessage({ type: "ENABLED_SET" }, "*");
  }

  if (event.data?.type === "GET_TRAILS") {
    try {
      const apiUrl = await getApiUrl();
      console.log("[TrailOverlay Bridge] Fetching trails from:", apiUrl);
      const resp = await fetch(`${apiUrl}/api/trails`);
      const data = await resp.json();
      window.postMessage({ type: "TRAILS_RESPONSE", trails: data.trails || [] }, "*");
    } catch (err) {
      console.error("[TrailOverlay Bridge ERROR] trails:", err);
      window.postMessage({ type: "TRAILS_RESPONSE", trails: [] }, "*");
    }
  }

  if (event.data?.type === "GET_NETWORKS") {
    try {
      const apiUrl = await getApiUrl();
      console.log("[TrailOverlay Bridge] Fetching networks from:", apiUrl);
      const resp = await fetch(`${apiUrl}/api/networks`);
      const data = await resp.json();
      window.postMessage({ type: "NETWORKS_RESPONSE", networks: data.networks || [] }, "*");
    } catch (err) {
      console.error("[TrailOverlay Bridge ERROR] networks:", err);
      window.postMessage({ type: "NETWORKS_RESPONSE", networks: [] }, "*");
    }
  }

  if (event.data?.type === "GET_PHOTOS") {
    try {
      const apiUrl = await getApiUrl();
      const items = await chrome.storage.sync.get({ extensionToken: "" });
      const trailId = event.data.trailId ? `?trailId=${event.data.trailId}` : "";
      const headers = items.extensionToken
        ? { Authorization: `Bearer ${items.extensionToken}` }
        : {};
      const resp = await fetch(`${apiUrl}/api/photos${trailId}`, { headers });
      const data = await resp.json();
      window.postMessage({ type: "PHOTOS_RESPONSE", photos: data.photos || [] }, "*");
    } catch (err) {
      console.error("[TrailOverlay Bridge ERROR] photos:", err);
      window.postMessage({ type: "PHOTOS_RESPONSE", photos: [] }, "*");
    }
  }

  if (event.data?.type === "VOTE_PHOTO") {
    try {
      const apiUrl = await getApiUrl();
      const items = await chrome.storage.sync.get({ extensionToken: "" });
      const resp = await fetch(`${apiUrl}/api/photos/${event.data.photoId}/vote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${items.extensionToken}`,
        },
        body: JSON.stringify({ value: event.data.value }),
      });
      const data = await resp.json();
      window.postMessage({ type: "VOTE_RESPONSE", photoId: event.data.photoId, score: data.score ?? 0 }, "*");
    } catch (err) {
      console.error("[TrailOverlay Bridge ERROR] vote:", err);
      window.postMessage({ type: "VOTE_RESPONSE", photoId: event.data.photoId, score: null }, "*");
    }
  }

  if (event.data?.type === "GET_EXTENSION_TOKEN") {
    const items = await chrome.storage.sync.get({ extensionToken: "" });
    window.postMessage({ type: "EXTENSION_TOKEN_RESPONSE", token: items.extensionToken }, "*");
  }

  if (event.data?.type === "SET_EXTENSION_TOKEN") {
    await chrome.storage.sync.set({ extensionToken: event.data.token });
    window.postMessage({ type: "EXTENSION_TOKEN_SET" }, "*");
  }
});
