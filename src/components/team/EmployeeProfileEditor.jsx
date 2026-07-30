import React, { useState, useEffect } from 'react'
// ── Activity Logging ──
import { logActivity } from '../../lib/activityLogger'
import { ACTIONS } from '../../lib/activityActions'


// ── EMPLOYEE PROFILE EDITOR ──
// Form allowing admins to edit an employee's details.
// Note: Some rules apply (e.g. admins cannot demote themselves easily, etc.)
export default function EmployeeProfileEditor({ member, onSave, isCurrentUser }) {
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState('')

  useEffect(() => {
    if (member) {
      setFullName(member.full_name || '')
      setRole(member.role || 'viewer')
    }
  }, [member])

  const handleSave = async () => {
    // ── Detect if role specifically changed so we can fire ROLE_CHANGED in addition to PROFILE_UPDATED ──
    const roleChanged = role !== member.role
    
    const success = await onSave({ full_name: fullName, role })
    
    if (success) {
      // ── Log profile update (fire-and-forget, never blocks UI) ──
      logActivity({
        action: ACTIONS.PROFILE_UPDATED,
        entityType: 'profile',
        entityId: member.id,
        metadata: { full_name: fullName },
      })

      // ── Log role change as a separate event for cleaner audit trail ──
      if (roleChanged) {
        logActivity({
          action: ACTIONS.ROLE_CHANGED,
          entityType: 'profile',
          entityId: member.id,
          metadata: {
            target_email: member.email,
            old_role: member.role,
            new_role: role,
          },
        })
      }
    }
  }

  return (
    <div style={{ background: '#1a1a1a', border: '0.5px solid #2a2a2a', borderRadius: '12px', padding: '24px', marginTop: '24px' }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#ededed', fontWeight: '500' }}>Edit Profile</h3>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        
        <div className="form-group">
          <label style={{ fontSize: '12px', color: '#a0a0a0', marginBottom: '8px', display: 'block' }}>Full Name</label>
          <input 
            type="text" 
            className="input-base" 
            placeholder="John Doe" 
            value={fullName} 
            onChange={e => setFullName(e.target.value)} 
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
        </div>

        <div className="form-group">
          <label style={{ fontSize: '12px', color: '#a0a0a0', marginBottom: '8px', display: 'block' }}>System Role</label>
          <select 
            className="input-base" 
            value={role} 
            onChange={e => setRole(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box' }}
          >
            {/* Generic structure to allow arbitrary roles in the future */}
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="sales">Sales</option>
            <option value="lead generator">Lead Generator</option>
            <option value="employee">Employee</option>
            <option value="viewer">Viewer</option>
          </select>
        </div>

      </div>

      <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn-primary" onClick={handleSave}>
          Save Changes
        </button>
      </div>

    </div>
  )
}
