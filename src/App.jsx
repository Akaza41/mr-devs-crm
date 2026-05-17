import { useState, useEffect } from 'react'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false)

  useEffect(() => {
    const auth = localStorage.getItem('mrdevs_auth')
    if (auth === '1') setLoggedIn(true)
  }, [])

  const handleLogin = () => {
    localStorage.setItem('mrdevs_auth', '1')
    setLoggedIn(true)
  }

  const handleLogout = () => {
    localStorage.removeItem('mrdevs_auth')
    setLoggedIn(false)
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      {loggedIn
        ? <Dashboard onLogout={handleLogout} />
        : <Login onLogin={handleLogin} />
      }
    </div>
  )
}