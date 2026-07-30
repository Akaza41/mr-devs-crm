import React from 'react'
import { RoleBadge } from './EmployeeCard'

// ── EMPLOYEE HEADER ──
// Renders the top section of the profile page (Avatar, Name, Role, Date Joined).
export default function EmployeeHeader({ member }) {
  if (!member) return null

  const displayName = member.full_name || member.username || 'Unnamed User'
  const initial = displayName.charAt(0).toUpperCase()
  
  // Format join date if available
  const joinedDate = member.created_at 
    ? new Date(member.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) 
    : 'Unknown'

  // Calculate online status
  const isOnline = member.metrics?.last_active && (new Date() - new Date(member.metrics.last_active)) < 15 * 60 * 1000

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', background: '#1a1a1a', padding: '24px', borderRadius: '12px', border: '0.5px solid #2a2a2a' }}>
      
      {/* Avatar */}
      <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: '600', color: '#ededed', flexShrink: 0 }}>
        {member.avatar_url ? (
          <img src={member.avatar_url} alt={displayName} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
        ) : initial}
      </div>

      {/* Info details */}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#ededed', margin: 0 }}>{displayName}</h2>
          <RoleBadge role={member.role} />
        </div>
        
        <div style={{ fontSize: '14px', color: '#a0a0a0', marginTop: '6px' }}>
          {member.email}
        </div>
        
        <div style={{ display: 'flex', gap: '24px', marginTop: '12px', fontSize: '13px', color: '#555' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isOnline ? '#3ecf8e' : '#555' }}></div>
            {isOnline ? <span style={{ color: '#3ecf8e' }}>Online</span> : 'Offline'}
          </div>
          <div>
            Joined: <span style={{ color: '#a0a0a0' }}>{joinedDate}</span>
          </div>
        </div>
      </div>

    </div>
  )
}
