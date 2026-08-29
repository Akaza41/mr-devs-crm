import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const FIELDS = [
  { key: 'hospital_name', label: 'Lead / Business Name', type: 'text', full: true },
  { key: 'type', label: 'Industry / Type', type: 'text' },
  { key: 'decision_maker', label: 'Decision Maker', type: 'text' },
  { key: 'phone', label: 'Phone', type: 'text' },
  { key: 'number_type', label: 'Number Type', type: 'select', options: ['Mobile ✅', 'Landline ⚠️', 'No Number'] },
  { key: 'address', label: 'Address', type: 'text', full: true },
  { key: 'pain_point', label: 'Pain Point / Challenge', type: 'textarea', full: true },
  { key: 'current_solution', label: 'Current Solution / Tool', type: 'textarea', full: true },
  { key: 'priority', label: 'Priority', type: 'select', options: ['High', 'Medium', 'Low'] },
  { key: 'stage', label: 'Stage', type: 'select', options: ['New', 'Contacted', 'Interested', 'Converted', 'Lost'] },
  { key: 'next_followup_due', label: 'Next Follow-Up Due', type: 'datetime-local' },
  { key: 'has_website', label: 'Has Website', type: 'select', options: ['No', 'Yes'] },
  { key: 'fb_found', label: 'FB Found', type: 'select', options: ['No', 'Yes'] },
  { key: 'contacted', label: 'Contacted', type: 'select', options: ['No', 'Queued', 'Attempted', 'Yes', 'Not Reachable'] },
  { key: 'reply', label: 'Reply', type: 'select', options: ['', 'Yes', 'No', 'Later'] },
  { key: 'notes', label: 'Notes', type: 'textarea', full: true },
]

const RESEARCH_PROMPTS = [
  { key: 'weaknesses', label: 'Pain Points & Weaknesses', placeholder: "What's not working for them right now? Current pain points, technical gaps, or complaints..." },
  { key: 'strengths', label: 'Key Strengths & Differentiators', placeholder: "What are their main selling points, strengths, or key operational advantages?" },
  { key: 'competitors', label: 'Competitors & Current Vendors', placeholder: "Who are their main competitors or alternative service providers?" },
  { key: 'opportunity', label: 'Pitch Opportunity & Strategy', placeholder: "What is the pitch, entry point, angle, or high-value offer for them?" },
]

export default function LeadModal({ lead, customColumns = [], teamMembers = [], onClose, onSave }) {
  const [activeTab, setActiveTab] = useState('details')
  const [form, setForm] = useState({})
  const [researchNotes, setResearchNotes] = useState({ weaknesses: '', strengths: '', competitors: '', opportunity: '' })
  const [showSoftWarning, setShowSoftWarning] = useState(false)
  
  // AI Outreach Message State
  const [aiLoading, setAiLoading] = useState(false)
  const [aiMessage, setAiMessage] = useState('')
  const [aiCopied, setAiCopied] = useState(false)
  
  // Discussion Thread State
  const [channel, setChannel] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [currentUser, setCurrentUser] = useState(null)
  const [threadLoading, setThreadLoading] = useState(false)
  const messagesEndRef = useRef(null)

  const dynamicFields = customColumns.map(c => ({
    key: c.column_name,
    label: c.display_name,
    type: c.data_type === 'Yes/No' ? 'select' : c.data_type === 'Number' ? 'number' : c.data_type === 'Date' ? 'date' : 'text',
    options: c.data_type === 'Yes/No' ? ['', 'Yes', 'No'] : undefined
  }))

  const allFields = [...FIELDS, ...dynamicFields]

  useEffect(() => {
    setForm(lead || { has_website: 'No', priority: 'High', stage: 'New', fb_found: 'No', contacted: 'No', reply: '' })
    
    if (lead?.research_notes) {
      setResearchNotes({
        weaknesses: lead.research_notes.weaknesses || '',
        strengths: lead.research_notes.strengths || '',
        competitors: lead.research_notes.competitors || '',
        opportunity: lead.research_notes.opportunity || ''
      })
    }
    
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUser(data?.user || null)
    })
  }, [lead])

  // Calculate live research score (25 pts per valid field >= 15 chars)
  const calculateScore = () => {
    let score = 0
    if ((researchNotes.weaknesses || '').trim().length >= 15) score += 25
    if ((researchNotes.strengths || '').trim().length >= 15) score += 25
    if ((researchNotes.competitors || '').trim().length >= 15) score += 25
    if ((researchNotes.opportunity || '').trim().length >= 15) score += 25
    return score
  }

  const currentScore = calculateScore()

  useEffect(() => {
    if (activeTab === 'discussion' && lead?.id) {
      initLeadThreadChannel()
    }
  }, [activeTab, lead])

  useEffect(() => {
    if (channel?.id) {
      const subscription = supabase
        .channel(`lead_thread:${channel.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
            filter: `channel_id=eq.${channel.id}`
          },
          async (payload) => {
            const newMsg = payload.new
            const { data: sender } = await supabase
              .from('profiles')
              .select('id, full_name, avatar_url, email')
              .eq('id', newMsg.sender_id)
              .single()

            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev
              return [...prev, { ...newMsg, sender }]
            })
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(subscription)
      }
    }
  }, [channel])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const initLeadThreadChannel = async () => {
    if (!lead?.id) return
    setThreadLoading(true)

    let { data: existingChan } = await supabase
      .from('chat_channels')
      .select('*')
      .eq('type', 'lead_thread')
      .eq('lead_id', lead.id)
      .maybeSingle()

    if (!existingChan) {
      const { data: newChan, error: createErr } = await supabase
        .from('chat_channels')
        .insert({
          name: `Discussion: ${lead.hospital_name || lead.lead_name || 'Lead'}`,
          type: 'lead_thread',
          lead_id: lead.id,
          project_id: lead.project_id || null
        })
        .select()
        .single()

      if (!createErr && newChan) existingChan = newChan
    }

    if (existingChan) {
      setChannel(existingChan)

      const { data: adminProfiles } = await supabase
        .from('profiles')
        .select('id')
        .in('role', ['admin', 'manager'])

      const memberIds = new Set(adminProfiles?.map(p => p.id) || [])
      if (lead.assigned_to) memberIds.add(lead.assigned_to)
      if (lead.created_by) memberIds.add(lead.created_by)
      if (currentUser?.id) memberIds.add(currentUser.id)

      const memberRows = Array.from(memberIds).map(uid => ({
        channel_id: existingChan.id,
        user_id: uid
      }))

      if (memberRows.length > 0) {
        await supabase
          .from('channel_members')
          .upsert(memberRows, { onConflict: 'channel_id,user_id' })
      }

      const { data: msgData } = await supabase
        .from('chat_messages')
        .select('id, channel_id, sender_id, content, created_at, sender:profiles(id, full_name, avatar_url, email)')
        .eq('channel_id', existingChan.id)
        .order('created_at', { ascending: true })

      if (msgData) setMessages(msgData)
    }

    setThreadLoading(false)
  }

  const handleSendDiscussionMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || !channel || !currentUser) return

    const text = newMessage.trim()
    setNewMessage('')

    const { error } = await supabase
      .from('chat_messages')
      .insert({
        channel_id: channel.id,
        sender_id: currentUser.id,
        content: text
      })

    if (error) {
      alert('Failed to send comment: ' + error.message)
    }
  }

  const handleGenerateAiMessage = async () => {
    setAiLoading(true)
    setAiCopied(false)
    try {
      const { data, error } = await supabase.functions.invoke('generate_outreach_message', {
        body: {
          lead_name: form.hospital_name || form.lead_name,
          type: form.type,
          pain_point: form.pain_point,
          current_solution: form.current_solution,
          decision_maker: form.decision_maker,
          notes: form.notes
        }
      })

      if (error || !data?.message) {
        const dm = form.decision_maker ? `Hi ${form.decision_maker}, ` : 'Hi there, '
        const q = form.pain_point 
          ? `Are you currently experiencing bottlenecks with ${form.pain_point.toLowerCase()} at ${form.hospital_name || 'your team'}?`
          : `How is your team managing operational efficiency at ${form.hospital_name || 'your company'}?`
        setAiMessage(`${dm}${q} We help ${form.type || 'growing teams'} solve this. Open for a 5-minute chat?`)
      } else {
        setAiMessage(data.message)
      }
    } catch (err) {
      console.warn('AI generation fallback:', err)
      const dm = form.decision_maker ? `Hi ${form.decision_maker}, ` : 'Hi there, '
      setAiMessage(`${dm}Are you currently looking for ways to streamline operations at ${form.hospital_name || 'your team'}? Open to a 5-min diagnostic chat?`)
    } finally {
      setAiLoading(false)
    }
  }

  const handleCopyAiMessage = () => {
    if (!aiMessage) return
    navigator.clipboard.writeText(aiMessage)
    setAiCopied(true)
    setTimeout(() => setAiCopied(false), 2000)
  }

  const executeSave = () => {
    const finalData = {
      ...form,
      hospital_name: form.hospital_name || form.lead_name || 'Unnamed Lead',
      lead_name: form.hospital_name || form.lead_name || 'Unnamed Lead',
      research_notes: researchNotes,
      research_score: currentScore
    }
    onSave(finalData)
  }

  const handleSave = () => {
    if (!form.hospital_name && !form.lead_name) { alert('Lead / Business name is required'); return }

    // Check Stage-Change Soft Warning Guardrail
    const isOutreachStage = ['Contacted', 'Interested', 'Converted'].includes(form.stage)
    const isUnderResearched = currentScore < 75

    if (isOutreachStage && isUnderResearched && !showSoftWarning) {
      setShowSoftWarning(true)
      return
    }

    executeSave()
  }

  const cleanPhone = (form.phone || '').replace(/[^0-9+]/g, '')

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ width: '760px', maxWidth: '95vw', background: '#161616', border: '0.5px solid #232323' }}>
        
        {/* Modal Header & Navigation Tabs */}
        <div className="modal-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '12px', paddingBottom: '0', borderBottom: '0.5px solid #232323' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="font-headline" style={{ fontSize: '16px', fontWeight: '700', color: '#f5f5f0' }}>
                {lead ? (form.hospital_name || form.lead_name || 'Edit Lead') : 'Add New Lead'}
              </span>
              
              {/* Research Score Badge */}
              <span
                style={{
                  background: currentScore === 100 ? 'rgba(62,207,142,0.18)' : currentScore >= 75 ? 'rgba(234,179,8,0.18)' : '#232323',
                  color: currentScore === 100 ? '#3ecf8e' : currentScore >= 75 ? '#facc15' : '#8a8a85',
                  border: currentScore === 100 ? '0.5px solid rgba(62,207,142,0.4)' : '0.5px solid #333',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: '600'
                }}
              >
                {currentScore === 100 ? '100/100 ✨ Well Researched' : `Research Score: ${currentScore}/100`}
              </span>
            </div>

            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8a8a85', cursor: 'pointer', fontSize: '18px' }}>×</button>
          </div>

          {/* Navigation Tabs */}
          <div style={{ display: 'flex', gap: '20px', borderBottom: '0.5px solid #232323' }}>
            <button
              type="button"
              onClick={() => setActiveTab('details')}
              style={{
                background: 'none',
                border: 'none',
                color: activeTab === 'details' ? '#3ecf8e' : '#8a8a85',
                fontWeight: activeTab === 'details' ? '600' : '400',
                padding: '8px 0',
                fontSize: '13px',
                cursor: 'pointer',
                borderBottom: activeTab === 'details' ? '2px solid #3ecf8e' : '2px solid transparent'
              }}
            >
              Basic Info & Context
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('research')}
              style={{
                background: 'none',
                border: 'none',
                color: activeTab === 'research' ? '#3ecf8e' : '#8a8a85',
                fontWeight: activeTab === 'research' ? '600' : '400',
                padding: '8px 0',
                fontSize: '13px',
                cursor: 'pointer',
                borderBottom: activeTab === 'research' ? '2px solid #3ecf8e' : '2px solid transparent',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>Research Notes</span>
              <span style={{ fontSize: '10px', background: currentScore >= 75 ? 'rgba(62,207,142,0.15)' : '#232323', color: currentScore >= 75 ? '#3ecf8e' : '#8a8a85', padding: '1px 6px', borderRadius: '10px' }}>
                {currentScore}/100
              </span>
            </button>

            {lead?.id && (
              <button
                type="button"
                onClick={() => setActiveTab('discussion')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: activeTab === 'discussion' ? '#3ecf8e' : '#8a8a85',
                  fontWeight: activeTab === 'discussion' ? '600' : '400',
                  padding: '8px 0',
                  fontSize: '13px',
                  cursor: 'pointer',
                  borderBottom: activeTab === 'discussion' ? '2px solid #3ecf8e' : '2px solid transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>Discussion Thread</span>
                <span style={{ fontSize: '11px', background: 'rgba(62,207,142,0.1)', color: '#3ecf8e', padding: '1px 6px', borderRadius: '10px' }}>💬</span>
              </button>
            )}
          </div>
        </div>

        {/* Modal Body */}
        {activeTab === 'details' ? (
          <>
            <div className="modal-body" style={{ gap: '16px' }}>
              
              {/* Quick Contact Actions Bar */}
              {cleanPhone && (
                <div style={{ gridColumn: 'span 2', background: '#121212', border: '0.5px solid #282828', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                  <div style={{ fontSize: '12px', color: '#a0a0a0', fontWeight: '500' }}>
                    🚀 Quick Actions for <strong style={{ color: '#ededed' }}>{cleanPhone}</strong>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <a href={`tel:${cleanPhone}`} className="btn-ghost" style={{ textDecoration: 'none', fontSize: '11px', padding: '4px 10px', color: '#60a5fa' }}>
                      📞 Call
                    </a>
                    <a href={`https://wa.me/${cleanPhone}`} target="_blank" rel="noopener noreferrer" className="btn-ghost" style={{ textDecoration: 'none', fontSize: '11px', padding: '4px 10px', color: '#3ecf8e' }}>
                      💬 WhatsApp
                    </a>
                    {form.has_website === 'Yes' && (
                      <a href={form.address?.startsWith('http') ? form.address : `https://${form.address}`} target="_blank" rel="noopener noreferrer" className="btn-ghost" style={{ textDecoration: 'none', fontSize: '11px', padding: '4px 10px', color: '#facc15' }}>
                        🌐 Website
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* AI Outreach Generator Box */}
              <div style={{ gridColumn: 'span 2', background: 'rgba(62,207,142,0.05)', border: '0.5px solid rgba(62,207,142,0.2)', borderRadius: '8px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#3ecf8e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    ✨ AI Outreach Message Generator (Server-Side)
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateAiMessage}
                    disabled={aiLoading}
                    className="btn-primary"
                    style={{ fontSize: '11px', padding: '4px 10px' }}
                  >
                    {aiLoading ? 'Generating...' : '✨ Generate Personalized Message'}
                  </button>
                </div>

                {aiMessage && (
                  <div style={{ background: '#0e0e0e', border: '0.5px solid #2a2a2a', borderRadius: '6px', padding: '10px 12px', fontSize: '12px', color: '#ededed', lineHeight: '1.5', position: 'relative' }}>
                    {aiMessage}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                      <button
                        type="button"
                        onClick={handleCopyAiMessage}
                        className="btn-ghost"
                        style={{ fontSize: '10px', padding: '2px 8px', color: aiCopied ? '#3ecf8e' : '#a0a0a0' }}
                      >
                        {aiCopied ? '✓ Copied to Clipboard!' : '📋 Copy Message'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Rep Assignment Dropdown */}
              <div className="form-group col-span-2" style={{ background: '#121212', border: '0.5px solid #232323', padding: '10px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ color: '#ededed', fontSize: '12px', fontWeight: '500', margin: 0 }}>
                  👤 Assigned Sales Specialist
                </label>
                <select
                  className="input-base"
                  style={{ width: '220px', fontSize: '12px', padding: '4px 8px' }}
                  value={form.assigned_to || ''}
                  onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value || null }))}
                >
                  <option value="">-- Unassigned --</option>
                  {teamMembers.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.full_name || m.email} ({m.role})
                    </option>
                  ))}
                </select>
              </div>

              {allFields.map(f => (
                <div key={f.key} className={`form-group ${f.full ? 'col-span-2' : ''}`}>
                  <label style={{ color: '#8a8a85', fontSize: '11px' }}>{f.label}</label>
                  {f.type === 'textarea' ? (
                    <textarea className="input-base" value={form[f.key] || ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
                  ) : f.type === 'select' ? (
                    <select className="input-base" value={form[f.key] || ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}>
                      {f.options.map(o => <option key={o} value={o}>{o || '—'}</option>)}
                    </select>
                  ) : (
                    <input className="input-base" type={f.type} value={form[f.key] || ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
                  )}
                </div>
              ))}
            </div>

            <div className="modal-footer">
              <button className="btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn-primary" onClick={handleSave}>Save Lead</button>
            </div>
          </>
        ) : activeTab === 'research' ? (
          <>
            {/* RESEARCH TAB BODY */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: '#121212', border: '0.5px solid #232323', borderRadius: '8px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#f5f5f0' }}>Structured Prospect Research</h4>
                  <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#8a8a85' }}>Each field with meaningful research (15+ chars) earns +25 points toward your score.</p>
                </div>
                <div className="font-headline tabular-nums" style={{ fontSize: '20px', fontWeight: '700', color: currentScore === 100 ? '#3ecf8e' : '#f5f5f0' }}>
                  {currentScore}/100
                </div>
              </div>

              {RESEARCH_PROMPTS.map(item => {
                const textVal = researchNotes[item.key] || ''
                const charLen = textVal.trim().length
                const isQualifying = charLen >= 15

                return (
                  <div key={item.key} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: '12px', fontWeight: '600', color: '#f5f5f0' }}>{item.label}</label>
                      <span style={{ fontSize: '10px', color: isQualifying ? '#3ecf8e' : '#8a8a85', fontWeight: isQualifying ? '600' : '400' }}>
                        {charLen}/15 chars {isQualifying ? '✓ (+25 pts)' : ''}
                      </span>
                    </div>
                    <textarea
                      placeholder={item.placeholder}
                      value={textVal}
                      onChange={e => setResearchNotes(prev => ({ ...prev, [item.key]: e.target.value }))}
                      className="input-base"
                      style={{ minHeight: '64px' }}
                    />
                  </div>
                )
              })}
            </div>

            <div className="modal-footer">
              <button className="btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn-primary" onClick={handleSave}>Save Research</button>
            </div>
          </>
        ) : (
          /* Discussion Thread View */
          <div style={{ display: 'flex', flexDirection: 'column', height: '420px', background: '#121212' }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {threadLoading ? (
                <div style={{ color: '#8a8a85', fontSize: '12px', textAlign: 'center', margin: 'auto' }}>Loading discussion...</div>
              ) : messages.length === 0 ? (
                <div style={{ color: '#8a8a85', fontSize: '12px', textAlign: 'center', margin: 'auto' }}>
                  No internal comments yet. Start a discussion for this lead!
                </div>
              ) : (
                messages.map(msg => {
                  const sender = msg.sender
                  const displayName = sender?.full_name || sender?.email || 'User'
                  const isSelf = sender?.id === currentUser?.id

                  return (
                    <div key={msg.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: '#232323',
                        display: 'flex',
                        alignItems: 'center',
                        justify: 'center',
                        fontSize: '11px',
                        fontWeight: '600',
                        color: '#f5f5f0',
                        flexShrink: 0
                      }}>
                        {sender?.avatar_url ? (
                          <img src={sender.avatar_url} alt={displayName} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          displayName.charAt(0).toUpperCase()
                        )}
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                          <span style={{ fontSize: '12px', fontWeight: '600', color: isSelf ? '#3ecf8e' : '#f5f5f0' }}>
                            {displayName}
                          </span>
                          <span style={{ fontSize: '10px', color: '#8a8a85' }}>
                            {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>

                        <div style={{
                          fontSize: '12px',
                          color: '#f5f5f0',
                          marginTop: '2px',
                          background: '#161616',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '0.5px solid #232323',
                          display: 'inline-block',
                          maxWidth: '90%'
                        }}>
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendDiscussionMessage} style={{ padding: '12px 16px', borderTop: '0.5px solid #232323', background: '#161616', display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="Write a comment or update for the team..."
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                className="input-base"
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn-primary" disabled={!newMessage.trim()}>
                Comment
              </button>
            </form>
          </div>
        )}

      </div>

      {/* ── STEP 4: SOFT WARNING GUARDRAIL MODAL ── */}
      {showSoftWarning && (
        <div className="modal-overlay" style={{ zIndex: 60 }}>
          <div className="modal" style={{ maxWidth: '440px', padding: '24px', background: '#161616', border: '0.5px solid #3ecf8e', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</div>
            <h3 className="font-headline" style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#f5f5f0' }}>
              Lead Research Incomplete ({currentScore}/100)
            </h3>
            <p style={{ fontSize: '13px', color: '#8a8a85', margin: '0 0 20px 0', lineHeight: '1.5' }}>
              This lead has a research score of <strong>{currentScore}/100</strong>. We recommend reaching a score of <strong>75+</strong> before moving leads to Contacted stage for higher conversion success.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                className="btn-ghost"
                onClick={() => {
                  setShowSoftWarning(false)
                  setActiveTab('research')
                }}
              >
                Complete Research First
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  setShowSoftWarning(false)
                  executeSave()
                }}
              >
                Continue Anyway
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}