import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activityLogger'
import { ACTIONS } from '../lib/activityActions'

export default function SettingsPage({ userProfile }) {
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')
  const [password, setPassword] = useState('')

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    if (!password) return
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      showToast('Error: ' + error.message)
    } else {
      showToast('Password updated successfully')
      setPassword('')
      logActivity({
        action: ACTIONS.PROFILE_UPDATED,
        entityType: 'profile',
        entityId: userProfile.id,
        metadata: { detail: 'Changed password' }
      })
    }
    setLoading(false)
  }

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto', color: '#ededed' }}>
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: '#1a1a1a', border: '0.5px solid #3ecf8e', borderRadius: '8px', padding: '10px 20px', color: '#3ecf8e', fontSize: '13px', zIndex: 999 }}>
          {toast}
        </div>
      )}

      <h1 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '24px' }}>Settings</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        
        {/* Profile Section */}
        <section>
          <h2 style={{ fontSize: '16px', fontWeight: '500', color: '#a0a0a0', marginBottom: '16px', borderBottom: '1px solid #2a2a2a', paddingBottom: '8px' }}>Profile</h2>
          
          <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: '600' }}>
                {userProfile?.avatar_url ? (
                  <img src={userProfile.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (userProfile?.full_name?.charAt(0) || 'U')}
              </div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: '500' }}>{userProfile?.full_name}</div>
                <div style={{ fontSize: '13px', color: '#a0a0a0', marginTop: '4px' }}>{userProfile?.email}</div>
                <div style={{ marginTop: '8px', display: 'inline-block', padding: '2px 8px', borderRadius: '4px', background: '#2a2a2a', fontSize: '11px', textTransform: 'capitalize' }}>
                  Role: {userProfile?.role}
                </div>
              </div>
            </div>
            
            <div style={{ fontSize: '12px', color: '#555', fontStyle: 'italic' }}>
              Note: To change your name or avatar, please visit your Profile page.
            </div>
          </div>
        </section>

        {/* Security Section */}
        <section>
          <h2 style={{ fontSize: '16px', fontWeight: '500', color: '#a0a0a0', marginBottom: '16px', borderBottom: '1px solid #2a2a2a', paddingBottom: '8px' }}>Security</h2>
          <div className="card" style={{ padding: '20px' }}>
            <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '300px' }}>
              <label style={{ fontSize: '13px', color: '#a0a0a0' }}>Change Password</label>
              <input 
                type="password" 
                className="input-base" 
                placeholder="New password..." 
                value={password}
                onChange={e => setPassword(e.target.value)}
                minLength={6}
                required
              />
              <button type="submit" className="btn-primary" disabled={loading} style={{ alignSelf: 'flex-start' }}>
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </form>

            <div style={{ marginTop: '32px', paddingTop: '20px', borderTop: '1px solid #2a2a2a' }}>
              <div style={{ fontSize: '13px', color: '#a0a0a0', marginBottom: '12px' }}>Active Sessions</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#242424', padding: '12px', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontSize: '13px', color: '#ededed' }}>Current Session</div>
                  <div style={{ fontSize: '11px', color: '#555' }}>Logged in via this browser</div>
                </div>
                <button className="btn-ghost" disabled>Sign out all sessions (Soon)</button>
              </div>
            </div>
          </div>
        </section>

        {/* Appearance Section */}
        <section>
          <h2 style={{ fontSize: '16px', fontWeight: '500', color: '#a0a0a0', marginBottom: '16px', borderBottom: '1px solid #2a2a2a', paddingBottom: '8px' }}>Appearance</h2>
          <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '13px', color: '#ededed' }}>Theme</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-primary">Dark Mode</button>
                <button className="btn-ghost" disabled>Light Mode</button>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '13px', color: '#ededed' }}>Accent Color</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#3ecf8e', border: '2px solid #fff' }}></div>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#3b82f6', opacity: 0.5, cursor: 'not-allowed' }}></div>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#a855f7', opacity: 0.5, cursor: 'not-allowed' }}></div>
              </div>
            </div>
          </div>
        </section>

        {/* Preferences Section */}
        <section>
          <h2 style={{ fontSize: '16px', fontWeight: '500', color: '#a0a0a0', marginBottom: '16px', borderBottom: '1px solid #2a2a2a', paddingBottom: '8px' }}>Preferences</h2>
          <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '13px', color: '#ededed' }}>Email Notifications</div>
              <button className="btn-ghost" disabled>Configure (Soon)</button>
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}
