const DEFAULT_API_URL = 'https://trail-overlay.vercel.app'

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('apiUrl')
  const saveBtn = document.getElementById('save')
  const status = document.getElementById('status')

  chrome.storage.sync.get({ apiUrl: DEFAULT_API_URL }, (items) => {
    input.value = items.apiUrl
  })

  saveBtn.addEventListener('click', () => {
    const url = input.value.trim().replace(/\/$/, '') // strip trailing slash
    chrome.storage.sync.set({ apiUrl: url }, () => {
      status.textContent = 'Saved.'
      setTimeout(() => { status.textContent = '' }, 2000)
    })
  })
})
