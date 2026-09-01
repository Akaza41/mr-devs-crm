import { useState, useEffect, useCallback } from 'react'
import { db, auth } from '../lib/firebase'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
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
    try {
      const userRef = doc(db, 'users', userId)
      const snap = await getDoc(userRef)
      
      if (snap.exists()) {
        const data = snap.data()
        setMember({
          id: snap.id,
          email: data.email || '',
          role: data.role || 'sales',
          full_name: data.displayName || data.email || 'Team Member',
          avatar_url: data.photoURL || null,
          created_at: data.createdAt ? new Date(data.createdAt.seconds * 1000).toISOString() : new Date().toISOString(),
          title: data.title || '',
          phone: data.phone || '',
          bio: data.bio || '',
          specialties: data.specialties || [],
          metrics: { leads_added: 0, leads_edited: 0, total_actions: 0, last_active: null }
        })
      } else {
        setMember(null)
      }
    } catch (err) {
      console.error('Error fetching member profile from Firestore:', err)
      setMember(null)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    setCurrentUser(auth.currentUser?.uid || null)
    if (userId) fetchMemberData()
  }, [userId, fetchMemberData])

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const handleSaveProfile = async (updates) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        displayName: updates.full_name || updates.displayName,
        title: updates.title,
        phone: updates.phone,
        bio: updates.bio,
        specialties: updates.specialties,
        updatedAt: new Date()
      })
      setMember({ ...member, ...updates })
      showToast('Profile updated successfully')
      return true
    } catch (err) {
      showToast('Failed to update profile: ' + err.message)
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
