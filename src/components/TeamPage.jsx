import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import EmployeeCard from './team/EmployeeCard'
import AddMemberModal from './team/AddMemberModal'

export default function TeamPage({ onViewProfile }) {
  const [team, setTeam] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState(null)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    fetchTeam()
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUser(session?.user?.id || null)
    })
  }, [])

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  // Fetch profiles — select all fields the EmployeeCard needs to render correctly.
  // full_name and avatar_url were added to the schema in Phase 6 migration.
  const fetchTeam = async () => {
    setLoading(true)
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, email, role, full_name, avatar_url')
      .order('created_at', { ascending: true })

    if (profiles && !error) {
      // Fetch metrics for the entire team in one query
      const { data: metrics } = await supabase.rpc('get_team_metrics')
      
      const teamWithMetrics = profiles.map(member => {
        const memberMetrics = metrics?.find(m => m.user_id === member.id)
        return {
          ...member,
          metrics: memberMetrics || { leads_added: 0, leads_edited: 0, total_actions: 0, last_active: null }
        }
      })
      setTeam(teamWithMetrics)
    }
    setLoading(false)
  }

  // Determine if the current logged in user is an admin
  const currentUserProfile = team.find(m => m.id === currentUser)
  const isAdmin = currentUserProfile?.role === 'admin'

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
              onViewProfile={onViewProfile} 
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
