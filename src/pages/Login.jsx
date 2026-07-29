import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // ── SUPABASE LOGIN LOGIC ──
  // Authenticates via Supabase. Success is handled automatically by App.jsx's listener.
  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter both email and password.')
      return
    }
    
    setLoading(true)
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    
    if (authError) {
      setError(authError.message)
      setLoading(false)
    }
    // If successful, App.jsx's onAuthStateChange listener will detect it and switch views
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f0f' }}>
      <div style={{ width: '320px', background: '#1a1a1a', border: '0.5px solid #2a2a2a', borderRadius: '10px', padding: '32px' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '20px', fontWeight: '600', color: '#ededed', letterSpacing: '-0.5px' }}>
            MR<span style={{ color: '#3ecf8e' }}>.</span>DEVS
          </div>
          <div style={{ fontSize: '12px', color: '#555', marginTop: '4px' }}>CRM — Lead Management</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input
            className="input-base"
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => { setEmail(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />
          <input
            className="input-base"
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />
          {error && <p style={{ color: '#f87171', fontSize: '12px' }}>{error}</p>}
          <button className="btn-primary" onClick={handleLogin} style={{ marginTop: '4px' }} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </div>

      </div>
    </div>
  )
}