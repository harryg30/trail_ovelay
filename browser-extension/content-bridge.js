// Isolated world: reads chrome.storage and passes API URL to the MAIN world via localStorage.
// content.js (MAIN world) reads this value before fetching trails.
const DEFAULT_API_URL = 'https://trail-overlay.vercel.app'

chrome.storage.sync.get({ apiUrl: DEFAULT_API_URL }, (items) => {
  localStorage.setItem('trailOverlayApiUrl', items.apiUrl)
})
