import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

export default function App() {
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)

  // ── SUPABASE AUTHENTICATION & SESSION PERSISTENCE ──
  // Listens for session changes and fetches the user's full profile from the profiles table.
  // 'employee' is treated as a valid role (viewer-level) so existing users keep access
  // while the admin migrates them to proper RBAC roles in the Team page.
  useEffect(() => {
    let mounted = true

    async function fetchRole(userId) {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single()
      if (mounted) {
        // Accept any truthy role, including legacy 'employee'.
        // The Dashboard uses role to conditionally show UI; RLS enforces actual DB permissions.
        if (data && !error && data.role) setRole(data.role)
        else setRole(null)
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