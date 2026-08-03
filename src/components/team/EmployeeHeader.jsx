import React from 'react'
import { RoleBadge } from './EmployeeCard'

export default function EmployeeHeader({ member }) {
  if (!member) return null

  const displayName = member.full_name || member.username || member.email || 'Unnamed User'
  const initial = displayName.charAt(0).toUpperCase()
  
  const joinedDate = member.join_date 
    ? new Date(member.join_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : member.created_at
    ? new Date(member.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) 
    : 'Unknown'

  const isOnline = member.metrics?.last_active && (new Date() - new Date(member.metrics.last_active)) < 15 * 60 * 1000

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: '#161616', padding: '24px', borderRadius: '12px', border: '0.5px solid #232323' }}>
      
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px', flexWrap: 'wrap' }}>
        
        {/* Avatar with live presence indicator */}
        <div style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '50%', background: '#232323', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: '600', color: '#f5f5f0', flexShrink: 0 }}>
          {member.avatar_url ? (
            <img src={member.avatar_url} alt={displayName} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
          ) : initial}
          <div
            style={{
              position: 'absolute',
              bottom: '2px',
              right: '2px',
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              background: isOnline ? '#3ecf8e' : '#555',
              border: '2.5px solid #161616',
              boxShadow: isOnline ? '0 0 8px rgba(62,207,142,0.6)' : 'none'
            }}
            title={isOnline ? 'Online now' : 'Offline'}
          />
        </div>

        {/* Info details */}
        <div style={{ flex: 1, minWidth: '240px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h2 className="font-headline" style={{ fontSize: '22px', fontWeight: '700', color: '#f5f5f0', margin: 0 }}>{displayName}</h2>
            <RoleBadge role={member.role} />
            {isOnline && (
              <span style={{ fontSize: '11px', color: '#3ecf8e', background: 'rgba(62,207,142,0.15)', padding: '2px 8px', borderRadius: '10px', fontWeight: '600' }}>
                Online
              </span>
            )}
          </div>
          
          {/* Job Title & Email */}
          <div style={{ fontSize: '13px', color: '#8a8a85', marginTop: '4px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            {member.title && <span style={{ color: '#f5f5f0', fontWeight: '600' }}>{member.title}</span>}
            <span>{member.email}</span>
            {member.phone && <span>📞 {member.phone}</span>}
          </div>

          {/* Bio */}
          {member.bio && (
            <p style={{ fontSize: '13px', color: '#d4d4d4', margin: '10px 0 0 0', lineHeight: '1.4' }}>
              {member.bio}
            </p>
          )}

          {/* Specialty Tags */}
          {member.specialties && member.specialties.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '12px' }}>
              {member.specialties.map(tag => (
                <span
                  key={tag}
                  style={{
                    background: 'rgba(62,207,142,0.12)',
                    color: '#3ecf8e',
                    border: '0.5px solid rgba(62,207,142,0.3)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: '500'
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          
          <div style={{ marginTop: '12px', fontSize: '12px', color: '#666' }}>
            Joined workspace: <span style={{ color: '#8a8a85' }}>{joinedDate}</span>
          </div>
        </div>

      </div>

    </div>
  )
}
