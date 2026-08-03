import React from 'react'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activityLogger'
import { ACTIONS } from '../lib/activityActions'

export default function TodaysQueue({ leads = [], currentUserProfile, activeProject, onUpdateLead, showToast }) {
  // Determine actionable queue leads for current user
  const queueLeads = React.useMemo(() => {
    if (!leads || leads.length === 0) return []

    const currentUserId = currentUserProfile?.id

    // Filter leads assigned to user (or unassigned fallback if user has none)
    const userLeads = leads.filter(l => !currentUserId || l.assigned_to === currentUserId || !l.assigned_to)

    const flagged = userLeads.map(lead => {
      let reason = ''
      let priorityScore = 0

      const stage = (lead.stage || 'New').toLowerCase()
      const contacted = lead.contacted === 'Yes'
      const reply = lead.reply === 'Yes'
      const isHigh = lead.priority === 'High'

      // Check criteria
      if (isHigh && !contacted) {
        reason = '🔥 High priority — needs first contact'
        priorityScore = 3
      } else if (stage === 'contacted' && !reply) {
        reason = '⏳ Contacted — awaiting reply'
        priorityScore = 2
      } else if (!contacted) {
        reason = '📌 Needs initial outreach'
        priorityScore = 1
      }

      return { lead, reason, priorityScore }
    }).filter(item => item.reason !== '')

    // Sort by urgency and take top 5
    return flagged.sort((a, b) => b.priorityScore - a.priorityScore).slice(0, 5)
  }, [leads, currentUserProfile])

  const handleQuickAction = async (lead, actionType) => {
    let updates = {}
    let logDetail = ''

    if (actionType === 'log_call') {
      updates = { contacted: 'Yes', stage: 'Contacted', updated_at: new Date().toISOString() }
      logDetail = 'Logged call with lead'
    } else if (actionType === 'mark_replied') {
      updates = { reply: 'Yes', stage: 'Interested', updated_at: new Date().toISOString() }
      logDetail = 'Marked lead as replied'
    } else if (actionType === 'mark_interested') {
      updates = { stage: 'Interested', updated_at: new Date().toISOString() }
      logDetail = 'Marked lead as interested'
    }

    // 1. Local state update
    onUpdateLead({ ...lead, ...updates })
    if (showToast) showToast(`${logDetail} for ${lead.hospital_name || lead.lead_name}`)

    // 2. Supabase update
    const { error } = await supabase.from('leads').update(updates).eq('id', lead.id)

    if (!error) {
      logActivity({
        action: ACTIONS.LEAD_UPDATED,
        entityType: 'lead',
        entityId: lead.id,
        projectId: activeProject?.id,
        metadata: { detail: logDetail, ...updates }
      })
    }
  }

  if (queueLeads.length === 0) {
    return (
      <div style={{ background: '#161616', border: '0.5px solid #232323', borderRadius: '10px', padding: '16px 20px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '18px' }}>🎉</span>
          <div>
            <h4 className="font-headline" style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#f5f5f0' }}>Today's Queue Clear!</h4>
            <span style={{ fontSize: '11px', color: '#8a8a85' }}>All assigned leads have recent follow-up activity.</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: '#161616', border: '0.5px solid #232323', borderRadius: '10px', padding: '18px 20px', marginBottom: '24px' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>⚡</span>
          <h3 className="font-headline" style={{ fontSize: '14px', fontWeight: '700', color: '#f5f5f0', margin: 0 }}>
            TODAY'S QUEUE ({queueLeads.length})
          </h3>
        </div>
        <span style={{ fontSize: '11px', color: '#8a8a85' }}>Action required follow-ups</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {queueLeads.map(({ lead, reason }) => (
          <div
            key={lead.id}
            style={{
              background: '#121212',
              border: '0.5px solid #232323',
              borderRadius: '8px',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '200px' }}>
              <div style={{ fontWeight: '600', fontSize: '13px', color: '#f5f5f0' }}>
                {lead.hospital_name || lead.lead_name || 'Unnamed Lead'}
              </div>
              <div style={{ fontSize: '11px', color: '#8a8a85', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{reason}</span>
                {lead.phone && <span style={{ fontFamily: 'monospace', color: '#666' }}>• {lead.phone}</span>}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {lead.contacted !== 'Yes' && (
                <button
                  onClick={() => handleQuickAction(lead, 'log_call')}
                  className="btn-ghost"
                  style={{ padding: '4px 10px', fontSize: '11px', background: 'rgba(62, 207, 142, 0.1)', color: '#3ecf8e', borderColor: 'rgba(62, 207, 142, 0.25)' }}
                >
                  📞 Log Call
                </button>
              )}
              
              {lead.reply !== 'Yes' && (
                <button
                  onClick={() => handleQuickAction(lead, 'mark_replied')}
                  className="btn-ghost"
                  style={{ padding: '4px 10px', fontSize: '11px', background: 'rgba(234, 179, 8, 0.1)', color: '#facc15', borderColor: 'rgba(234, 179, 8, 0.25)' }}
                >
                  💬 Mark Replied
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

    </div>
  )
}
