import React, { useState, useEffect } from 'react'
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

  useEffect(() => {
    // Get the ID of the currently logged-in user to enforce safety rules in the editor
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUser(session?.user?.id || null)
    })
    
    if (userId) fetchMemberData()
  }, [userId])

  const fetchMemberData = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (!error && data) {
      setMember(data)
    }
    setLoading(false)
  }

  const handleSaveProfile = async (updates) => {
    const { error } = await supabase.from('profiles').update(updates).eq('id', userId)
    if (!error) {
      setMember({ ...member, ...updates })
      // Toast notification would go here in a full app
      alert('Profile updated successfully')
    } else {
      alert('Failed to update profile')
    }
  }

  if (loading) {
    return <div style={{ color: '#555', fontSize: '13px', textAlign: 'center', padding: '40px' }}>Loading profile...</div>
  }

  if (!member) {
    return <div style={{ color: '#f87171', fontSize: '13px', textAlign: 'center', padding: '40px' }}>User not found</div>
  }

  return (
    <div style={{ padding: '12px 0', maxWidth: '800px', margin: '0 auto' }}>
      
      {/* Back button */}
      <button 
        onClick={onBack}
        style={{ background: 'none', border: 'none', color: '#a0a0a0', cursor: 'pointer', fontSize: '13px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '6px' }}
      >
        <span>←</span> Back to Team
      </button>

      <EmployeeHeader member={member} />
      
      <EmployeeStatsCards />
      
      <EmployeeProfileEditor 
        member={member} 
        onSave={handleSaveProfile} 
        isCurrentUser={currentUser === member.id}
      />
      
      <EmployeeActivityFeed />

    </div>
  )
}
