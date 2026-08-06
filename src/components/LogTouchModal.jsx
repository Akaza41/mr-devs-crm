import React, { useState, useEffect } from 'react'

const CHANNELS = [
  { id: 'call', label: 'Call', icon: '📞' },
  { id: 'gmail', label: 'Gmail', icon: '✉️' },
  { id: 'linkedin', label: 'LinkedIn', icon: '💼' },
  { id: 'instagram', label: 'Instagram', icon: '📸' },
  { id: 'whatsapp', label: 'WhatsApp', icon: '💬' },
  { id: 'other', label: 'Other', icon: '🌐' },
]

const OUTCOMES = [
  { id: 'answered', label: 'Answered', icon: '📞', defaultStage: 'Contacted' },
  { id: 'no_answer', label: 'No Answer', icon: '📵', defaultStage: 'Contacted' },
  { id: 'voicemail', label: 'Voicemail', icon: '📼', defaultStage: 'Contacted' },
  { id: 'replied', label: 'Replied', icon: '💬', defaultStage: 'Interested' },
  { id: 'not_interested', label: 'Not Interested', icon: '❌', defaultStage: 'Lost' },
]

export default function LogTouchModal({ lead, project, cadenceSettings = { no_answer_days: 2, voicemail_days: 2, answered_days: 4 }, onClose, onSubmit }) {
  // Determine default channel from project defaults or fallback to 'call'
  const projectDefaults = project?.default_channels || []
  const initialChannel = projectDefaults.length > 0 ? projectDefaults[0] : 'call'

  const [channel, setChannel] = useState(initialChannel)
  const [outcome, setOutcome] = useState('answered')
  const [notes, setNotes] = useState('')
  const [stageOption, setStageOption] = useState('Contacted')
  const [userToggledStage, setUserToggledStage] = useState(false)

  const handleOutcomeChange = (newOutcome) => {
    setOutcome(newOutcome)
    const outcomeObj = OUTCOMES.find(o => o.id === newOutcome)
    if (outcomeObj && !userToggledStage) {
      setStageOption(outcomeObj.defaultStage)
    }
  }

  // Calculate next follow-up due timestamp
  const calculateNextFollowup = () => {
    const now = new Date()
    if (outcome === 'no_answer') {
      const days = cadenceSettings.no_answer_days ?? 2
      now.setDate(now.getDate() + days)
      return now
    }
    if (outcome === 'voicemail') {
      const days = cadenceSettings.voicemail_days ?? 2
      now.setDate(now.getDate() + days)
      return now
    }
    if (outcome === 'answered') {
      const days = cadenceSettings.answered_days ?? 4
      now.setDate(now.getDate() + days)
      return now
    }
    return null // clear follow-up for not_interested or replied
  }

  const nextDueDate = calculateNextFollowup()

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!channel || !outcome) return

    onSubmit({
      channel,
      outcome,
      notes: notes.trim(),
      nextFollowupDue: nextDueDate ? nextDueDate.toISOString() : null,
      stage: stageOption
    })
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }}>
      <div className="modal" style={{ maxWidth: '460px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>⚡</span>
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#ededed' }}>
              Log Touch — {lead?.hospital_name || lead?.lead_name || 'Lead'}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8a8a85', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Channel Selection */}
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: '600', color: '#ededed' }}>
                Outreach Channel <span style={{ color: '#f87171' }}>*</span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                {CHANNELS.map(ch => {
                  const isSelected = channel === ch.id
                  const isProjectDefault = projectDefaults.includes(ch.id)
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => setChannel(ch.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '8px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: '500',
                        border: isSelected ? '1.5px solid #3ecf8e' : '1px solid rgba(255,255,255,0.08)',
                        background: isSelected ? 'rgba(62, 207, 142, 0.12)' : '#151518',
                        color: isSelected ? '#3ecf8e' : '#ededed',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        position: 'relative'
                      }}
                    >
                      <span>{ch.icon}</span>
                      <span>{ch.label}</span>
                      {isProjectDefault && !isSelected && (
                        <span style={{ position: 'absolute', top: '2px', right: '4px', fontSize: '8px', color: '#3ecf8e' }}>●</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Outcome Selection */}
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: '600', color: '#ededed' }}>
                Outcome <span style={{ color: '#f87171' }}>*</span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {OUTCOMES.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleOutcomeChange(item.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '500',
                      border: outcome === item.id ? '1.5px solid #3ecf8e' : '1px solid rgba(255,255,255,0.08)',
                      background: outcome === item.id ? 'rgba(62, 207, 142, 0.12)' : '#151518',
                      color: outcome === item.id ? '#3ecf8e' : '#ededed',
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

            {/* Cadence Follow-Up Due Date Preview */}
            <div style={{ background: '#151518', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#8a8a85', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Next Follow-Up Due</span>
              <span style={{ fontFamily: 'monospace', color: nextDueDate ? '#3ecf8e' : '#f87171', fontWeight: '600' }}>
                {nextDueDate ? nextDueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Cleared'}
              </span>
            </div>

            {/* Notes Field */}
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: '600', color: '#ededed' }}>
                Notes (Optional)
              </label>
              <textarea
                className="input-base"
                rows={3}
                placeholder="Sent proposal details via email, promised follow-up call..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>

            {/* Stage Selector / Checkbox */}
            <div style={{ background: '#151518', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', color: '#8a8a85', fontWeight: '600' }}>Update Lead Stage to</label>
              <select
                className="input-base"
                value={stageOption}
                onChange={e => {
                  setStageOption(e.target.value)
                  setUserToggledStage(true)
                }}
                style={{ fontSize: '12px' }}
              >
                <option value="New">New</option>
                <option value="Contacted">Contacted</option>
                <option value="Interested">Interested</option>
                <option value="Converted">Converted</option>
                <option value="Lost">Lost</option>
              </select>
            </div>

          </div>

          <div className="modal-footer" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" style={{ background: '#3ecf8e', color: '#000', fontWeight: '600' }}>
              Submit Touch & Update Queue
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
