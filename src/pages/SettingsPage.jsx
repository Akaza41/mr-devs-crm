import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activityLogger'
import { ACTIONS } from '../lib/activityActions'

export default function SettingsPage({ userProfile, onBack }) {
  const [loading, setLoading] = useState(false)
  const [profileLoading, setProfileLoading] = useState(false)
  const [cadenceLoading, setCadenceLoading] = useState(false)
  const [toast, setToast] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState(userProfile?.full_name || '')
  const [title, setTitle] = useState(userProfile?.title || '')
  const [phone, setPhone] = useState(userProfile?.phone || '')
  const [bio, setBio] = useState(userProfile?.bio || '')
  const [specialtiesInput, setSpecialtiesInput] = useState(Array.isArray(userProfile?.specialties) ? userProfile.specialties.join(', ') : '')
  const [avatarUrl, setAvatarUrl] = useState(userProfile?.avatar_url || '')

  // Cadence Settings State
  const [noAnswerDays, setNoAnswerDays] = useState(2)
  const [voicemailDays, setVoicemailDays] = useState(2)
  const [answeredDays, setAnsweredDays] = useState(4)

  const fetchCadenceSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('cadence_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle()

      if (!error && data) {
        setNoAnswerDays(data.no_answer_days ?? 2)
        setVoicemailDays(data.voicemail_days ?? 2)
        setAnsweredDays(data.answered_days ?? 4)
      }
    } catch (err) {
      console.warn('Cadence settings fetch error:', err)
    }
  }

  useEffect(() => {
    fetchCadenceSettings()
  }, [])

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

  const handleCadenceUpdate = async (e) => {
    e.preventDefault()
    setCadenceLoading(true)

    const payload = {
      id: 1,
      no_answer_days: parseInt(noAnswerDays, 10) || 2,
      voicemail_days: parseInt(voicemailDays, 10) || 2,
      answered_days: parseInt(answeredDays, 10) || 4,
      updated_at: new Date().toISOString()
    }

    const { error } = await supabase
      .from('cadence_settings')
      .upsert(payload)

    if (error) {
      showToast('Error saving cadence settings: ' + error.message)
    } else {
      showToast('Follow-up cadence rules saved')
      logActivity({
        action: ACTIONS.SETTINGS_UPDATED || 'settings.updated',
        entityType: 'settings',
        entityId: 'cadence',
        metadata: { no_answer_days: noAnswerDays, voicemail_days: voicemailDays, answered_days: answeredDays }
      })
    }
    setCadenceLoading(false)
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

        {/* Follow-Up Cadence Rules Section */}
        <section>
          <h2 style={{ fontSize: '15px', fontWeight: '600', color: '#8a8a85', marginBottom: '16px', borderBottom: '0.5px solid #232323', paddingBottom: '8px' }}>
            Follow-Up Cadence Intervals
          </h2>
          <div className="card" style={{ padding: '24px', background: '#161616', border: '0.5px solid #232323', borderRadius: '12px' }}>
            <p style={{ fontSize: '12px', color: '#8a8a85', marginTop: 0, marginBottom: '20px' }}>
              Configure automatic follow-up delay intervals (in days) applied when reps log outreach touches.
            </p>
            <form onSubmit={handleCadenceUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#ededed', fontWeight: '600', marginBottom: '6px' }}>
                    No Answer Interval
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      className="input-base"
                      value={noAnswerDays}
                      onChange={e => setNoAnswerDays(e.target.value)}
                      style={{ width: '80px' }}
                    />
                    <span style={{ fontSize: '12px', color: '#8a8a85' }}>days</span>
                  </div>
                  <span style={{ fontSize: '11px', color: '#8a8a85', marginTop: '4px', display: 'block' }}>Default: 2 days</span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#ededed', fontWeight: '600', marginBottom: '6px' }}>
                    Voicemail Interval
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      className="input-base"
                      value={voicemailDays}
                      onChange={e => setVoicemailDays(e.target.value)}
                      style={{ width: '80px' }}
                    />
                    <span style={{ fontSize: '12px', color: '#8a8a85' }}>days</span>
                  </div>
                  <span style={{ fontSize: '11px', color: '#8a8a85', marginTop: '4px', display: 'block' }}>Default: 2 days</span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#ededed', fontWeight: '600', marginBottom: '6px' }}>
                    Answered (No Conv.)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      className="input-base"
                      value={answeredDays}
                      onChange={e => setAnsweredDays(e.target.value)}
                      style={{ width: '80px' }}
                    />
                    <span style={{ fontSize: '12px', color: '#8a8a85' }}>days</span>
                  </div>
                  <span style={{ fontSize: '11px', color: '#8a8a85', marginTop: '4px', display: 'block' }}>Default: 4 days</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="btn-primary" disabled={cadenceLoading} style={{ background: '#3ecf8e', color: '#000', fontWeight: '600' }}>
                  {cadenceLoading ? 'Saving Rules...' : 'Save Cadence Intervals'}
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
