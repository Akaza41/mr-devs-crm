import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import EmployeeHeader from '../components/team/EmployeeHeader'
import EmployeeStatsCards from '../components/team/EmployeeStatsCards'
import EmployeeProfileEditor from '../components/team/EmployeeProfileEditor'
import EmployeeActivityFeed from '../components/team/EmployeeActivityFeed'

// ── EMPLOYEE PROFILE PAGE ──
// The central hub for an individual employee's data.
// Acts as a shell assembling modular components. Fetches its own data via userId.
export default function EmployeeProfilePage({ userId, onBack }) {
  const [member, setMember] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState(null)
  const [toast, setToast] = useState('')

  const fetchMemberData = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, role, full_name, avatar_url, created_at')
      .eq('id', userId)
      .single()
      
    if (!error && data) {
      // Fetch metrics for this user
      const { data: metricsData } = await supabase.rpc('get_team_metrics', { p_user_id: userId })
      const metrics = metricsData && metricsData.length > 0 ? metricsData[0] : null
      
      setMember({ ...data, metrics })
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    // Get the ID of the currently logged-in user to enforce safety rules in the editor
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUser(session?.user?.id || null)
    })
    
    if (userId) fetchMemberData()
  }, [userId, fetchMemberData])

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const handleSaveProfile = async (updates) => {
    const { error } = await supabase.from('profiles').update(updates).eq('id', userId)
    if (!error) {
      setMember({ ...member, ...updates })
      showToast('Profile updated successfully')
      return true
    } else {
      showToast('Failed to update profile: ' + error.message)
      return false
    }
  }

  if (loading) {
    return <div style={{ color: '#555', fontSize: '13px', textAlign: 'center', padding: '40px' }}>Loading profile...</div>
  }

  if (!member) {
    return <div style={{ color: '#f87171', fontSize: '13px', textAlign: 'center', padding: '40px' }}>User not found</div>
  }

  return (
    <div style={{ padding: '12px 0', maxWidth: '800px', margin: '0 auto', position: 'relative' }}>
      
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: '#1a1a1a', border: '0.5px solid #3ecf8e', borderRadius: '8px', padding: '10px 20px', color: '#3ecf8e', fontSize: '13px', zIndex: 999 }}>
          {toast}
        </div>
      )}

      {/* Back button */}
      <button 
        onClick={onBack}
        style={{ background: 'none', border: 'none', color: '#a0a0a0', cursor: 'pointer', fontSize: '13px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '6px' }}
      >
        <span>←</span> Back
      </button>

      <EmployeeHeader member={member} />
      
      <EmployeeStatsCards member={member} />
      
      <EmployeeProfileEditor 
        member={member} 
        onSave={handleSaveProfile} 
        isCurrentUser={currentUser === member.id}
      />
      
      <EmployeeActivityFeed userId={member.id} />

    </div>
  )
}
