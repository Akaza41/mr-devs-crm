import { useState, useEffect, useCallback, useRef } from 'react'

// ── ROUTE HELPERS ──
function parseHash(hashStr) {
  const raw = (hashStr || '').replace(/^#\/?/, '')
  if (!raw) return { view: 'leads', userId: null }

  const [path, queryString] = raw.split('?')
  const params = new URLSearchParams(queryString || '')
  const id = params.get('id')

  if (path === 'profile' || path === 'employee_profile') {
    return { view: 'employee_profile', userId: id || null }
  }

  const validViews = ['leads', 'chat', 'team', 'add_user', 'settings']
  if (validViews.includes(path)) {
    return { view: path, userId: null }
  }

  return { view: 'leads', userId: null }
}

function formatHash(view, userId) {
  if (view === 'employee_profile') {
    return userId ? `#profile?id=${encodeURIComponent(userId)}` : '#profile'
  }
  return `#${view}`
}

export function useRouting() {
  const [route, setRoute] = useState(() => parseHash(window.location.hash))
  const historyStackRef = useRef([parseHash(window.location.hash)])

  // Sync state on hash change (e.g. Browser Back/Forward buttons or direct hash edits)
  useEffect(() => {
    const handleHashChange = () => {
      const parsed = parseHash(window.location.hash)
      setRoute(parsed)
    }

    window.addEventListener('hashchange', handleHashChange)
    window.addEventListener('popstate', handleHashChange)

    // Set initial hash if none exists
    if (!window.location.hash) {
      window.history.replaceState(null, '', formatHash(route.view, route.userId))
    }

    return () => {
      window.removeEventListener('hashchange', handleHashChange)
      window.removeEventListener('popstate', handleHashChange)
    }
  }, [])

  const navigate = useCallback((nextView, nextUserId = null, { replace = false } = {}) => {
    const targetHash = formatHash(nextView, nextUserId)
    const newRoute = { view: nextView, userId: nextUserId }

    if (!replace) {
      historyStackRef.current.push(newRoute)
      window.history.pushState(null, '', targetHash)
    } else {
      if (historyStackRef.current.length > 0) {
        historyStackRef.current[historyStackRef.current.length - 1] = newRoute
      } else {
        historyStackRef.current.push(newRoute)
      }
      window.history.replaceState(null, '', targetHash)
    }

    setRoute(newRoute)
  }, [])

  const goBack = useCallback(() => {
    if (historyStackRef.current.length > 1) {
      historyStackRef.current.pop() // Remove current route
      const prevRoute = historyStackRef.current[historyStackRef.current.length - 1]
      const targetHash = formatHash(prevRoute.view, prevRoute.userId)
      window.history.replaceState(null, '', targetHash)
      setRoute(prevRoute)
    } else if (window.history.length > 1 && window.location.hash !== '#leads' && window.location.hash !== '') {
      window.history.back()
    } else {
      // Default fallback if no history
      navigate('leads', null, { replace: true })
    }
  }, [navigate])

  const canGoBack = historyStackRef.current.length > 1 || route.view !== 'leads'

  return {
    currentView: route.view,
    selectedUserId: route.userId,
    navigate,
    goBack,
    canGoBack,
    formatHash
  }
}
