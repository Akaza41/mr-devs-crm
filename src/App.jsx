import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Dashboard from './pages/Dashboard'
import AuthGuard from './components/AuthGuard'
import { logActivity } from './lib/activityLogger'
import { ACTIONS } from './lib/activityActions'

export default function App() {
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [unauthorized, setUnauthorized] = useState(false)

  // ── SUPABASE AUTHENTICATION & SESSION PERSISTENCE ──
  useEffect(() => {
    let mounted = true

    async function fetchProfile(userId) {
      let { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      // ── BOOTSTRAP ADMIN CHECK FOR OWNER EMAIL ──
      if (data && data.email?.toLowerCase() === 'mubeenahma1123@gmail.com' && data.role !== 'admin') {
        const { data: updated } = await supabase
          .from('profiles')
          .update({ role: 'admin' })
          .eq('id', userId)
          .select('*')
          .single()
        if (updated) data = updated
      }

      if (mounted) {
        if (data && !error && data.role) {
          setUserProfile(data)
          setUnauthorized(false)
        } else {
          // No profile row exists! Unauthorized email -> immediate sign out & gate workspace
          setUserProfile(null)
          setUnauthorized(true)
          await supabase.auth.signOut()
        }
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
        if (mounted) setLoading(false)
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
    setLoading(true)
    await supabase.auth.signOut()
    setUserProfile(null)
    setUnauthorized(false)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <AuthGuard loading={loading} userProfile={userProfile} unauthorized={unauthorized}>
        <Dashboard userProfile={userProfile} role={userProfile?.role} onLogout={handleLogout} />
      </AuthGuard>
    </div>
  )
}