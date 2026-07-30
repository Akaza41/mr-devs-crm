import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import TeamInviteModal from './TeamInviteModal'
import EmployeeCard from './team/EmployeeCard'

export default function TeamPage({ onViewProfile }) {
  const [team, setTeam] = useState([])
  const [loading, setLoading] = useState(true)
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)

  useEffect(() => {
    fetchTeam()
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUser(session?.user?.id || null)
    })
  }, [])

  // Fetch profiles — select all fields the EmployeeCard needs to render correctly.
  // full_name and avatar_url were added to the schema in Phase 6 migration.
  const fetchTeam = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, role, full_name, avatar_url')
      .order('created_at', { ascending: true })
    if (data && !error) {
      setTeam(data)
    }
    setLoading(false)
  }

  // We no longer handle deletion and role changes directly in TeamPage.
  // These are now handled in the dedicated EmployeeProfilePage.

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingTop: '12px' }}>
      
      {/* Header section with prominent invite button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#ededed', margin: 0 }}>Team Members</h2>
          <p style={{ fontSize: '13px', color: '#a0a0a0', margin: '4px 0 0 0' }}>Manage access and roles for your CRM users.</p>
        </div>
        <button className="btn-primary" onClick={() => setInviteModalOpen(true)}>
          + Invite New Member
        </button>
      </div>

      {loading ? (
        <div style={{ color: '#555', fontSize: '13px', textAlign: 'center', padding: '40px' }}>Loading team...</div>
      ) : team.length === 0 ? (
        // Empty state
        <div style={{ textAlign: 'center', padding: '60px', background: '#1a1a1a', border: '0.5px solid #2a2a2a', borderRadius: '12px' }}>
          <div style={{ fontSize: '15px', color: '#ededed', fontWeight: '500', marginBottom: '8px' }}>No team members yet</div>
          <div style={{ fontSize: '13px', color: '#a0a0a0', marginBottom: '16px' }}>Invite your first team member to start collaborating.</div>
          <button className="btn-primary" onClick={() => setInviteModalOpen(true)}>+ Invite New Member</button>
        </div>
      ) : (
        // Cards Grid Layout
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {team.map(member => (
            <EmployeeCard 
              key={member.id} 
              member={member} 
              onViewProfile={onViewProfile} 
            />
          ))}
        </div>
      )}

      {inviteModalOpen && (
        <TeamInviteModal 
          onClose={() => setInviteModalOpen(false)}
          onSuccess={() => {
            setInviteModalOpen(false)
            fetchTeam()
          }}
        />
      )}

    </div>
  )
}
