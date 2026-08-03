import React from 'react'

// ── ROLE BADGE ──
export function RoleBadge({ role }) {
  const r = role?.toLowerCase()
  if (r === 'admin') return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', background: 'rgba(62,207,142,0.1)', color: '#3ecf8e', border: '0.5px solid rgba(62,207,142,0.2)' }}>Admin</span>
  if (r === 'manager') return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', background: 'rgba(168,85,247,0.1)', color: '#a855f7', border: '0.5px solid rgba(168,85,247,0.2)' }}>Manager</span>
  if (r === 'sales') return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', background: 'rgba(234,179,8,0.1)', color: '#eab308', border: '0.5px solid rgba(234,179,8,0.2)' }}>Sales</span>
  if (r === 'lead generator') return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', background: 'rgba(236,72,153,0.1)', color: '#ec4899', border: '0.5px solid rgba(236,72,153,0.2)' }}>Lead Gen</span>
  if (r === 'viewer' || r === 'employee') return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '0.5px solid rgba(59,130,246,0.2)' }}>{r === 'employee' ? 'Employee' : 'Viewer'}</span>
  
  return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', background: 'rgba(156,163,175,0.1)', color: '#9ca3af', border: '0.5px solid rgba(156,163,175,0.2)', textTransform: 'capitalize' }}>{role || 'Unknown'}</span>
}

// ── STATUS BADGE ──
export function StatusBadge({ status }) {
  const isSuspended = status === 'suspended'
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '12px',
      fontSize: '11px',
      fontWeight: '600',
      background: isSuspended ? 'rgba(239,68,68,0.1)' : 'rgba(62,207,142,0.1)',
      color: isSuspended ? '#ef4444' : '#3ecf8e',
      border: `0.5px solid ${isSuspended ? 'rgba(239,68,68,0.3)' : 'rgba(62,207,142,0.3)'}`
    }}>
      {isSuspended ? 'Suspended' : 'Active'}
    </span>
  )
}

// ── EMPLOYEE CARD ──
export default function EmployeeCard({ member, isOnline, onViewProfile, isAdmin, onRoleChange, onStatusChange }) {
  const displayName = member.full_name || member.username || 'Unnamed User'
  const initial = displayName.charAt(0).toUpperCase()
  const isSuspended = member.status === 'suspended'

  return (
    <div style={{
      background: '#1a1a1a',
      border: `0.5px solid ${isSuspended ? 'rgba(239, 68, 68, 0.4)' : '#2a2a2a'}`,
      borderRadius: '12px',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      opacity: isSuspended ? 0.8 : 1
    }}>
      
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
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: isOnline && !isSuspended ? '#3ecf8e' : '#555' }}></div>
              {isOnline && !isSuspended ? <span style={{ color: '#3ecf8e' }}>Online</span> : 'Offline'}
            </div>
          </div>
          
          <div style={{ fontSize: '12px', color: '#555', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {member.email}
          </div>
          
          <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <RoleBadge role={member.role} />
            <StatusBadge status={member.status} />

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

      {/* Metrics Grid */}
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
      <div style={{ marginTop: 'auto', paddingTop: '8px', display: 'flex', gap: '8px' }}>
        <button 
          onClick={() => onViewProfile(member.id)}
          style={{ flex: 1, background: 'none', border: '0.5px solid #333', borderRadius: '6px', color: '#ededed', padding: '8px 0', cursor: 'pointer', fontSize: '13px', fontWeight: '500', transition: 'background 0.2s' }}
          onMouseOver={e => e.currentTarget.style.background = '#222'}
          onMouseOut={e => e.currentTarget.style.background = 'none'}
        >
          View Profile
        </button>

        {isAdmin && onStatusChange && (
          <button
            onClick={() => onStatusChange(member.id, isSuspended ? 'active' : 'suspended')}
            style={{
              padding: '8px 12px',
              background: isSuspended ? 'rgba(62,207,142,0.1)' : 'rgba(239,68,68,0.1)',
              border: `0.5px solid ${isSuspended ? 'rgba(62,207,142,0.3)' : 'rgba(239,68,68,0.3)'}`,
              color: isSuspended ? '#3ecf8e' : '#f87171',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '500',
              whiteSpace: 'nowrap'
            }}
          >
            {isSuspended ? 'Reactivate' : 'Suspend'}
          </button>
        )}
      </div>

    </div>
  )
}
