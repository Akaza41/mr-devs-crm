import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

export default function App() {
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)

  // ── SUPABASE AUTHENTICATION & SESSION PERSISTENCE ──
  // Listens for session changes and fetches the user's role from the profiles table.
  useEffect(() => {
    let mounted = true

    async function fetchRole(userId) {
      const { data, error } = await supabase.from('profiles').select('role').eq('id', userId).single()
      if (mounted) {
        if (data && !error) setRole(data.role)
        else setRole(null) // fallback if no profile exists
        setLoading(false)
      }
    }

    // Check active session on initial load
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) fetchRole(session.user.id)
      else if (mounted) setLoading(false)
    })

    // Listen for login/logout events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setRole(null)
      } else if (session?.user) {
        fetchRole(session.user.id)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  // ── LOGOUT LOGIC ──
  // Uses Supabase's native signOut which clears the secure session token
  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  if (loading) {
    return <div className="min-h-screen bg-bg-primary flex items-center justify-center" style={{ color: '#ededed' }}>Loading...</div>
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      {role
        ? <Dashboard role={role} onLogout={handleLogout} />
        : <Login />
      }
    </div>
  )
}