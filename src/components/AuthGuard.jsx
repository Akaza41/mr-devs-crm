import Login from '../pages/Login'
import { supabase } from '../lib/supabase'

/**
 * AuthGuard component wraps protected application views.
 * Enforces role-based workspace authorization and prevents Flash Of Unauthenticated Content (FOUC).
 */
export default function AuthGuard({ userProfile, loading, unauthorized, children }) {
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

  // ── UNAUTHORIZED USER (NO PROFILE MATCH IN WORKSPACE) ──
  if (unauthorized) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justify: 'center',
        background: '#0f0f0f',
        padding: '20px'
      }}>
        <div style={{
          width: '380px',
          background: '#1a1a1a',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '12px',
          padding: '32px',
          textAlign: 'center',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.1)',
            color: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            margin: '0 auto 16px auto'
          }}>
            ✕
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#ededed', margin: '0 0 12px 0' }}>
            Access Restricted
          </h2>
          <p style={{ fontSize: '13px', color: '#a0a0a0', lineHeight: '1.5', margin: '0 0 24px 0' }}>
            Your email isn't authorized for this workspace. Contact your admin to request access.
          </p>
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              window.location.href = '/'
            }}
            style={{
              width: '100%',
              background: '#242424',
              border: '0.5px solid #333',
              borderRadius: '8px',
              padding: '10px 16px',
              color: '#ededed',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseOver={e => e.currentTarget.style.background = '#2a2a2a'}
            onMouseOut={e => e.currentTarget.style.background = '#242424'}
          >
            Back to Sign In
          </button>
        </div>
      </div>
    )
  }

  if (!userProfile) {
    return <Login />
  }

  return children
}

