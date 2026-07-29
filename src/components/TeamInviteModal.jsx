import { useState } from 'react'

export default function TeamInviteModal({ onClose, onSuccess }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('viewer')
  
  const handleSubmit = async () => {
    if (!email || !password) {
      alert('Email and password are required.')
      return
    }

    // Mock invite action
    alert('Invite feature coming soon — Edge Function needed.')
    
    // Normally we would wait for the Edge Function, then:
    // onSuccess() 
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: '400px' }}>
        
        <div className="modal-header">
          <span style={{ fontSize: '13px', fontWeight: '500', color: '#ededed' }}>Invite Team Member</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>×</button>
        </div>
        
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '24px' }}>
          
          <div className="form-group">
            <label>Full Name</label>
            <input 
              type="text" 
              className="input-base" 
              placeholder="e.g. John Doe" 
              value={fullName} 
              onChange={e => setFullName(e.target.value)} 
            />
          </div>

          <div className="form-group">
            <label>Email Address</label>
            <input 
              type="email" 
              className="input-base" 
              placeholder="e.g. name@mrdevs.com" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
            />
          </div>

          <div className="form-group">
            <label>Temporary Password</label>
            <input 
              type="password" 
              className="input-base" 
              placeholder="Must be at least 6 characters" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
            />
          </div>

          <div className="form-group">
            <label>Access Role</label>
            <select className="input-base" value={role} onChange={e => setRole(e.target.value)}>
              <option value="admin">Admin (Full Access & Billing)</option>
              <option value="employee">Employee (Can edit leads)</option>
              <option value="viewer">Viewer (Read-only)</option>
            </select>
          </div>

        </div>

        <div className="modal-footer" style={{ justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSubmit}>Send Invite</button>
        </div>

      </div>
    </div>
  )
}
