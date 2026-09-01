import React, { useState, useEffect, useMemo } from 'react'
import { db } from '../lib/firebase'
import { doc, getDoc, collection, getDocs } from 'firebase/firestore'
import { logActivity } from '../lib/activityLogger'
import LogTouchModal from './LogTouchModal'
import { getLeadDisplayName } from '../lib/leadUtils'

const CHANNEL_ICONS = {
  call: '📞 Call',
  gmail: '✉️ Gmail',
  linkedin: '💼 LinkedIn',
  instagram: '📸 Instagram',
  whatsapp: '💬 WhatsApp',
  other: '🌐 Other'
}

export default function TodaysQueue({ leads = [], currentUserProfile, activeProject, onUpdateLead, showToast }) {
  const [selectedTouchLead, setSelectedTouchLead] = useState(null)
  const [touchesMap, setTouchesMap] = useState({})
  const [cadenceSettings, setCadenceSettings] = useState({ no_answer_days: 2, voicemail_days: 2, answered_days: 4 })

  // Fetch cadence settings
  useEffect(() => {
    async function getCadence() {
      try {
        const snap = await getDoc(doc(db, 'settings', 'cadence'))
        if (snap.exists()) {
          const data = snap.data()
          setCadenceSettings({
            no_answer_days: data.no_answer_days ?? 2,
            voicemail_days: data.voicemail_days ?? 2,
            answered_days: data.answered_days ?? 4,
          })
        }
      } catch (err) {
        console.warn('Could not fetch cadence settings from Firestore:', err)
      }
    }
    getCadence()
  }, [])

  // Fetch touch history for lead IDs in current project/assigned leads
  useEffect(() => {
    async function fetchTouchHistory() {
      if (!leads || leads.length === 0) return

      try {
        const snap = await getDocs(collection(db, 'outreach_touches'))
        const map = {}
        snap.docs.forEach(doc => {
          const touch = { id: doc.id, ...doc.data() }
          if (touch.lead_id || touch.leadId) {
            const key = touch.lead_id || touch.leadId
            if (!map[key]) map[key] = []
            map[key].push(touch)
          }
        })
        setTouchesMap(map)
      } catch (err) {
        console.warn('Touch history fetch error:', err.message)
      }
    }

    fetchTouchHistory()
  }, [leads])

  // Compute sequence queue leads
  const queueItems = useMemo(() => {
    if (!leads || leads.length === 0) return []

    const currentUserId = currentUserProfile?.id
    const now = new Date()

    // Filter leads assigned to user (or unassigned fallback)
    const userLeads = leads.filter(l => !currentUserId || l.assigned_to === currentUserId || !l.assigned_to)

    // Today's Queue query criteria:
    // leads where next_followup_due <= now() OR (next_followup_due IS NULL and contacted != 'Yes')
    const filtered = userLeads.filter(lead => {
      if (lead.stage === 'Lost' || lead.stage === 'Converted') return false
      
      if (lead.next_followup_due) {
        const dueDate = new Date(lead.next_followup_due)
        return dueDate <= now
      }

      // Fallback for uncontacted leads without a set due date
      return lead.contacted !== 'Yes'
    })

    // Map each lead with its sequence number and last channel used
    const mapped = filtered.map(lead => {
      const priorTouches = touchesMap[lead.id] || []
      const sequenceNumber = priorTouches.length + 1
      const lastTouch = priorTouches.length > 0 ? priorTouches[priorTouches.length - 1] : null
      const lastChannelLabel = lastTouch ? (CHANNEL_ICONS[lastTouch.channel] || lastTouch.channel) : 'First Touch'

      let dueDateObj = lead.next_followup_due ? new Date(lead.next_followup_due) : null
      let isOverdue = dueDateObj && dueDateObj < now

      return {
        lead,
        sequenceNumber,
        lastTouch,
        lastChannelLabel,
        dueDateObj,
        isOverdue
      }
    })

    // Sort soonest-due first (earliest due date at top; null due dates next)
    return mapped.sort((a, b) => {
      if (a.dueDateObj && b.dueDateObj) return a.dueDateObj - b.dueDateObj
      if (a.dueDateObj) return -1
      if (b.dueDateObj) return 1
      return 0
    })
  }, [leads, currentUserProfile, touchesMap])

  const handleTouchSubmit = async ({ channel, outcome, notes, nextFollowupDue, stage }) => {
    if (!selectedTouchLead) return
    const lead = selectedTouchLead
    setSelectedTouchLead(null)

    const userId = currentUserProfile?.id
    const priorTouches = touchesMap[lead.id] || []
    const nextSeqNum = priorTouches.length + 1

    // 1. Insert into outreach_touches table
    const touchPayload = {
      lead_id: lead.id,
      user_id: userId || null,
      channel,
      sequence_number: nextSeqNum,
      outcome,
      notes,
      created_at: new Date().toISOString()
    }

    const { data: touchData, error: touchError } = await supabase
      .from('outreach_touches')
      .insert([touchPayload])
      .select()
      .single()

    if (touchError) {
      console.error('Error inserting touch:', touchError)
    } else if (touchData) {
      setTouchesMap(prev => ({
        ...prev,
        [lead.id]: [...(prev[lead.id] || []), touchData]
      }))
    }

    // 2. Update lead record
    const updatedNotes = notes
      ? (lead.notes ? `${lead.notes}\n[Touch #${nextSeqNum} - ${channel.toUpperCase()} (${outcome})]: ${notes}` : `[Touch #${nextSeqNum} - ${channel.toUpperCase()} (${outcome})]: ${notes}`)
      : lead.notes

    const updates = {
      contacted: 'Yes',
      stage: stage || lead.stage,
      next_followup_due: nextFollowupDue,
      notes: updatedNotes,
      updated_at: new Date().toISOString()
    }

    // Local state update
    onUpdateLead({ ...lead, ...updates })

    let toastMsg = `Touch #${nextSeqNum} logged (${outcome}) for ${lead.hospital_name || lead.lead_name || 'Lead'}`
    if (nextFollowupDue) {
      const formattedDue = new Date(nextFollowupDue).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      toastMsg += ` • Next follow-up due: ${formattedDue}`
    }
    if (showToast) showToast(toastMsg)

    // Database update
    const { error: leadError } = await supabase.from('leads').update(updates).eq('id', lead.id)

    // Activity log
    if (!leadError) {
      logActivity({
        action: 'lead.touch_logged',
        entityType: 'lead',
        entityId: lead.id,
        projectId: activeProject?.id,
        metadata: {
          channel,
          outcome,
          sequence_number: nextSeqNum,
          next_followup_due: nextFollowupDue,
          new_stage: stage
        }
      })
    }
  }

  if (queueItems.length === 0) {
    return (
      <div style={{ background: '#1c1c20', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '20px 24px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 20px rgba(0,0,0,0.35)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '20px' }}>🎉</span>
          <div>
            <h4 className="font-headline" style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#f5f5f0' }}>Today's Queue Clear!</h4>
            <span style={{ fontSize: '12px', color: '#8a8a85' }}>No follow-ups due right now. Great job keeping outreach on cadence!</span>
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
            TODAY'S QUEUE ({queueItems.length})
          </h3>
        </div>
        <span style={{ fontSize: '12px', color: '#8a8a85' }}>Multi-channel follow-up cadence queue</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {queueItems.map(({ lead, sequenceNumber, lastChannelLabel, isOverdue, dueDateObj }) => (
          <div
            key={lead.id}
            style={{
              background: '#151518',
              border: isOverdue ? '1px solid rgba(248, 113, 113, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '220px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: '600', fontSize: '13px', color: '#f5f5f0' }}>
                  {getLeadDisplayName(lead)}
                </span>
                
                {/* Sequence badge */}
                <span style={{ background: 'rgba(62, 207, 142, 0.15)', color: '#3ecf8e', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600' }}>
                  Follow-up #{sequenceNumber}
                </span>
              </div>

              <div style={{ fontSize: '11px', color: '#8a8a85', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span>Last channel: <strong style={{ color: '#ededed' }}>{lastChannelLabel}</strong></span>
                {lead.phone && <span style={{ fontFamily: 'monospace', color: '#3ecf8e' }}>• {lead.phone}</span>}
                {dueDateObj && (
                  <span style={{ color: isOverdue ? '#f87171' : '#8a8a85', fontWeight: isOverdue ? '600' : '400' }}>
                    • {isOverdue ? '⚠️ Overdue' : `Due ${dueDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => setSelectedTouchLead(lead)}
                className="btn-primary"
                style={{ padding: '7px 14px', fontSize: '12px', fontWeight: '600', background: '#3ecf8e', color: '#000', cursor: 'pointer', border: 'none', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <span>⚡</span> Log Touch
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedTouchLead && (
        <LogTouchModal
          lead={selectedTouchLead}
          project={activeProject}
          cadenceSettings={cadenceSettings}
          onClose={() => setSelectedTouchLead(null)}
          onSubmit={handleTouchSubmit}
        />
      )}

    </div>
  )
}
