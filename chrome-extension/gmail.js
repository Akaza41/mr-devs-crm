// Gmail Outreach Detection Content Script (gmail.js)

(function () {
  console.log('[MR.DEVS CRM] Gmail Outreach Verification Script Loaded')

  // Helper to extract email addresses from text or nodes
  function extractEmail(text) {
    if (!text) return null
    const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
    return match ? match[0] : null
  }

  // Show unobtrusive notification toast in Gmail UI
  function showGmailToast(message, isSuccess = true) {
    const toast = document.createElement('div')
    toast.style.position = 'fixed'
    toast.style.bottom = '24px'
    toast.style.right = '24px'
    toast.style.backgroundColor = isSuccess ? '#161616' : '#2d1515'
    toast.style.color = isSuccess ? '#3ecf8e' : '#f87171'
    toast.style.border = `1px solid ${isSuccess ? '#3ecf8e' : '#f87171'}`
    toast.style.borderRadius = '8px'
    toast.style.padding = '10px 16px'
    toast.style.fontSize = '12px'
    toast.style.fontWeight = '600'
    toast.style.boxShadow = '0 4px 16px rgba(0,0,0,0.5)'
    toast.style.zIndex = '999999'
    toast.style.fontFamily = '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif'
    toast.textContent = message

    document.body.appendChild(toast)
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast)
    }, 4000)
  }

  // Intercept Gmail send action
  function handleGmailSend(composeBox) {
    if (!composeBox) return

    // 1. Extract Recipient Email
    let recipientEmail = null
    const recipientElements = composeBox.querySelectorAll('span[email], [data-hovercard-id], input[name="to"], div[aria-label="To"] span')
    
    for (const el of recipientElements) {
      const emailAttr = el.getAttribute('email') || el.getAttribute('data-hovercard-id') || el.textContent
      const found = extractEmail(emailAttr)
      if (found) {
        recipientEmail = found
        break
      }
    }

    if (!recipientEmail) {
      // Fallback: search compose box HTML text
      recipientEmail = extractEmail(composeBox.innerText || composeBox.innerHTML)
    }

    if (!recipientEmail) {
      console.warn('[MR.DEVS CRM] Could not capture recipient email in Gmail compose window')
      return
    }

    // 2. Extract Subject Line (excluding body for privacy)
    let subject = 'No Subject'
    const subjectInput = composeBox.querySelector('input[name="subjectbox"], input[name="subject"], input[aria-label="Subject"]')
    if (subjectInput && subjectInput.value) {
      subject = subjectInput.value.trim()
    }

    console.log('[MR.DEVS CRM] Capturing Gmail Outreach:', { recipientEmail, subject })

    // 3. Send event to background script
    chrome.runtime.sendMessage({
      action: 'LOG_GMAIL_OUTREACH',
      recipientEmail,
      subject
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('[MR.DEVS CRM] Background message error:', chrome.runtime.lastError.message)
        return
      }

      if (response && response.success) {
        const leadLabel = response.matched ? `Matched (${response.matchedLeadName})` : 'Unmatched'
        showGmailToast(`⚡ MR.DEVS CRM: Email outreach verified to ${recipientEmail} [${leadLabel}]`)
      } else {
        showGmailToast(`⚠️ MR.DEVS CRM: ${response?.error || 'Outreach verification failed'}`, false)
      }
    })
  }

  // Attach global click event listener for Send button
  document.addEventListener('click', (e) => {
    const target = e.target
    if (!target) return

    // Check if target or parent is a Gmail Send button
    const sendBtn = target.closest('div[role="button"][aria-label*="Send"], div[role="button"][aria-label*="send"], .gU.Up, .aoO')
    if (sendBtn) {
      const composeBox = sendBtn.closest('div[role="dialog"], .M9, .aoI, .nH.L3')
      if (composeBox) {
        // Small delay to ensure compose DOM values are ready before send completes
        setTimeout(() => handleGmailSend(composeBox), 100)
      }
    }
  }, true)

  // Attach keyboard shortcut listener (Ctrl+Enter / Cmd+Enter)
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      const activeEl = document.activeElement
      if (activeEl) {
        const composeBox = activeEl.closest('div[role="dialog"], .M9, .aoI, .nH.L3')
        if (composeBox) {
          setTimeout(() => handleGmailSend(composeBox), 100)
        }
      }
    }
  }, true)

})()
