import { useState } from 'react'

const USERS = { raqeeb: 'raqeeb123', mubeen: 'mubeenAhmi123', mrdevs: 'mrdevs123' }
export const VIEWER_CREDENTIALS = { username: 'View', password: 'view1122' }

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleLogin = () => {
    if (USERS[username] && USERS[username] === password) {
      onLogin('admin')
    } else if (username === VIEWER_CREDENTIALS.username && password === VIEWER_CREDENTIALS.password) {
      onLogin('viewer')
    } else {
      setError('Wrong username or password')
    }
  }

  const handleViewerLogin = () => {
    setUsername(VIEWER_CREDENTIALS.username)
    setPassword(VIEWER_CREDENTIALS.password)
    onLogin('viewer')
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
            type="text"
            placeholder="Username"
            value={username}
            onChange={e => { setUsername(e.target.value); setError('') }}
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
          <button className="btn-primary" onClick={handleLogin} style={{ marginTop: '4px' }}>
            Sign in
          </button>
          <div style={{ display: 'flex', alignItems: 'center', margin: '8px 0' }}>
            <div style={{ flex: 1, height: '0.5px', background: '#2a2a2a' }}></div>
            <span style={{ fontSize: '11px', color: '#555', margin: '0 10px', textTransform: 'uppercase' }}>or</span>
            <div style={{ flex: 1, height: '0.5px', background: '#2a2a2a' }}></div>
          </div>
          <button className="btn-ghost" onClick={handleViewerLogin}>
            Login as Viewer
          </button>
        </div>

      </div>
    </div>
  )
}