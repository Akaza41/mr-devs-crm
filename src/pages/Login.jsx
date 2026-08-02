import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  // ── HANDLE OAUTH REDIRECT ERRORS FROM URL ──
  useEffect(() => {
    // If Supabase OAuth redirects back with an error in hash or search query params
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    const queryParams = new URLSearchParams(window.location.search)
    const errorDesc = hashParams.get('error_description') || queryParams.get('error_description')
    const errorMsg = hashParams.get('error') || queryParams.get('error')

    if (errorDesc || errorMsg) {
      const parsed = errorDesc || errorMsg
      setError(decodeURIComponent(parsed).replace(/\+/g, ' '))
    }
  }, [])

  // ── SUPABASE LOGIN LOGIC ──
  // Authenticates via Supabase. Success is handled automatically by App.jsx's listener.
  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter both email and password.')
      return
    }
    
    setLoading(true)
    setError('')
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    
    if (authError) {
      setError(authError.message)
      setLoading(false)
    }
    // If successful, App.jsx's onAuthStateChange listener will detect it and switch views
  }

  // ── GOOGLE OAUTH LOGIN LOGIC ──
  const handleGoogleLogin = async () => {
    setGoogleLoading(true)
    setError('')
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    })
    if (authError) {
      setError(authError.message)
      setGoogleLoading(false)
    }
  }

  const isAnyLoading = loading || googleLoading

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f0f' }}>
      <div style={{ width: '340px', background: '#1a1a1a', border: '0.5px solid #2a2a2a', borderRadius: '12px', padding: '32px', boxSizing: 'border-box' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '20px', fontWeight: '600', color: '#ededed', letterSpacing: '-0.5px' }}>
            MR<span style={{ color: '#3ecf8e' }}>.</span>DEVS
          </div>
          <div style={{ fontSize: '12px', color: '#555', marginTop: '4px' }}>CRM — Lead Management</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          {/* ── GOOGLE OAUTH BUTTON (STANDARD BRANDING) ── */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isAnyLoading}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              background: '#ffffff',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              padding: '10px 16px',
              color: '#1f2937',
              fontSize: '13px',
              fontWeight: '500',
              cursor: isAnyLoading ? 'not-allowed' : 'pointer',
              opacity: isAnyLoading ? 0.7 : 1,
              transition: 'all 0.2s ease',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
              boxSizing: 'border-box'
            }}
            onMouseOver={e => { if (!isAnyLoading) e.currentTarget.style.background = '#f9fafb' }}
            onMouseOut={e => { if (!isAnyLoading) e.currentTarget.style.background = '#ffffff' }}
          >
            {googleLoading ? (
              <span style={{ fontSize: '13px', color: '#4b5563' }}>Connecting to Google...</span>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                Sign in with Google
              </>
            )}
          </button>

          {/* ── VISUAL DIVIDER ── */}
          <div style={{ display: 'flex', alignItems: 'center', margin: '8px 0', gap: '10px' }}>
            <div style={{ flex: 1, height: '1px', background: '#2a2a2a' }} />
            <span style={{ fontSize: '11px', color: '#777', textTransform: 'lowercase', letterSpacing: '0.2px' }}>or continue with</span>
            <div style={{ flex: 1, height: '1px', background: '#2a2a2a' }} />
          </div>

          <input
            className="input-base"
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => { setEmail(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            disabled={isAnyLoading}
          />
          <input
            className="input-base"
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            disabled={isAnyLoading}
          />
          
          {error && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '0.5px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', padding: '8px 12px' }}>
              <p style={{ color: '#f87171', fontSize: '12px', margin: 0, lineHeight: '1.4' }}>{error}</p>
            </div>
          )}

          <button className="btn-primary" onClick={handleLogin} style={{ marginTop: '4px' }} disabled={isAnyLoading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </div>

      </div>
    </div>
  )
}