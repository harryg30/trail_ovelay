chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_TRAILS") {
    fetch(`${msg.apiUrl}/api/trails`)
      .then((res) => res.json())
      .then((data) => sendResponse({ success: true, trails: data.trails }))
      .catch((err) => {
        console.error("[TrailOverlay BG] Fetch failed:", err);
        sendResponse({ success: false, error: err.message });
      });

    return true; // required for async response
  }
});
