import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { RoleBadge } from './EmployeeCard'

export default function AddUserScreen({ currentUserId }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('sales')
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetchPendingInvites()
  }, [])

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const fetchPendingInvites = async () => {
    setFetching(true)
    const { data, error } = await supabase
      .from('pending_invites')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setInvites(data)
    }
    setFetching(false)
  }

  const handleAddInvite = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!email) return

    const cleanEmail = email.toLowerCase().trim()
    setLoading(true)

    try {
      const { error: dbError } = await supabase
        .from('pending_invites')
        .upsert({
          email: cleanEmail,
          role,
          invited_by: currentUserId || null
        })

      if (dbError) throw new Error(dbError.message)

      setSuccess(`Invite added for ${cleanEmail} — they can now sign in with Google using this email.`)
      setEmail('')
      setRole('sales')
      fetchPendingInvites()
    } catch (err) {
      setError(err.message || 'Failed to add invite')
    } finally {
      setLoading(false)
    }
  }

  const handleRevoke = async (inviteEmail) => {
    if (!window.confirm(`Revoke pending invite for ${inviteEmail}?`)) return

    const { error } = await supabase
      .from('pending_invites')
      .delete()
      .eq('email', inviteEmail)

    if (!error) {
      setInvites(invites.filter(i => i.email !== inviteEmail))
      showToast(`Revoked invite for ${inviteEmail}`)
    } else {
      showToast(`Failed to revoke invite: ${error.message}`)
    }
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: '#1a1a1a', border: '0.5px solid #3ecf8e', borderRadius: '8px', padding: '10px 20px', color: '#3ecf8e', fontSize: '13px', zIndex: 999 }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#ededed', margin: 0 }}>Add Authorized User / Manage Invites</h2>
        <p style={{ fontSize: '13px', color: '#a0a0a0', margin: '4px 0 0 0' }}>Invite new workspace members by email and assign their role permissions before first login.</p>
      </div>

      {/* Invite Form Card */}
      <div style={{ background: '#1a1a1a', border: '0.5px solid #2a2a2a', borderRadius: '12px', padding: '24px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '500', color: '#ededed', margin: '0 0 16px 0' }}>New Member Invite</h3>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '0.5px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{ background: 'rgba(62, 207, 142, 0.1)', border: '0.5px solid rgba(62, 207, 142, 0.3)', color: '#3ecf8e', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
            {success}
          </div>
        )}

        <form onSubmit={handleAddInvite} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '12px', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#a0a0a0', marginBottom: '6px' }}>Email Address</label>
            <input
              required
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="input-base"
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#a0a0a0', marginBottom: '6px' }}>Role</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              className="input-base"
              style={{ width: '100%', boxSizing: 'border-box' }}
            >
              <option value="sales">Sales Rep</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="lead generator">Lead Generator</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ height: '38px', padding: '0 20px', whiteSpace: 'nowrap' }}
          >
            {loading ? 'Adding...' : '+ Add Invite'}
          </button>
        </form>
      </div>

      {/* Pending Invites List */}
      <div style={{ background: '#1a1a1a', border: '0.5px solid #2a2a2a', borderRadius: '12px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '500', color: '#ededed', margin: 0 }}>
            Pending Invites ({invites.length})
          </h3>
          <span style={{ fontSize: '12px', color: '#777' }}>Awaiting first Google login</span>
        </div>

        {fetching ? (
          <div style={{ color: '#555', fontSize: '13px', textAlign: 'center', padding: '20px' }}>Loading invites...</div>
        ) : invites.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px', color: '#555', fontSize: '13px', background: '#141414', borderRadius: '8px', border: '0.5px solid #222' }}>
            No pending invites. All workspace users have claimed their profiles.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {invites.map(invite => (
              <div
                key={invite.email}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: '#141414',
                  border: '0.5px solid #222',
                  borderRadius: '8px',
                  padding: '12px 16px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '14px', color: '#ededed', fontWeight: '500' }}>{invite.email}</span>
                  <RoleBadge role={invite.role} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span style={{ fontSize: '12px', color: '#555' }}>
                    {invite.created_at ? new Date(invite.created_at).toLocaleDateString() : ''}
                  </span>
                  <button
                    onClick={() => handleRevoke(invite.email)}
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '0.5px solid rgba(239, 68, 68, 0.3)',
                      color: '#f87171',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                    onMouseOver={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                    onMouseOut={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                  >
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
