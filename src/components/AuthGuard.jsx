import Login from '../pages/Login'
import { auth, googleProvider } from '../lib/firebase'
import { signOut, signInWithPopup } from 'firebase/auth'

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
    const handleTryDifferentAccount = async () => {
      try {
        await signOut(auth)
        await signInWithPopup(auth, googleProvider)
      } catch (err) {
        if (
          err.code !== 'auth/popup-closed-by-user' &&
          err.code !== 'auth/cancelled-popup-request' &&
          err.name !== 'AbortError'
        ) {
          console.error('Error signing in with different account:', err)
        }
      }
    }

    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f0f0f',
        padding: '20px'
      }}>
        <div style={{
          width: '380px',
          background: '#1a1a1a',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '16px',
          padding: '36px 32px',
          textAlign: 'center',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          boxSizing: 'border-box'
        }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '22px',
            margin: '0 auto 20px auto'
          }}>
            ✕
          </div>
          
          <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#ededed', margin: '0 0 10px 0', letterSpacing: '-0.3px' }}>
            {unauthorized === 'suspended' ? 'Account Suspended' : 'Access Restricted'}
          </h2>
          
          <p style={{ fontSize: '13px', color: '#a0a0a0', lineHeight: '1.5', margin: '0 0 24px 0' }}>
            {unauthorized === 'suspended' 
              ? 'Your account has been suspended by an administrator. Please contact your workspace admin.'
              : "Your email isn't authorized for this workspace. Contact your admin to request access."}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              onClick={handleTryDifferentAccount}
              style={{
                width: '100%',
                background: '#ffffff',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                padding: '10px 16px',
                color: '#1f2937',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'background 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxSizing: 'border-box'
              }}
              onMouseOver={e => e.currentTarget.style.background = '#f9fafb'}
              onMouseOut={e => e.currentTarget.style.background = '#ffffff'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              Try a different account
            </button>

            <button
              onClick={async () => {
                await signOut(auth)
                window.location.href = '/'
              }}
              style={{
                width: '100%',
                background: 'transparent',
                border: '0.5px solid #333',
                borderRadius: '8px',
                padding: '10px 16px',
                color: '#a0a0a0',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'background 0.2s',
                boxSizing: 'border-box'
              }}
              onMouseOver={e => e.currentTarget.style.background = '#222'}
              onMouseOut={e => e.currentTarget.style.background = 'transparent'}
            >
              Back to Sign In
            </button>
          </div>

        </div>
      </div>
    )
  }

  if (!userProfile) {
    return <Login />
  }

  return children
}

