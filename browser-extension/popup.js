const DEFAULT_API_URL = 'http://localhost:3000'

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('apiUrl')
  const tokenInput = document.getElementById('extensionToken')
  const saveBtn = document.getElementById('save')
  const status = document.getElementById('status')

  chrome.storage.sync.get({ apiUrl: DEFAULT_API_URL, extensionToken: '' }, (items) => {
    input.value = items.apiUrl
    if (items.extensionToken) tokenInput.value = items.extensionToken
  })

  saveBtn.addEventListener('click', () => {
    const url = input.value.trim().replace(/\/$/, '')
    const token = tokenInput.value.trim()
    chrome.storage.sync.set({ apiUrl: url, extensionToken: token }, () => {
      status.textContent = 'Saved.'
      setTimeout(() => { status.textContent = '' }, 2000)
    })
  })
})
