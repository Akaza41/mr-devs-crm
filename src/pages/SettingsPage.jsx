import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activityLogger'
import { ACTIONS } from '../lib/activityActions'

export default function SettingsPage({ userProfile, onBack }) {
  const [loading, setLoading] = useState(false)
  const [profileLoading, setProfileLoading] = useState(false)
  const [toast, setToast] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [title, setTitle] = useState('')
  const [phone, setPhone] = useState('')
  const [bio, setBio] = useState('')
  const [specialtiesInput, setSpecialtiesInput] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')

  useEffect(() => {
    if (userProfile) {
      setFullName(userProfile.full_name || '')
      setTitle(userProfile.title || '')
      setPhone(userProfile.phone || '')
      setBio(userProfile.bio || '')
      setSpecialtiesInput(Array.isArray(userProfile.specialties) ? userProfile.specialties.join(', ') : '')
      setAvatarUrl(userProfile.avatar_url || '')
    }
  }, [userProfile])

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const handleProfileUpdate = async (e) => {
    e.preventDefault()
    if (!userProfile) return
    setProfileLoading(true)

    const specsArray = specialtiesInput ? specialtiesInput.split(',').map(s => s.trim()).filter(Boolean) : []

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        title,
        phone,
        bio,
        specialties: specsArray,
        avatar_url: avatarUrl
      })
      .eq('id', userProfile.id)

    if (error) {
      showToast('Error updating profile: ' + error.message)
    } else {
      showToast('Profile updated successfully')
      logActivity({
        action: ACTIONS.PROFILE_UPDATED,
        entityType: 'profile',
        entityId: userProfile.id,
        metadata: { full_name: fullName, title, avatar_url: avatarUrl }
      })
    }
    setProfileLoading(false)
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
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto', color: '#f5f5f0' }}>
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: '#161616', border: '0.5px solid #3ecf8e', borderRadius: '8px', padding: '10px 20px', color: '#3ecf8e', fontSize: '13px', zIndex: 999 }}>
          {toast}
        </div>
      )}

      {onBack && (
        <button 
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: '#8a8a85', cursor: 'pointer', fontSize: '13px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <span>←</span> Back
        </button>
      )}

      <h1 className="font-headline" style={{ fontSize: '24px', fontWeight: '700', marginBottom: '24px', color: '#f5f5f0' }}>Settings</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        
        {/* Profile Section */}
        <section>
          <h2 style={{ fontSize: '15px', fontWeight: '600', color: '#8a8a85', marginBottom: '16px', borderBottom: '0.5px solid #232323', paddingBottom: '8px' }}>Personal Profile</h2>
          
          <div className="card" style={{ padding: '24px', background: '#161616', border: '0.5px solid #232323', borderRadius: '12px' }}>
            <form onSubmit={handleProfileUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#232323', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: '600', overflow: 'hidden', flexShrink: 0 }}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (fullName?.charAt(0) || 'U')}
                </div>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: '#f5f5f0' }}>{fullName || userProfile?.email}</div>
                  <div style={{ fontSize: '13px', color: '#8a8a85', marginTop: '2px' }}>{userProfile?.email}</div>
                  <div style={{ marginTop: '6px', display: 'inline-block', padding: '2px 8px', borderRadius: '4px', background: '#232323', fontSize: '11px', textTransform: 'capitalize', color: '#3ecf8e', fontWeight: '600' }}>
                    Role: {userProfile?.role}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#8a8a85', marginBottom: '6px' }}>Full Name</label>
                  <input
                    type="text"
                    className="input-base"
                    placeholder="Your name..."
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#8a8a85', marginBottom: '6px' }}>Job Title</label>
                  <input
                    type="text"
                    className="input-base"
                    placeholder="e.g. Senior SDR, Account Executive"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#8a8a85', marginBottom: '6px' }}>Phone Number</label>
                  <input
                    type="text"
                    className="input-base"
                    placeholder="+1 (555) 000-0000"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#8a8a85', marginBottom: '6px' }}>Avatar Image URL</label>
                  <input
                    type="url"
                    className="input-base"
                    placeholder="https://example.com/avatar.jpg"
                    value={avatarUrl}
                    onChange={e => setAvatarUrl(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#8a8a85', marginBottom: '6px' }}>Specialties (Comma-separated tags)</label>
                <input
                  type="text"
                  className="input-base"
                  placeholder="e.g. cold calling, LinkedIn outreach, SaaS sales, healthcare"
                  value={specialtiesInput}
                  onChange={e => setSpecialtiesInput(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#8a8a85', marginBottom: '6px' }}>Short Bio</label>
                <textarea
                  className="input-base"
                  rows="3"
                  placeholder="Brief bio or personal focus..."
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="btn-primary" disabled={profileLoading}>
                  {profileLoading ? 'Saving...' : 'Save Profile Changes'}
                </button>
              </div>

            </form>
          </div>
        </section>

        {/* Security Section */}
        <section>
          <h2 style={{ fontSize: '15px', fontWeight: '600', color: '#8a8a85', marginBottom: '16px', borderBottom: '0.5px solid #232323', paddingBottom: '8px' }}>Security & Password</h2>
          <div className="card" style={{ padding: '24px', background: '#161616', border: '0.5px solid #232323', borderRadius: '12px' }}>
            <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '340px' }}>
              <label style={{ fontSize: '12px', color: '#8a8a85' }}>New Password</label>
              <input 
                type="password" 
                className="input-base" 
                placeholder="Enter new password..." 
                value={password}
                onChange={e => setPassword(e.target.value)}
                minLength={6}
                required
              />
              <button type="submit" className="btn-primary" disabled={loading} style={{ alignSelf: 'flex-start', marginTop: '4px' }}>
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>
        </section>

      </div>
    </div>
  )
}
