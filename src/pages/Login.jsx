import { useState } from 'react'

const USERS = { raqeeb: 'Raqeeb123', mubeen: 'MubeenAhmi123', mrdevs: 'mrdevs123' }

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleLogin = () => {
    if (USERS[username] && USERS[username] === password) {
      onLogin()
    } else {
      setError('Wrong username or password')
    }
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
        </div>

      </div>
    </div>
  )
}