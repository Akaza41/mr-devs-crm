import Login from '../pages/Login'

/**
 * AuthGuard component wraps protected application views.
 * Prevents Flash Of Unauthenticated Content (FOUC) during initial load and token refresh.
 */
export default function AuthGuard({ userProfile, loading, children }) {
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justify: 'center',
        background: '#0f0f0f',
        color: '#ededed',
        gap: '16px'
      }}>
        <div style={{
          fontSize: '22px',
          fontWeight: '600',
          letterSpacing: '-0.5px'
        }}>
          MR<span style={{ color: '#3ecf8e' }}>.</span>DEVS
        </div>
        <div style={{
          width: '28px',
          height: '28px',
          border: '3px solid rgba(62, 207, 142, 0.2)',
          borderTopColor: '#3ecf8e',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
        <span style={{ fontSize: '12px', color: '#555' }}>Authenticating session...</span>
      </div>
    )
  }

  if (!userProfile) {
    return <Login />
  }

  return children
}
