import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import TeamInviteModal from './TeamInviteModal'

export default function TeamPage() {
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

  // Fetch profiles from the Supabase public.profiles table
  const fetchTeam = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('profiles').select('id, email, role').order('created_at', { ascending: true })
    if (data && !error) {
      setTeam(data)
    }
    setLoading(false)
  }

  // Handle role updates (directly updating profiles table)
  const handleRoleChange = async (userId, newRole) => {
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId)
    if (!error) {
      setTeam(team.map(member => member.id === userId ? { ...member, role: newRole } : member))
    } else {
      alert('Failed to update role')
    }
  }

  const handleDelete = async (userId, userEmail) => {
    // ── Confirmation dialog before removing ──
    if (!window.confirm(`Are you sure you want to remove ${userEmail} from the team? This action cannot be undone.`)) {
      return
    }

    // We cannot easily delete Auth users from the frontend, so we will show a message for now.
    alert('User removal requires backend action. Coming soon!')
  }

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
            <div key={member.id} style={{ background: '#1a1a1a', border: '0.5px solid #2a2a2a', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '600', color: '#ededed', textTransform: 'uppercase' }}>
                  {member.email ? member.email.charAt(0) : '?'}
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#ededed', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {member.email}
                  </div>
                  <div style={{ marginTop: '4px' }}>
                    <RoleBadge role={member.role} />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: 'auto', paddingTop: '16px', borderTop: '0.5px solid #2a2a2a' }}>
                <select 
                  className="input-base" 
                  value={member.role} 
                  onChange={(e) => handleRoleChange(member.id, e.target.value)}
                  style={{ flex: 1, padding: '6px 10px' }}
                >
                  <option value="admin">Admin</option>
                  <option value="employee">Employee</option>
                  <option value="viewer">Viewer</option>
                </select>
                {/* ── Remove Button Safety Rules ──
                    1. Never show if the member is the currently logged-in user.
                    2. Never show if the member is an admin (admins must be demoted first). */}
                {member.id !== currentUser && member.role !== 'admin' && (
                  <button 
                    onClick={() => handleDelete(member.id, member.email)}
                    style={{ background: 'none', border: '1px solid #333', borderRadius: '6px', color: '#f87171', padding: '6px 12px', cursor: 'pointer', fontSize: '12px' }}
                  >
                    Remove
                  </button>
                )}
              </div>

            </div>
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

// Role Badge Component rendering a pill with colors based on role
function RoleBadge({ role }) {
  if (role === 'admin') return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', background: 'rgba(62,207,142,0.1)', color: '#3ecf8e', border: '0.5px solid rgba(62,207,142,0.2)' }}>Admin</span>
  if (role === 'employee') return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '0.5px solid rgba(59,130,246,0.2)' }}>Employee</span>
  return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', background: 'rgba(156,163,175,0.1)', color: '#9ca3af', border: '0.5px solid rgba(156,163,175,0.2)' }}>Viewer</span>
}
