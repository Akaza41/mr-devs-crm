// Extension Popup JS

document.addEventListener('DOMContentLoaded', () => {
  const loginView = document.getElementById('loginView')
  const dashboardView = document.getElementById('dashboardView')
  const loginForm = document.getElementById('loginForm')
  const loginEmail = document.getElementById('loginEmail')
  const loginPassword = document.getElementById('loginPassword')
  const loginBtn = document.getElementById('loginBtn')
  const googleLoginBtn = document.getElementById('googleLoginBtn')
  const errorBanner = document.getElementById('errorBanner')
  
  const repName = document.getElementById('repName')
  const repEmail = document.getElementById('repEmail')
  const logoutBtn = document.getElementById('logoutBtn')
  const todayTouches = document.getElementById('todayTouches')
  const activityList = document.getElementById('activityList')

  function showError(msg) {
    if (!msg) {
      errorBanner.style.display = 'none'
      errorBanner.textContent = ''
    } else {
      errorBanner.style.display = 'block'
      errorBanner.textContent = msg
    }
  }

  // Load session status
  chrome.runtime.sendMessage({ action: 'GET_SESSION' }, (response) => {
    if (response && response.session && response.user) {
      showDashboard(response.user, response)
    } else {
      showLogin()
    }
  })

  function showLogin() {
    loginView.style.display = 'block'
    dashboardView.style.display = 'none'
    showError('')
  }

  function showDashboard(user, config) {
    loginView.style.display = 'none'
    dashboardView.style.display = 'block'
    showError('')

    const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Sales Rep'
    repName.textContent = name
    repEmail.textContent = user.email || ''

    fetchRepStats(user, config)
  }

  // Fetch today's outreach events count & list from Supabase
  async function fetchRepStats(user, config) {
    if (!config.supabaseUrl || !config.session?.access_token) return

    try {
      const todayStr = new Date().toISOString().split('T')[0]
      const headers = {
        'apikey': config.supabaseAnonKey,
        'Authorization': `Bearer ${config.session.access_token}`
      }

      const res = await fetch(`${config.supabaseUrl}/rest/v1/outreach_events?user_id=eq.${user.id}&created_at=gte.${todayStr}T00:00:00Z&order=created_at.desc&limit=10`, {
        headers
      })

      if (res.ok) {
        const events = await res.json()
        todayTouches.textContent = events.length.toString()

        if (events.length === 0) {
          activityList.innerHTML = '<div style="color: #8a8a85; font-size: 11px;">No extension events logged today yet.</div>'
        } else {
          activityList.innerHTML = events.map(e => {
            const time = new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            const recipient = e.payload?.recipient_email || 'Recipient'
            const subject = e.payload?.subject_line || 'No Subject'
            const isMatched = !e.payload?.unmatched
            const statusBadge = isMatched ? '<span style="color: #3ecf8e;">✓ Matched</span>' : '<span style="color: #f2b84b;">Unmatched</span>'

            return `
              <div class="activity-item">
                <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                  <strong style="color: #ededed;">📧 Gmail Sent</strong>
                  <span style="color: #8a8a85;">${time}</span>
                </div>
                <div style="color: #8a8a85; font-size: 10px;">To: ${recipient}</div>
                <div style="color: #8a8a85; font-size: 10px;">Subject: "${subject}"</div>
                <div style="margin-top: 4px; font-size: 10px;">${statusBadge}</div>
              </div>
            `
          }).join('')
        }
      }
    } catch (err) {
      console.warn('Failed to load rep extension stats:', err)
    }
  }

  // Handle Google OAuth login
  if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', () => {
      showError('')
      googleLoginBtn.disabled = true
      googleLoginBtn.textContent = 'Connecting Google...'

      chrome.runtime.sendMessage({ action: 'GOOGLE_LOGIN' }, (res) => {
        googleLoginBtn.disabled = false
        googleLoginBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          Sign in with Google
        `

        if (res && res.success) {
          chrome.runtime.sendMessage({ action: 'GET_SESSION' }, (config) => {
            showDashboard(res.user, config)
          })
        } else {
          showError(res?.error || 'Google Sign-in failed')
        }
      })
    })
  }

  // Handle Email/Password Login submission
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault()
    showError('')
    loginBtn.disabled = true
    loginBtn.textContent = 'Signing in...'

    chrome.runtime.sendMessage({
      action: 'LOGIN',
      email: loginEmail.value.trim(),
      password: loginPassword.value
    }, (res) => {
      loginBtn.disabled = false
      loginBtn.textContent = 'Sign In with Password'

      if (res && res.success) {
        chrome.runtime.sendMessage({ action: 'GET_SESSION' }, (config) => {
          showDashboard(res.user, config)
        })
      } else {
        showError(res?.error || 'Authentication failed')
      }
    })
  })

  // Handle Logout
  logoutBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'LOGOUT' }, () => {
      showLogin()
    })
  })
})
