import React, { useState, useEffect } from 'react'
import { db } from '../../lib/firebase'
import { collection, doc, setDoc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore'
import { RoleBadge } from './EmployeeCard'
import { logActivity } from '../../lib/activityLogger'
import { ACTIONS } from '../../lib/activityActions'

function formatRelativeTime(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now - date) / 1000)

  if (diffInSeconds < 60) return 'just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`
  return date.toLocaleDateString()
}

export default function AddUserScreen({ currentUserId, onBack }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('sales')
  const [title, setTitle] = useState('')
  const [specialtiesInput, setSpecialtiesInput] = useState('')
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
    try {
      const snap = await getDocs(collection(db, 'pending_invites'))
      const data = snap.docs.map(d => ({
        id: d.id,
        email: d.id,
        ...d.data()
      }))
      setInvites(data)
    } catch (err) {
      console.error('Error fetching pending invites:', err)
    } finally {
      setFetching(false)
    }
  }

  const handleAddInvite = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!email) return

    const cleanEmail = email.toLowerCase().trim()
    const specsArray = specialtiesInput ? specialtiesInput.split(',').map(s => s.trim()).filter(Boolean) : []
    setLoading(true)

    try {
      await setDoc(doc(db, 'pending_invites', cleanEmail), {
        email: cleanEmail,
        role,
        title: title.trim() || null,
        specialties: specsArray,
        invited_by: currentUserId || null,
        created_at: new Date().toISOString()
      }, { merge: true })

      setSuccess(`Invite added for ${cleanEmail} — they can now sign in with Google.`)
      setEmail('')
      setTitle('')
      setSpecialtiesInput('')
      setRole('sales')
      fetchPendingInvites()

      logActivity({
        action: ACTIONS.USER_INVITED,
        entityType: 'pending_invite',
        metadata: { email: cleanEmail, role, title }
      })
    } catch (err) {
      setError(err.message || 'Failed to add invite')
    } finally {
      setLoading(false)
    }
  }

  const handleInviteRoleChange = async (inviteEmail, newRole) => {
    const invite = invites.find(i => i.email === inviteEmail)
    const oldRole = invite?.role

    try {
      await updateDoc(doc(db, 'pending_invites', inviteEmail), { role: newRole })
      setInvites(invites.map(i => i.email === inviteEmail ? { ...i, role: newRole } : i))
      showToast(`Updated invite role to ${newRole}`)
      logActivity({
        action: ACTIONS.INVITE_ROLE_UPDATED,
        entityType: 'pending_invite',
        metadata: { email: inviteEmail, old_role: oldRole, new_role: newRole }
      })
    } catch (err) {
      showToast('Failed to update invite role: ' + err.message)
    }
  }

  const handleRevoke = async (inviteEmail) => {
    if (!window.confirm(`Revoke pending invite for ${inviteEmail}?`)) return

    try {
      await deleteDoc(doc(db, 'pending_invites', inviteEmail))
      setInvites(invites.filter(i => i.email !== inviteEmail))
      showToast(`Revoked invite for ${inviteEmail}`)
      logActivity({
        action: ACTIONS.USER_REMOVED,
        entityType: 'pending_invite',
        metadata: { email: inviteEmail }
      })
    } catch (err) {
      showToast(`Failed to revoke invite: ${err.message}`)
    }
  }

  return (
    <div style={{ maxWidth: '840px', margin: '0 auto', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: '#161616', border: '0.5px solid #3ecf8e', borderRadius: '8px', padding: '10px 20px', color: '#3ecf8e', fontSize: '13px', zIndex: 999 }}>
          {toast}
        </div>
      )}

      {onBack && (
        <button 
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: '#8a8a85', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <span>←</span> Back
        </button>
      )}

      {/* Header */}
      <div>
        <h2 className="font-headline" style={{ fontSize: '20px', fontWeight: '700', color: '#f5f5f0', margin: 0 }}>Add Authorized User / Manage Invites</h2>
        <p style={{ fontSize: '13px', color: '#8a8a85', margin: '4px 0 0 0' }}>Invite new workspace members by email, assign their system role, job title, and specialty tags before first login.</p>
      </div>

      {/* Invite Form Card */}
      <div style={{ background: '#161616', border: '0.5px solid #232323', borderRadius: '12px', padding: '24px' }}>
        <h3 className="font-headline" style={{ fontSize: '15px', fontWeight: '600', color: '#f5f5f0', margin: '0 0 16px 0' }}>New Member Invite</h3>

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

        <form onSubmit={handleAddInvite} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#8a8a85', marginBottom: '6px' }}>Email Address *</label>
              <input
                required
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input-base"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#8a8a85', marginBottom: '6px' }}>System Role *</label>
              <select
                value={role}
                onChange={e => setRole(e.target.value)}
                className="input-base"
              >
                <option value="sales">Sales Rep</option>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="lead generator">Lead Generator</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#8a8a85', marginBottom: '6px' }}>Job Title (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Senior SDR, Account Exec"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="input-base"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#8a8a85', marginBottom: '6px' }}>Specialty Tags (Optional, comma-separated)</label>
              <input
                type="text"
                placeholder="e.g. cold calling, LinkedIn outreach, SaaS sales"
                value={specialtiesInput}
                onChange={e => setSpecialtiesInput(e.target.value)}
                className="input-base"
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button type="submit" className="btn-primary" disabled={loading || !email}>
              {loading ? 'Adding Invite...' : '+ Add Member Invite'}
            </button>
          </div>
        </form>
      </div>

      {/* Pending Invites Table */}
      <div style={{ background: '#161616', border: '0.5px solid #232323', borderRadius: '12px', padding: '24px' }}>
        <h3 className="font-headline" style={{ fontSize: '15px', fontWeight: '600', color: '#f5f5f0', margin: '0 0 16px 0' }}>
          Pending Authorizations ({invites.length})
        </h3>

        {fetching ? (
          <div style={{ color: '#8a8a85', fontSize: '13px', textAlign: 'center', padding: '20px' }}>Loading invites...</div>
        ) : invites.length === 0 ? (
          <div style={{ color: '#8a8a85', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
            No pending invites. Anyone with a Google account not listed here will be blocked from logging in.
          </div>
        ) : (
          <div className="table-wrap">
            <table style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Title</th>
                  <th>Specialties</th>
                  <th>Role</th>
                  <th>Invited</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {invites.map(inv => (
                  <tr key={inv.email}>
                    <td style={{ fontWeight: '500', color: '#f5f5f0' }}>{inv.email}</td>
                    <td style={{ color: '#8a8a85', fontSize: '12px' }}>{inv.title || '—'}</td>
                    <td>
                      {inv.specialties && inv.specialties.length > 0 ? (
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {inv.specialties.map(tag => (
                            <span key={tag} style={{ background: '#232323', color: '#3ecf8e', padding: '1px 6px', borderRadius: '4px', fontSize: '10px' }}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: '#666', fontSize: '12px' }}>—</span>
                      )}
                    </td>
                    <td>
                      <select
                        value={inv.role}
                        onChange={e => handleInviteRoleChange(inv.email, e.target.value)}
                        className="input-base"
                        style={{ padding: '3px 8px', fontSize: '12px' }}
                      >
                        <option value="sales">sales</option>
                        <option value="admin">admin</option>
                        <option value="manager">manager</option>
                        <option value="lead generator">lead generator</option>
                        <option value="viewer">viewer</option>
                      </select>
                    </td>
                    <td style={{ color: '#8a8a85', fontSize: '12px' }}>{formatRelativeTime(inv.created_at)}</td>
                    <td>
                      <button
                        onClick={() => handleRevoke(inv.email)}
                        className="btn-ghost"
                        style={{ color: '#ef4444', padding: '4px 8px', fontSize: '12px' }}
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
