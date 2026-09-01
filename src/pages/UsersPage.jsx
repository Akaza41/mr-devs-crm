import { useState, useEffect } from 'react'
import { db } from '../lib/firebase'
import { collection, doc, getDocs, setDoc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore'
import { logActivity } from '../lib/activityLogger'
import { ACTIONS } from '../lib/activityActions'

function formatJoinedDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

function getInitial(fullName, email) {
  if (fullName && fullName.trim()) return fullName.trim().charAt(0).toUpperCase()
  if (email && email.includes('@')) return email.split('@')[0].charAt(0).toUpperCase()
  if (email) return email.charAt(0).toUpperCase()
  return '?'
}

export default function UsersPage({ currentUserId, onBack }) {
  const [profiles, setProfiles] = useState([])
  const [invites, setInvites] = useState([])
  const [loadingProfiles, setLoadingProfiles] = useState(true)
  const [loadingInvites, setLoadingInvites] = useState(true)
  
  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('sales')
  const [inviteTitle, setInviteTitle] = useState('')
  const [inviteSpecialties, setInviteSpecialties] = useState('')
  const [submittingInvite, setSubmittingInvite] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  
  const [toast, setToast] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const fetchActiveProfiles = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'asc')))
      const data = snap.docs.map(d => {
        const docData = d.data()
        return {
          id: d.id,
          full_name: docData.displayName || docData.email,
          email: docData.email || '',
          avatar_url: docData.photoURL || null,
          role: docData.role || 'sales',
          status: docData.active ? 'active' : 'suspended',
          created_at: docData.createdAt ? new Date(docData.createdAt.seconds * 1000).toISOString() : new Date().toISOString()
        }
      })
      setProfiles(data)
    } catch (err) {
      console.error('Error fetching users from Firestore:', err)
    } finally {
      setLoadingProfiles(false)
    }
  }

  const fetchPendingInvites = async () => {
    try {
      const snap = await getDocs(collection(db, 'pending_invites'))
      const data = snap.docs.map(d => ({
        id: d.id,
        email: d.id,
        ...d.data()
      }))
      setInvites(data)
    } catch (err) {
      console.error('Error fetching pending invites from Firestore:', err)
    } finally {
      setLoadingInvites(false)
    }
  }

  useEffect(() => {
    fetchActiveProfiles()
    fetchPendingInvites()
  }, [])

  const handleRoleChange = async (userId, userEmail, newRole) => {
    const target = profiles.find(p => p.id === userId)
    const oldRole = target?.role

    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole })
      setProfiles(profiles.map(p => p.id === userId ? { ...p, role: newRole } : p))
      showToast(`Updated ${userEmail || 'user'} role to ${newRole}`)
      logActivity({
        action: ACTIONS.ROLE_CHANGED,
        entityType: 'profile',
        entityId: userId,
        metadata: { target_email: userEmail, old_role: oldRole, new_role: newRole }
      })
    } catch (error) {
      showToast('Error updating role: ' + error.message)
    }
  }

  const handleStatusToggle = async (userId, userEmail, currentStatus) => {
    const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended'

    try {
      await updateDoc(doc(db, 'users', userId), { active: newStatus === 'active' })
      setProfiles(profiles.map(p => p.id === userId ? { ...p, status: newStatus } : p))
      showToast(newStatus === 'suspended' ? `Suspended ${userEmail}` : `Reactivated ${userEmail}`)
      logActivity({
        action: ACTIONS.STATUS_CHANGED,
        entityType: 'profile',
        entityId: userId,
        metadata: { target_email: userEmail, old_status: currentStatus, new_status: newStatus }
      })
    } catch (error) {
      showToast('Error updating status: ' + error.message)
    }
  }

  const handleRevokeInvite = async (inviteEmail) => {
    if (!window.confirm(`Revoke pending invite for ${inviteEmail}?`)) return

    try {
      await deleteDoc(doc(db, 'pending_invites', inviteEmail))
      setInvites(invites.filter(i => i.email !== inviteEmail))
      showToast(`Revoked pending invite for ${inviteEmail}`)
      logActivity({
        action: ACTIONS.USER_REMOVED,
        entityType: 'pending_invite',
        metadata: { email: inviteEmail }
      })
    } catch (error) {
      showToast('Error revoking invite: ' + error.message)
    }
  }

  const handleSendInvite = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    if (!inviteEmail) return

    const cleanEmail = inviteEmail.toLowerCase().trim()
    const specsArray = inviteSpecialties ? inviteSpecialties.split(',').map(s => s.trim()).filter(Boolean) : []
    setSubmittingInvite(true)

    try {
      await setDoc(doc(db, 'pending_invites', cleanEmail), {
        email: cleanEmail,
        role: inviteRole,
        title: inviteTitle.trim() || null,
        specialties: specsArray,
        invited_by: currentUserId || null,
        created_at: new Date().toISOString()
      }, { merge: true })

      showToast(`Invite created for ${cleanEmail}`)
      setInviteEmail('')
      setInviteTitle('')
      setInviteSpecialties('')
      setInviteRole('sales')
      setShowInviteModal(false)
      fetchPendingInvites()

      logActivity({
        action: ACTIONS.USER_INVITED,
        entityType: 'pending_invite',
        metadata: { email: cleanEmail, role: inviteRole }
      })
    } catch (err) {
      setErrorMsg(err.message || 'Failed to send invite')
    } finally {
      setSubmittingInvite(false)
    }
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: '#151518', border: '1px solid #3ecf8e', borderRadius: '10px', padding: '10px 20px', color: '#3ecf8e', fontSize: '13px', zIndex: 999, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {onBack && (
            <button onClick={onBack} style={{ background: '#242428', border: '1px solid rgba(255,255,255,0.08)', color: '#8a8a85', cursor: 'pointer', fontSize: '13px', padding: '6px 12px', borderRadius: '8px' }}>
              ← Back
            </button>
          )}
          <div>
            <h1 className="font-headline" style={{ fontSize: '22px', fontWeight: '800', color: '#f5f5f0', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>👤</span> USER MANAGEMENT & ACCESS
            </h1>
            <p style={{ fontSize: '13px', color: '#8a8a85', margin: '4px 0 0 0' }}>
              Single place to answer "who has access to my system and what can they do".
            </p>
          </div>
        </div>

        <button className="btn-primary" onClick={() => setShowInviteModal(true)}>
          + Invite New Member
        </button>
      </div>

      {/* ── SECTION 1: ACTIVE USERS ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 className="font-headline" style={{ fontSize: '16px', fontWeight: '700', color: '#f5f5f0', margin: 0 }}>
            Active Users ({profiles.length})
          </h2>
          <span style={{ fontSize: '12px', color: '#8a8a85' }}>Live workspace user accounts</span>
        </div>

        <div className="table-wrap">
          <table style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role (Admin Editable)</th>
                <th>Status</th>
                <th>Joined Date</th>
              </tr>
            </thead>
            <tbody>
              {loadingProfiles ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#8a8a85' }}>Loading user profiles...</td>
                </tr>
              ) : profiles.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#8a8a85' }}>No active user profiles found</td>
                </tr>
              ) : (
                profiles.map(user => {
                  const initial = getInitial(user.full_name, user.email)
                  const isSuspended = user.status === 'suspended'

                  return (
                    <tr key={user.id} style={{ opacity: isSuspended ? 0.6 : 1 }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#242428', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', color: '#f5f5f0', fontSize: '14px' }}>
                            {user.avatar_url ? (
                              <img src={user.avatar_url} alt={user.full_name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                            ) : (
                              initial
                            )}
                          </div>
                          <div>
                            <div style={{ fontWeight: '600', color: '#f5f5f0', fontSize: '13px' }}>
                              {user.full_name || 'Unnamed User'}
                            </div>
                            <div style={{ fontSize: '11px', color: '#8a8a85' }}>ID: {user.id.slice(0, 8)}...</div>
                          </div>
                        </div>
                      </td>

                      <td style={{ color: '#f5f5f0', fontWeight: '500' }}>
                        {user.email}
                      </td>

                      <td>
                        <select
                          value={user.role || 'sales'}
                          onChange={e => handleRoleChange(user.id, user.email, e.target.value)}
                          className="input-base"
                          style={{ padding: '4px 10px', fontSize: '12px', width: 'auto', background: '#242428' }}
                        >
                          <option value="admin">admin</option>
                          <option value="manager">manager</option>
                          <option value="sales">sales</option>
                          <option value="lead generator">lead generator</option>
                          <option value="viewer">viewer</option>
                        </select>
                      </td>

                      <td>
                        <button
                          onClick={() => handleStatusToggle(user.id, user.email, user.status)}
                          style={{
                            background: isSuspended ? 'rgba(239,68,68,0.15)' : 'rgba(62,207,142,0.15)',
                            color: isSuspended ? '#f87171' : '#3ecf8e',
                            border: `1px solid ${isSuspended ? 'rgba(239,68,68,0.3)' : 'rgba(62,207,142,0.3)'}`,
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          {isSuspended ? '⛔ Suspended' : '✅ Active'}
                        </button>
                      </td>

                      <td style={{ color: '#8a8a85', fontSize: '12px' }}>
                        {formatJoinedDate(user.created_at)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── SECTION 2: PENDING INVITES ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 className="font-headline" style={{ fontSize: '16px', fontWeight: '700', color: '#f5f5f0', margin: 0 }}>
            Pending Invites ({invites.length})
          </h2>
          <span style={{ fontSize: '12px', color: '#8a8a85' }}>Unclaimed email authorizations</span>
        </div>

        <div className="table-wrap">
          <table style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Email Address</th>
                <th>Assigned Role</th>
                <th>Title / Tags</th>
                <th>Invited Date</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loadingInvites ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#8a8a85' }}>Loading pending invites...</td>
                </tr>
              ) : invites.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#8a8a85' }}>No pending invites found</td>
                </tr>
              ) : (
                invites.map(inv => (
                  <tr key={inv.email}>
                    <td style={{ fontWeight: '600', color: '#f5f5f0' }}>
                      {inv.email}
                    </td>

                    <td>
                      <span className="badge badge-gray" style={{ textTransform: 'capitalize' }}>
                        {inv.role}
                      </span>
                    </td>

                    <td>
                      <div style={{ fontSize: '12px', color: '#8a8a85' }}>
                        {inv.title || '—'}
                      </div>
                    </td>

                    <td style={{ color: '#8a8a85', fontSize: '12px' }}>
                      {formatJoinedDate(inv.created_at)}
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => handleRevokeInvite(inv.email)}
                        className="btn-ghost"
                        style={{ color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.1)', padding: '4px 10px', fontSize: '12px' }}
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── INVITE NEW MEMBER MODAL ── */}
      {showInviteModal && (
        <div className="modal-overlay" onClick={() => setShowInviteModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="font-headline" style={{ fontSize: '16px', fontWeight: '700', color: '#f5f5f0', margin: 0 }}>
                Invite New Workspace Member
              </h3>
              <button onClick={() => setShowInviteModal(false)} style={{ background: 'none', border: 'none', color: '#8a8a85', fontSize: '18px', cursor: 'pointer' }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSendInvite}>
              <div className="modal-body">
                {errorMsg && (
                  <div className="col-span-2" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', padding: '10px 14px', borderRadius: '8px', fontSize: '13px' }}>
                    {errorMsg}
                  </div>
                )}

                <div className="form-group col-span-2">
                  <label>Email Address *</label>
                  <input
                    required
                    type="email"
                    placeholder="member@company.com"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    className="input-base"
                  />
                </div>

                <div className="form-group">
                  <label>Assign System Role *</label>
                  <select
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value)}
                    className="input-base"
                  >
                    <option value="sales">Sales Rep</option>
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="lead generator">Lead Generator</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Job Title (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Senior SDR"
                    value={inviteTitle}
                    onChange={e => setInviteTitle(e.target.value)}
                    className="input-base"
                  />
                </div>

                <div className="form-group col-span-2">
                  <label>Specialty Tags (Optional, comma separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. cold calling, enterprise"
                    value={inviteSpecialties}
                    onChange={e => setInviteSpecialties(e.target.value)}
                    className="input-base"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={() => setShowInviteModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submittingInvite || !inviteEmail}>
                  {submittingInvite ? 'Sending...' : 'Authorize & Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
