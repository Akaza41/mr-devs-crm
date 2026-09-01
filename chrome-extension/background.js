// MR.DEVS CRM Chrome Extension Service Worker (background.js)
// Updated for Firebase Auth REST & Cloud Firestore REST APIs

const DEFAULT_FIREBASE_API_KEY = ''
const DEFAULT_PROJECT_ID = 'mr-devs-platform'

async function getExtensionConfig() {
  const data = await chrome.storage.local.get(['firebaseApiKey', 'projectId', 'session', 'user'])
  return {
    firebaseApiKey: data.firebaseApiKey || DEFAULT_FIREBASE_API_KEY,
    projectId: data.projectId || DEFAULT_PROJECT_ID,
    session: data.session || null,
    user: data.user || null
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'SAVE_CONFIG') {
    chrome.storage.local.set({
      firebaseApiKey: message.firebaseApiKey,
      projectId: message.projectId
    }, () => sendResponse({ success: true }))
    return true
  }

  if (message.action === 'LOGIN') {
    handleFirebaseLogin(message.email, message.password, message.firebaseApiKey, message.projectId)
      .then(res => sendResponse(res))
      .catch(err => sendResponse({ success: false, error: err.message }))
    return true
  }

  if (message.action === 'GET_SESSION') {
    getExtensionConfig().then(config => sendResponse({ success: true, ...config }))
    return true
  }

  if (message.action === 'LOGOUT') {
    chrome.storage.local.remove(['session', 'user'], () => sendResponse({ success: true }))
    return true
  }

  if (message.action === 'LOG_GMAIL_OUTREACH') {
    handleLogGmailOutreach(message.recipientEmail, message.subject)
      .then(res => sendResponse(res))
      .catch(err => sendResponse({ success: false, error: err.message }))
    return true
  }
})

// Handles Firebase email/password login via Google Identity Toolkit REST API
async function handleFirebaseLogin(email, password, customKey, customProjectId) {
  const config = await getExtensionConfig()
  const apiKey = customKey || config.firebaseApiKey
  const projectId = customProjectId || config.projectId

  if (!apiKey) {
    throw new Error('Firebase API Key not configured in Extension settings.')
  }

  const endpoint = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true })
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error?.message || 'Login failed')
  }

  const session = {
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    expiresAt: Date.now() + (parseInt(data.expiresIn) * 1000)
  }

  const user = {
    uid: data.localId,
    email: data.email,
    displayName: data.displayName || data.email
  }

  await chrome.storage.local.set({
    firebaseApiKey: apiKey,
    projectId,
    session,
    user
  })

  return { success: true, user }
}

// Logs Gmail outreach event to Cloud Firestore via REST API
async function handleLogGmailOutreach(recipientEmail, subject) {
  const config = await getExtensionConfig()
  if (!config.session || !config.user) {
    throw new Error('Not logged in')
  }

  const projectId = config.projectId || DEFAULT_PROJECT_ID
  const endpoint = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/outreach_events`

  const payload = {
    fields: {
      userId: { stringValue: config.user.uid },
      channel: { stringValue: 'gmail' },
      eventType: { stringValue: 'message_sent' },
      payload: {
        mapValue: {
          fields: {
            recipientEmail: { stringValue: recipientEmail || '' },
            subject: { stringValue: subject || '' }
          }
        }
      },
      createdAt: { timestampValue: new Date().toISOString() }
    }
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.session.idToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    const errData = await response.json()
    throw new Error(errData.error?.message || 'Failed to log outreach event to Firestore')
  }

  return { success: true }
}
