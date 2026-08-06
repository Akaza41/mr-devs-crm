// Extension Popup JS

document.addEventListener('DOMContentLoaded', () => {
  const loginView = document.getElementById('loginView')
  const dashboardView = document.getElementById('dashboardView')
  const loginForm = document.getElementById('loginForm')
  const loginEmail = document.getElementById('loginEmail')
  const loginPassword = document.getElementById('loginPassword')
  const loginBtn = document.getElementById('loginBtn')
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

    repName.textContent = user.user_metadata?.full_name || user.email.split('@')[0]
    repEmail.textContent = user.email

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

  // Handle Login submission
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
      loginBtn.textContent = 'Sign In'

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
