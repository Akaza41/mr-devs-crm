import React, { useState, useEffect } from 'react'
import { logActivity } from '../../lib/activityLogger'
import { ACTIONS } from '../../lib/activityActions'

export default function EmployeeProfileEditor({ member, onSave, isCurrentUser }) {
  const [fullName, setFullName] = useState('')
  const [title, setTitle] = useState('')
  const [phone, setPhone] = useState('')
  const [bio, setBio] = useState('')
  const [specialtiesInput, setSpecialtiesInput] = useState('')
  const [role, setRole] = useState('')

  useEffect(() => {
    if (member) {
      setFullName(member.full_name || '')
      setTitle(member.title || '')
      setPhone(member.phone || '')
      setBio(member.bio || '')
      setSpecialtiesInput(Array.isArray(member.specialties) ? member.specialties.join(', ') : '')
      setRole(member.role || 'viewer')
    }
  }, [member])

  const handleSave = async () => {
    const roleChanged = role !== member.role
    const specsArray = specialtiesInput ? specialtiesInput.split(',').map(s => s.trim()).filter(Boolean) : []

    const payload = {
      full_name: fullName,
      title,
      phone,
      bio,
      specialties: specsArray,
      role
    }
    
    const success = await onSave(payload)
    
    if (success) {
      logActivity({
        action: ACTIONS.PROFILE_UPDATED,
        entityType: 'profile',
        entityId: member.id,
        metadata: { full_name: fullName, title },
      })

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
    <div style={{ background: '#161616', border: '0.5px solid #232323', borderRadius: '12px', padding: '24px', marginTop: '24px' }}>
      <h3 className="font-headline" style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#f5f5f0', fontWeight: '600' }}>Edit Profile Details</h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="form-group">
            <label style={{ fontSize: '12px', color: '#8a8a85', marginBottom: '6px', display: 'block' }}>Full Name</label>
            <input 
              type="text" 
              className="input-base" 
              placeholder="John Doe" 
              value={fullName} 
              onChange={e => setFullName(e.target.value)} 
            />
          </div>

          <div className="form-group">
            <label style={{ fontSize: '12px', color: '#8a8a85', marginBottom: '6px', display: 'block' }}>Job Title</label>
            <input 
              type="text" 
              className="input-base" 
              placeholder="e.g. Senior SDR" 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="form-group">
            <label style={{ fontSize: '12px', color: '#8a8a85', marginBottom: '6px', display: 'block' }}>Phone Number</label>
            <input 
              type="text" 
              className="input-base" 
              placeholder="+1 (555) 000-0000" 
              value={phone} 
              onChange={e => setPhone(e.target.value)} 
            />
          </div>

          <div className="form-group">
            <label style={{ fontSize: '12px', color: '#8a8a85', marginBottom: '6px', display: 'block' }}>System Role</label>
            <select 
              className="input-base" 
              value={role} 
              onChange={e => setRole(e.target.value)}
            >
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="sales">Sales</option>
              <option value="lead generator">Lead Generator</option>
              <option value="employee">Employee</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label style={{ fontSize: '12px', color: '#8a8a85', marginBottom: '6px', display: 'block' }}>Specialties (Comma-separated tags)</label>
          <input 
            type="text" 
            className="input-base" 
            placeholder="e.g. cold calling, LinkedIn outreach, SaaS sales, healthcare" 
            value={specialtiesInput} 
            onChange={e => setSpecialtiesInput(e.target.value)} 
          />
        </div>

        <div className="form-group">
          <label style={{ fontSize: '12px', color: '#8a8a85', marginBottom: '6px', display: 'block' }}>Short Bio</label>
          <textarea 
            className="input-base" 
            rows="3"
            placeholder="Brief bio or focus areas..." 
            value={bio} 
            onChange={e => setBio(e.target.value)} 
          />
        </div>

      </div>

      <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn-primary" onClick={handleSave}>
          Save Profile Changes
        </button>
      </div>

    </div>
  )
}
