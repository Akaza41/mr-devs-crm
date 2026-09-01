import { useState, useEffect } from 'react'
import { db, auth } from '../lib/firebase'
import { collection, doc, getDocs, updateDoc, query, orderBy } from 'firebase/firestore'
import EmployeeCard from './team/EmployeeCard'
import AddMemberModal from './team/AddMemberModal'
import { logActivity } from '../lib/activityLogger'
import { ACTIONS } from '../lib/activityActions'

export default function TeamPage({ onViewProfile, onlineUserIds = new Set() }) {
  const [team, setTeam] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState(null)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    fetchTeam()
    setCurrentUser(auth.currentUser?.uid || null)
  }, [])

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  // Fetch profiles from Firestore collection 'users'
  const fetchTeam = async () => {
    setLoading(true)
    try {
      const qUsers = query(collection(db, 'users'), orderBy('createdAt', 'asc'))
      const snapshot = await getDocs(qUsers)
      
      const members = snapshot.docs.map(d => {
        const data = d.data()
        return {
          id: d.id,
          email: data.email || '',
          role: data.role || 'sales',
          full_name: data.displayName || data.email || 'Team Member',
          avatar_url: data.photoURL || null,
          status: data.active ? 'active' : 'suspended',
          metrics: { leads_added: 0, leads_edited: 0, total_actions: 0, last_active: null }
        }
      })
      setTeam(members)
    } catch (err) {
      console.error('Error fetching team members from Firestore:', err)
      showToast('Error loading team')
    } finally {
      setLoading(false)
    }
  }

  // Determine if the current logged in user is an admin
  const currentUserProfile = team.find(m => m.id === currentUser)
  const isAdmin = currentUserProfile?.role === 'admin' || auth.currentUser?.email?.toLowerCase() === 'mubeenahma1123@gmail.com'

  const handleRoleChange = async (memberId, newRole) => {
    const targetMember = team.find(m => m.id === memberId)
    const oldRole = targetMember?.role

    try {
      await updateDoc(doc(db, 'users', memberId), { role: newRole })
      setTeam(team.map(m => m.id === memberId ? { ...m, role: newRole } : m))
      showToast(`Updated role to ${newRole}`)
      logActivity({
        action: ACTIONS.ROLE_CHANGED,
        entityType: 'profile',
        entityId: memberId,
        metadata: {
          target_email: targetMember?.email,
          old_role: oldRole,
          new_role: newRole,
        },
      })
    } catch (err) {
      showToast('Failed to update role: ' + err.message)
    }
  }

  const handleStatusChange = async (memberId, newStatus) => {
    const targetMember = team.find(m => m.id === memberId)
    const oldStatus = targetMember?.status || 'active'
    const isActive = newStatus === 'active'

    try {
      await updateDoc(doc(db, 'users', memberId), { active: isActive })
      setTeam(team.map(m => m.id === memberId ? { ...m, status: newStatus } : m))
      showToast(newStatus === 'suspended' ? `Suspended ${targetMember?.email}` : `Reactivated ${targetMember?.email}`)
      logActivity({
        action: ACTIONS.STATUS_CHANGED,
        entityType: 'profile',
        entityId: memberId,
        metadata: {
          target_email: targetMember?.email,
          old_status: oldStatus,
          new_status: newStatus,
        },
      })
    } catch (err) {
      showToast('Failed to update status: ' + err.message)
    }
  }

  const checkIsOnline = (id) => {
    if (!onlineUserIds) return false
    if (typeof onlineUserIds.has === 'function') return onlineUserIds.has(id)
    if (Array.isArray(onlineUserIds)) return onlineUserIds.includes(id)
    return false
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingTop: '12px' }}>
      
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: '#1a1a1a', border: '0.5px solid #3ecf8e', borderRadius: '8px', padding: '10px 20px', color: '#3ecf8e', fontSize: '13px', zIndex: 999 }}>
          {toast}
        </div>
      )}

      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#ededed', margin: 0 }}>Team Members</h2>
          <p style={{ fontSize: '13px', color: '#a0a0a0', margin: '4px 0 0 0' }}>Manage access and roles for your CRM users.</p>
        </div>
        {isAdmin && (
          <button 
            onClick={() => setAddModalOpen(true)}
            style={{ background: '#3ecf8e', color: '#000', border: 'none', borderRadius: '8px', padding: '10px 16px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'opacity 0.2s' }}
            onMouseOver={e => e.currentTarget.style.opacity = 0.9}
            onMouseOut={e => e.currentTarget.style.opacity = 1}
          >
            + Add Member
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ color: '#555', fontSize: '13px', textAlign: 'center', padding: '40px' }}>Loading team...</div>
      ) : team.length === 0 ? (
        // Empty state
        <div style={{ textAlign: 'center', padding: '60px', background: '#1a1a1a', border: '0.5px solid #2a2a2a', borderRadius: '12px' }}>
          <div style={{ fontSize: '15px', color: '#ededed', fontWeight: '500', marginBottom: '8px' }}>No team members yet</div>
        </div>
      ) : (
        // Cards Grid Layout
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {team.map(member => (
            <EmployeeCard 
              key={member.id} 
              member={member} 
              isOnline={checkIsOnline(member.id)}
              onViewProfile={onViewProfile} 
              isAdmin={isAdmin}
              onRoleChange={handleRoleChange}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}

      {addModalOpen && (
        <AddMemberModal 
          onClose={() => setAddModalOpen(false)}
          onSuccess={(user) => {
            setAddModalOpen(false)
            showToast('User created successfully')
            fetchTeam()
          }}
        />
      )}
    </div>
  )
}
