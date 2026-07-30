import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import { logActivity } from './lib/activityLogger'
import { ACTIONS } from './lib/activityActions'

export default function App() {
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // ── SUPABASE AUTHENTICATION & SESSION PERSISTENCE ──
  useEffect(() => {
    let mounted = true

    async function fetchProfile(userId) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (mounted) {
        if (data && !error && data.role) setUserProfile(data)
        else setUserProfile(null)
        setLoading(false)
      }
    }

    // Check active session on initial load
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) fetchProfile(session.user.id)
      else if (mounted) setLoading(false)
    })

    // Listen for login/logout events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setUserProfile(null)
      } else if (session?.user) {
        fetchProfile(session.user.id)
        if (event === 'SIGNED_IN') {
          logActivity({
            action: ACTIONS.USER_LOGGED_IN,
            entityType: 'profile',
            entityId: session.user.id
          })
        }
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
      {userProfile
        ? <Dashboard userProfile={userProfile} role={userProfile.role} onLogout={handleLogout} />
        : <Login />
      }
    </div>
  )
}