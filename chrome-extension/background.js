// MR.DEVS CRM Extension Service Worker (background.js)

const DEFAULT_SUPABASE_URL = 'https://YOUR_SUPABASE_PROJECT.supabase.co'
const DEFAULT_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'

// Helper to get configuration and session
async function getExtensionConfig() {
  const data = await chrome.storage.local.get(['supabaseUrl', 'supabaseAnonKey', 'session', 'user'])
  return {
    supabaseUrl: data.supabaseUrl || DEFAULT_SUPABASE_URL,
    supabaseAnonKey: data.supabaseAnonKey || DEFAULT_ANON_KEY,
    session: data.session || null,
    user: data.user || null
  }
}

// Listen for message events from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'LOGIN') {
    handleLogin(message.email, message.password, message.supabaseUrl, message.supabaseAnonKey)
      .then(res => sendResponse(res))
      .catch(err => sendResponse({ success: false, error: err.message }))
    return true // async response
  }

  if (message.action === 'GOOGLE_LOGIN') {
    handleGoogleLogin(message.supabaseUrl, message.supabaseAnonKey)
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

// Handles Supabase email/password login via REST Auth API
async function handleLogin(email, password, customUrl, customKey) {
  const url = (customUrl || DEFAULT_SUPABASE_URL).replace(/\/$/, '')
  const key = customKey || DEFAULT_ANON_KEY

  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'apikey': key,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error_description || data.msg || data.message || 'Login failed')
  }

  const session = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in * 1000)
  }

  const user = data.user

  await chrome.storage.local.set({
    supabaseUrl: url,
    supabaseAnonKey: key,
    session,
    user
  })

  return { success: true, user }
}

// Handles Google OAuth sign-in via chrome.identity & Supabase OAuth
async function handleGoogleLogin(customUrl, customKey) {
  const url = (customUrl || DEFAULT_SUPABASE_URL).replace(/\/$/, '')
  const key = customKey || DEFAULT_ANON_KEY

  // Use chrome.identity to get redirect URI (e.g. https://<ext-id>.chromiumapp.org/)
  const redirectUrl = chrome.identity.getRedirectURL()
  const authUrl = `${url}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectUrl)}`

  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true
    }, async (redirectedTo) => {
      if (chrome.runtime.lastError || !redirectedTo) {
        return reject(new Error(chrome.runtime.lastError?.message || 'Google Auth flow cancelled'))
      }

      try {
        const urlObj = new URL(redirectedTo)
        const hash = urlObj.hash.startsWith('#') ? urlObj.hash.substring(1) : urlObj.hash
        const params = new URLSearchParams(hash || urlObj.search)

        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')
        const expiresIn = params.get('expires_in')

        if (!accessToken) {
          throw new Error('No access_token returned from Google OAuth redirect')
        }

        // Fetch user profile from Supabase with the token
        const userRes = await fetch(`${url}/auth/v1/user`, {
          headers: {
            'apikey': key,
            'Authorization': `Bearer ${accessToken}`
          }
        })

        if (!userRes.ok) {
          throw new Error('Failed to fetch user profile with Google OAuth token')
        }

        const user = await userRes.json()

        const session = {
          access_token: accessToken,
          refresh_token: refreshToken || '',
          expires_at: Date.now() + (parseInt(expiresIn || '3600', 10) * 1000)
        }

        await chrome.storage.local.set({
          supabaseUrl: url,
          supabaseAnonKey: key,
          session,
          user
        })

        resolve({ success: true, user })
      } catch (err) {
        reject(err)
      }
    })
  })
}

// Matches recipient email and logs event to outreach_events table
async function handleLogGmailOutreach(recipientEmail, subject) {
  const { supabaseUrl, supabaseAnonKey, session, user } = await getExtensionConfig()

  if (!session || !session.access_token || !user) {
    throw new Error('Rep not authenticated in extension')
  }

  const cleanRecipient = (recipientEmail || '').trim().toLowerCase()
  const headers = {
    'apikey': supabaseAnonKey,
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  }

  // Step 1: Match recipient against leads table by notes, custom_fields, or contact info
  let leadId = null
  let matchedLeadName = null

  try {
    const matchRes = await fetch(`${supabaseUrl}/rest/v1/leads?select=id,hospital_name,lead_name,notes,custom_fields&limit=5`, {
      method: 'GET',
      headers
    })

    if (matchRes.ok) {
      const leads = await matchRes.json()
      // Find matching lead containing recipient email in notes or custom fields
      const match = leads.find(l => {
        const notesStr = (l.notes || '').toLowerCase()
        const customStr = JSON.stringify(l.custom_fields || {}).toLowerCase()
        return notesStr.includes(cleanRecipient) || customStr.includes(cleanRecipient)
      })

      if (match) {
        leadId = match.id
        matchedLeadName = match.hospital_name || match.lead_name
      }
    }
  } catch (err) {
    console.warn('Lead match error:', err)
  }

  // Step 2: POST to outreach_events table
  const payload = {
    user_id: user.id,
    lead_id: leadId,
    channel: 'gmail',
    event_type: 'message_sent',
    payload: {
      recipient_email: cleanRecipient,
      subject_line: subject || '(No Subject)',
      unmatched: !leadId,
      auto_detected: true
    },
    created_at: new Date().toISOString()
  }

  const postRes = await fetch(`${supabaseUrl}/rest/v1/outreach_events`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  })

  if (!postRes.ok) {
    const errText = await postRes.text()
    throw new Error(`Failed to log outreach event: ${errText}`)
  }

  const inserted = await postRes.json()
  return {
    success: true,
    matched: !!leadId,
    leadId,
    matchedLeadName,
    event: inserted[0]
  }
}
