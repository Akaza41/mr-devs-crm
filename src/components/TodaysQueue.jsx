import React, { useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activityLogger'
import LogCallModal from './LogCallModal'
import MarkRepliedModal from './MarkRepliedModal'

export default function TodaysQueue({ leads = [], currentUserProfile, activeProject, onUpdateLead, showToast }) {
  const [selectedCallLead, setSelectedCallLead] = useState(null)
  const [selectedReplyLead, setSelectedReplyLead] = useState(null)

  // Determine actionable queue leads for current user
  const queueLeads = useMemo(() => {
    if (!leads || leads.length === 0) return []

    const currentUserId = currentUserProfile?.id

    // Filter leads assigned to user (or unassigned fallback if user has none)
    const userLeads = leads.filter(l => !currentUserId || l.assigned_to === currentUserId || !l.assigned_to)

    const flagged = userLeads.map(lead => {
      let reason = ''
      let priorityScore = 0

      const contacted = lead.contacted === 'Yes'
      const isHigh = lead.priority === 'High'

      // Check criteria (queue targets leads that need first contact)
      if (isHigh && !contacted) {
        reason = '🔥 High priority — needs first contact'
        priorityScore = 3
      } else if (!contacted) {
        reason = '📌 Needs initial outreach'
        priorityScore = 1
      }

      return { lead, reason, priorityScore }
    }).filter(item => item.reason !== '')

    // Sort by urgency and take top 5
    return flagged.sort((a, b) => b.priorityScore - a.priorityScore).slice(0, 5)
  }, [leads, currentUserProfile])

  const handleCallSubmit = async ({ outcome, notes, moveToContacted }) => {
    if (!selectedCallLead) return
    const lead = selectedCallLead
    setSelectedCallLead(null)

    const updatedNotes = notes
      ? (lead.notes ? `${lead.notes}\n[Call: ${outcome}] ${notes}` : `[Call: ${outcome}] ${notes}`)
      : lead.notes

    const updates = {
      contacted: 'Yes',
      stage: moveToContacted ? 'Contacted' : lead.stage,
      notes: updatedNotes,
      updated_at: new Date().toISOString()
    }

    // 1. Local state update (removes lead from queue immediately)
    onUpdateLead({ ...lead, ...updates })
    if (showToast) showToast(`Call logged (${outcome}) for ${lead.hospital_name || lead.lead_name || 'Lead'}`)

    // 2. Supabase update
    const { error } = await supabase.from('leads').update(updates).eq('id', lead.id)

    // 3. Write to activity_logs via logActivity helper
    if (!error) {
      logActivity({
        action: 'lead.call_logged',
        entityType: 'lead',
        entityId: lead.id,
        projectId: activeProject?.id,
        metadata: { outcome, notes, moved_to_contacted: moveToContacted }
      })
    }
  }

  const handleReplySubmit = async ({ replyType, notes }) => {
    if (!selectedReplyLead) return
    const lead = selectedReplyLead
    setSelectedReplyLead(null)

    const updatedNotes = notes
      ? (lead.notes ? `${lead.notes}\n[Reply: ${replyType}] ${notes}` : `[Reply: ${replyType}] ${notes}`)
      : lead.notes

    let newStage = lead.stage
    if (replyType === 'Interested' || replyType === 'Requesting Info') {
      newStage = 'Interested'
    } else if (replyType === 'Not Interested') {
      newStage = 'Lost'
    }

    const updates = {
      reply: 'Yes',
      contacted: 'Yes',
      stage: newStage,
      notes: updatedNotes,
      updated_at: new Date().toISOString()
    }

    // 1. Local state update
    onUpdateLead({ ...lead, ...updates })
    if (showToast) showToast(`Reply marked (${replyType}) for ${lead.hospital_name || lead.lead_name || 'Lead'}`)

    // 2. Supabase update
    const { error } = await supabase.from('leads').update(updates).eq('id', lead.id)

    // 3. Write to activity_logs via logActivity helper
    if (!error) {
      logActivity({
        action: 'lead.reply_logged',
        entityType: 'lead',
        entityId: lead.id,
        projectId: activeProject?.id,
        metadata: { reply_type: replyType, notes }
      })
    }
  }

  if (queueLeads.length === 0) {
    return (
      <div style={{ background: '#1c1c20', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '20px 24px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 20px rgba(0,0,0,0.35)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '20px' }}>🎉</span>
          <div>
            <h4 className="font-headline" style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#f5f5f0' }}>Today's Queue Clear!</h4>
            <span style={{ fontSize: '12px', color: '#8a8a85' }}>All assigned leads have recent outreach activity.</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: '#1c1c20', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '24px', marginBottom: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.35)' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '16px' }}>⚡</span>
          <h3 className="font-headline" style={{ fontSize: '15px', fontWeight: '700', color: '#f5f5f0', margin: 0, letterSpacing: '0.03em' }}>
            TODAY'S QUEUE ({queueLeads.length})
          </h3>
        </div>
        <span style={{ fontSize: '12px', color: '#8a8a85' }}>Action required follow-ups</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {queueLeads.map(({ lead, reason }) => (
          <div
            key={lead.id}
            style={{
              background: '#151518',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '200px' }}>
              <div style={{ fontWeight: '600', fontSize: '13px', color: '#f5f5f0' }}>
                {lead.hospital_name || lead.lead_name || 'Unnamed Lead'}
              </div>
              <div style={{ fontSize: '11px', color: '#8a8a85', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{reason}</span>
                {lead.phone && <span style={{ fontFamily: 'monospace', color: '#3ecf8e' }}>• {lead.phone}</span>}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => setSelectedCallLead(lead)}
                className="btn-ghost"
                style={{ padding: '6px 12px', fontSize: '11px', fontWeight: '600', background: 'rgba(62, 207, 142, 0.1)', color: '#3ecf8e', borderColor: 'rgba(62, 207, 142, 0.25)', cursor: 'pointer' }}
              >
                📞 Log Call
              </button>
              
              <button
                onClick={() => setSelectedReplyLead(lead)}
                className="btn-ghost"
                style={{ padding: '6px 12px', fontSize: '11px', fontWeight: '600', background: 'rgba(242, 184, 75, 0.1)', color: '#f2b84b', borderColor: 'rgba(242, 184, 75, 0.25)', cursor: 'pointer' }}
              >
                💬 Mark Replied
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedCallLead && (
        <LogCallModal
          lead={selectedCallLead}
          onClose={() => setSelectedCallLead(null)}
          onSubmit={handleCallSubmit}
        />
      )}

      {selectedReplyLead && (
        <MarkRepliedModal
          lead={selectedReplyLead}
          onClose={() => setSelectedReplyLead(null)}
          onSubmit={handleReplySubmit}
        />
      )}

    </div>
  )
}
