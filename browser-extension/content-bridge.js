// ISOLATED world: handles extension APIs + fetching

const DEFAULT_API_URL = "http://localhost:3000";

window.addEventListener("message", async (event) => {
  if (event.data?.type !== "GET_TRAILS") return;

  try {
    // Get API URL from storage
    const items = await chrome.storage.sync.get({
      apiUrl: DEFAULT_API_URL
    });

    // Ensure localhost always uses http (never https)
    const apiUrl = items.apiUrl.replace(/^https:\/\/localhost/, 'http://localhost');

    console.log("[TrailOverlay Bridge] Fetching trails from:", apiUrl);

    const resp = await fetch(`${apiUrl}/api/trails`);
    const data = await resp.json();

    window.postMessage(
      {
        type: "TRAILS_RESPONSE",
        trails: data.trails || []
      },
      "*"
    );
  } catch (err) {
    console.error("[TrailOverlay Bridge ERROR]", err);

    window.postMessage(
      {
        type: "TRAILS_RESPONSE",
        trails: []
      },
      "*"
    );
  }
});
