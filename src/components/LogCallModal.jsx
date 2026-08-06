import React, { useState } from 'react'

export default function LogCallModal({ lead, onClose, onSubmit }) {
  const [outcome, setOutcome] = useState('Answered')
  const [notes, setNotes] = useState('')
  const [moveToContacted, setMoveToContacted] = useState(true)
  const [userToggledStage, setUserToggledStage] = useState(false)

  const outcomes = [
    { value: 'Answered', label: 'Answered', defaultStage: true, icon: '📞' },
    { value: 'No Answer', label: 'No Answer', defaultStage: false, icon: '📵' },
    { value: 'Voicemail', label: 'Voicemail', defaultStage: true, icon: '📼' },
    { value: 'Wrong Number', label: 'Wrong Number', defaultStage: false, icon: '❌' },
  ]

  const handleOutcomeChange = (newOutcome) => {
    setOutcome(newOutcome)
    const outcomeObj = outcomes.find(o => o.value === newOutcome)
    if (outcomeObj && !userToggledStage) {
      setMoveToContacted(outcomeObj.defaultStage)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!outcome) return
    onSubmit({
      outcome,
      notes: notes.trim(),
      moveToContacted
    })
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }}>
      <div className="modal" style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>📞</span>
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#ededed' }}>
              Log Call — {lead?.hospital_name || lead?.lead_name || 'Lead'}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8a8a85', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {lead?.phone && (
              <div style={{ background: '#151518', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#8a8a85', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Phone Number</span>
                <span style={{ fontFamily: 'monospace', color: '#3ecf8e', fontWeight: '600' }}>{lead.phone}</span>
              </div>
            )}

            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: '600', color: '#ededed' }}>
                Call Outcome <span style={{ color: '#f87171' }}>*</span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {outcomes.map(item => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => handleOutcomeChange(item.value)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '500',
                      border: outcome === item.value ? '1.5px solid #3ecf8e' : '1px solid rgba(255,255,255,0.08)',
                      background: outcome === item.value ? 'rgba(62, 207, 142, 0.12)' : '#151518',
                      color: outcome === item.value ? '#3ecf8e' : '#ededed',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
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
                placeholder="Spoke with Dr. Smith, requested proposal via email..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none', background: '#151518', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <input
                type="checkbox"
                checked={moveToContacted}
                onChange={e => {
                  setMoveToContacted(e.target.checked)
                  setUserToggledStage(true)
                }}
                style={{ accentColor: '#3ecf8e', width: '15px', height: '15px' }}
              />
              <span style={{ fontSize: '12px', color: '#ededed', fontWeight: '500' }}>
                Move to Contacted stage
              </span>
            </label>
          </div>

          <div className="modal-footer" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" style={{ background: '#3ecf8e', color: '#000', fontWeight: '600' }}>
              Submit & Remove from Queue
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
