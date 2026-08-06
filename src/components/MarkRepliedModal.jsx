import React, { useState } from 'react'

export default function MarkRepliedModal({ lead, onClose, onSubmit }) {
  const [replyType, setReplyType] = useState('Interested')
  const [notes, setNotes] = useState('')

  const replyOptions = [
    { value: 'Interested', label: 'Interested', icon: '🌟', color: '#f2b84b', bg: 'rgba(242, 184, 75, 0.12)' },
    { value: 'Requesting Info', label: 'Requesting Info', icon: 'ℹ️', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.12)' },
    { value: 'Not Interested', label: 'Not Interested', icon: '👎', color: '#f87171', bg: 'rgba(248, 113, 113, 0.12)' },
  ]

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!replyType) return
    onSubmit({
      replyType,
      notes: notes.trim()
    })
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }}>
      <div className="modal" style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>💬</span>
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#ededed' }}>
              Mark Replied — {lead?.hospital_name || lead?.lead_name || 'Lead'}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8a8a85', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: '600', color: '#ededed' }}>
                Reply Outcome <span style={{ color: '#f87171' }}>*</span>
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {replyOptions.map(item => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setReplyType(item.value)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '500',
                      border: replyType === item.value ? `1.5px solid ${item.color}` : '1px solid rgba(255,255,255,0.08)',
                      background: replyType === item.value ? item.bg : '#151518',
                      color: replyType === item.value ? item.color : '#ededed',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>{item.icon}</span>
                    <span style={{ fontWeight: '600' }}>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: '600', color: '#ededed' }}>
                Notes (Optional)
              </label>
              <textarea
                className="input-base"
                rows={3}
                placeholder="Client requested pricing sheet for 50 beds..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>
          </div>

          <div className="modal-footer" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" style={{ background: '#f2b84b', color: '#000', fontWeight: '600' }}>
              Confirm Reply
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
