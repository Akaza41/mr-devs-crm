import React from 'react'

// ── ROLE BADGE ──
// Exported so it can be reused in the Header and Editor components.
// Dynamically falls back to a generic gray pill for unknown future roles.
export function RoleBadge({ role }) {
  const r = role?.toLowerCase()
  if (r === 'admin') return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', background: 'rgba(62,207,142,0.1)', color: '#3ecf8e', border: '0.5px solid rgba(62,207,142,0.2)' }}>Admin</span>
  if (r === 'manager') return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', background: 'rgba(168,85,247,0.1)', color: '#a855f7', border: '0.5px solid rgba(168,85,247,0.2)' }}>Manager</span>
  if (r === 'sales') return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', background: 'rgba(234,179,8,0.1)', color: '#eab308', border: '0.5px solid rgba(234,179,8,0.2)' }}>Sales</span>
  if (r === 'lead generator') return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', background: 'rgba(236,72,153,0.1)', color: '#ec4899', border: '0.5px solid rgba(236,72,153,0.2)' }}>Lead Gen</span>
  if (r === 'viewer' || r === 'employee') return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '0.5px solid rgba(59,130,246,0.2)' }}>{r === 'employee' ? 'Employee' : 'Viewer'}</span>
  
  return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', background: 'rgba(156,163,175,0.1)', color: '#9ca3af', border: '0.5px solid rgba(156,163,175,0.2)', textTransform: 'capitalize' }}>{role || 'Unknown'}</span>
}

// ── EMPLOYEE CARD ──
// Reusable component displaying a summary of an employee.
// Receives data via props to remain decoupled from the data source.
export default function EmployeeCard({ member, isOnline, onViewProfile, isAdmin, onRoleChange }) {
  const displayName = member.full_name || member.username || 'Unnamed User'
  const initial = displayName.charAt(0).toUpperCase()

  return (
    <div style={{ background: '#1a1a1a', border: '0.5px solid #2a2a2a', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Header: Avatar, Name, Email, Status */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '600', color: '#ededed', flexShrink: 0 }}>
          {member.avatar_url ? (
            <img src={member.avatar_url} alt={displayName} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
          ) : initial}
        </div>
        
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '15px', fontWeight: '500', color: '#ededed', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {displayName}
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#a0a0a0' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: isOnline ? '#3ecf8e' : '#555' }}></div>
              {isOnline ? <span style={{ color: '#3ecf8e' }}>Online</span> : 'Offline'}
            </div>
          </div>
          
          <div style={{ fontSize: '12px', color: '#555', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {member.email}
          </div>
          
          <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RoleBadge role={member.role} />

            {/* Admin Direct Role Editor Dropdown */}
            {isAdmin && onRoleChange && (
              <select
                value={member.role || 'viewer'}
                onChange={e => onRoleChange(member.id, e.target.value)}
                style={{
                  background: '#141414',
                  border: '0.5px solid #333',
                  borderRadius: '6px',
                  color: '#a0a0a0',
                  fontSize: '11px',
                  padding: '2px 6px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="sales">Sales</option>
                <option value="lead generator">Lead Gen</option>
                <option value="viewer">Viewer</option>
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Metrics Grid (Populated from Phase 4 activity logs) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '8px', padding: '12px', background: '#141414', borderRadius: '8px', border: '0.5px solid #222' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase' }}>Leads Created</div>
          <div style={{ fontSize: '13px', color: '#a0a0a0', fontWeight: '500', marginTop: '2px' }}>{member.metrics?.leads_added || 0}</div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase' }}>Leads Updated</div>
          <div style={{ fontSize: '13px', color: '#a0a0a0', fontWeight: '500', marginTop: '2px' }}>{member.metrics?.leads_edited || 0}</div>
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <div style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase' }}>Total Activity</div>
          <div style={{ fontSize: '13px', color: '#a0a0a0', fontWeight: '500', marginTop: '2px' }}>{member.metrics?.total_actions || 0} actions recorded</div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ marginTop: 'auto', paddingTop: '8px' }}>
        <button 
          onClick={() => onViewProfile(member.id)}
          style={{ width: '100%', background: 'none', border: '0.5px solid #333', borderRadius: '6px', color: '#ededed', padding: '8px 0', cursor: 'pointer', fontSize: '13px', fontWeight: '500', transition: 'background 0.2s' }}
          onMouseOver={e => e.currentTarget.style.background = '#222'}
          onMouseOut={e => e.currentTarget.style.background = 'none'}
        >
          View Profile
        </button>
      </div>

    </div>
  )
}
