import { useState } from 'react'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

export default function App() {
  const [role, setRole] = useState(() => {
    const auth = localStorage.getItem('mrdevs_auth')
    if (auth === '1' || auth === 'admin') return 'admin'
    if (auth === 'viewer') return 'viewer'
    return null
  })

  const handleLogin = (newRole = 'admin') => {
    localStorage.setItem('mrdevs_auth', newRole)
    setRole(newRole)
  }

  const handleLogout = () => {
    localStorage.removeItem('mrdevs_auth')
    setRole(null)
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      {role
        ? <Dashboard role={role} onLogout={handleLogout} />
        : <Login onLogin={handleLogin} />
      }
    </div>
  )
}