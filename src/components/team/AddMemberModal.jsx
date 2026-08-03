import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function AddMemberModal({ onClose, onSuccess }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState('sales') // Default role
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
    let pass = ''
    for (let i = 0; i < 12; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setPassword(pass)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const cleanEmail = email.toLowerCase().trim()
      const { data: { session } } = await supabase.auth.getSession()

      // 1. Add to pending_invites table
      const { error: inviteError } = await supabase
        .from('pending_invites')
        .upsert({
          email: cleanEmail,
          role,
          invited_by: session?.user?.id || null
        })

      if (inviteError) {
        throw new Error(inviteError.message || 'Failed to record pending invite')
      }

      // 2. If password provided, invoke create_user Edge Function to create password account immediately
      if (password) {
        const { data, error: invokeError } = await supabase.functions.invoke('create_user', {
          body: { email: cleanEmail, password, full_name: fullName, role }
        })

        if (invokeError) {
          throw new Error(invokeError.message || 'Failed to invoke edge function')
        }

        if (data?.error) {
          throw new Error(data.message || data.error)
        }

        if (data?.success) {
          onSuccess(data.user)
          return
        }
      }

      onSuccess({ email: cleanEmail, full_name: fullName, role })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        background: '#1a1a1a', padding: '32px', borderRadius: '16px', width: '100%', maxWidth: '420px',
        border: '0.5px solid #333', boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
      }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#ededed', margin: 0 }}>Add Team Member</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', fontSize: '20px', cursor: 'pointer', padding: 0 }}>&times;</button>
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '12px', borderRadius: '8px', fontSize: '13px', marginBottom: '20px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#a0a0a0', marginBottom: '6px' }}>Full Name</label>
            <input 
              required
              type="text" 
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="e.g. Jane Doe"
              style={{ width: '100%', background: '#0f0f0f', border: '0.5px solid #333', borderRadius: '8px', padding: '10px 12px', color: '#ededed', fontSize: '14px', outline: 'none' }}
              onFocus={e => e.target.style.borderColor = '#3ecf8e'}
              onBlur={e => e.target.style.borderColor = '#333'}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#a0a0a0', marginBottom: '6px' }}>Email Address</label>
            <input 
              required
              type="email" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="jane@example.com"
              style={{ width: '100%', background: '#0f0f0f', border: '0.5px solid #333', borderRadius: '8px', padding: '10px 12px', color: '#ededed', fontSize: '14px', outline: 'none' }}
              onFocus={e => e.target.style.borderColor = '#3ecf8e'}
              onBlur={e => e.target.style.borderColor = '#333'}
            />
          </div>

          <div>
            <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '500', color: '#a0a0a0', marginBottom: '6px' }}>
              <span>Temporary Password</span>
              <span onClick={generatePassword} style={{ color: '#3ecf8e', cursor: 'pointer', fontWeight: '600' }}>Generate</span>
            </label>
            <input 
              required
              type="text" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Min 6 characters"
              style={{ width: '100%', background: '#0f0f0f', border: '0.5px solid #333', borderRadius: '8px', padding: '10px 12px', color: '#ededed', fontSize: '14px', outline: 'none' }}
              onFocus={e => e.target.style.borderColor = '#3ecf8e'}
              onBlur={e => e.target.style.borderColor = '#333'}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#a0a0a0', marginBottom: '6px' }}>Role</label>
            <select 
              value={role} 
              onChange={e => setRole(e.target.value)}
              style={{ width: '100%', background: '#0f0f0f', border: '0.5px solid #333', borderRadius: '8px', padding: '10px 12px', color: '#ededed', fontSize: '14px', outline: 'none', appearance: 'none' }}
            >
              <option value="sales">Sales Rep</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="lead generator">Lead Generator</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button 
              type="button" 
              onClick={onClose}
              style={{ flex: 1, padding: '12px', background: 'transparent', border: '0.5px solid #444', borderRadius: '8px', color: '#ccc', cursor: 'pointer', fontSize: '14px', fontWeight: '500', transition: 'background 0.2s' }}
              onMouseOver={e => e.currentTarget.style.background = '#222'}
              onMouseOut={e => e.currentTarget.style.background = 'transparent'}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading}
              style={{ flex: 1, padding: '12px', background: '#3ecf8e', border: 'none', borderRadius: '8px', color: '#000', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '600', transition: 'opacity 0.2s', opacity: loading ? 0.7 : 1 }}
              onMouseOver={e => { if(!loading) e.currentTarget.style.opacity = 0.9 }}
              onMouseOut={e => { if(!loading) e.currentTarget.style.opacity = 1 }}
            >
              {loading ? 'Creating...' : 'Create Account'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}
