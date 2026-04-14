chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_TRAILS") {
    fetch(`${msg.apiUrl}/api/trails`)
      .then((res) => res.json())
      .then((data) => sendResponse({ success: true, trails: data.trails }))
      .catch((err) => {
        sendResponse({ success: false, error: err.message });
      });

    return true; // required for async response
  }

  /** Isolated content script → SW: cross-origin GET (avoids rare content-script fetch failures on Strava). */
  if (msg.type === "FETCH_TRAIL_PHOTOS" && typeof msg.url === "string") {
    fetch(msg.url, { credentials: "omit" })
      .then(async (res) => {
        const text = await res.text();
        sendResponse({ ok: res.ok, status: res.status, text });
      })
      .catch((err) => {
        sendResponse({ ok: false, status: 0, text: "", error: err.message || String(err) });
      });
    return true;
  }
});
