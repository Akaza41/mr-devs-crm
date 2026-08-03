import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const FIELDS = [
  { key: 'hospital_name', label: 'Hospital Name', type: 'text', full: true },
  { key: 'type', label: 'Type', type: 'text' },
  { key: 'rating', label: 'Rating', type: 'number' },
  { key: 'reviews', label: 'Reviews', type: 'number' },
  { key: 'phone', label: 'Phone', type: 'text' },
  { key: 'number_type', label: 'Number Type', type: 'select', options: ['Mobile ✅', 'Landline ⚠️', 'No Number'] },
  { key: 'address', label: 'Address', type: 'text', full: true },
  { key: 'has_website', label: 'Has Website', type: 'select', options: ['No', 'Yes'] },
  { key: 'priority', label: 'Priority', type: 'select', options: ['High', 'Medium', 'Low'] },
  { key: 'stage', label: 'Stage', type: 'select', options: ['New', 'Contacted', 'Interested', 'Converted', 'Lost'] },
  { key: 'fb_found', label: 'FB Found', type: 'select', options: ['No', 'Yes'] },
  { key: 'contacted', label: 'Contacted', type: 'select', options: ['No', 'Queued', 'Attempted', 'Yes', 'Not Reachable'] },
  { key: 'reply', label: 'Reply', type: 'select', options: ['', 'Yes', 'No', 'Later'] },
  { key: 'notes', label: 'Notes', type: 'textarea', full: true },
]

export default function LeadModal({ lead, customColumns = [], onClose, onSave }) {
  const [activeTab, setActiveTab] = useState('details')
  const [form, setForm] = useState({})
  
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
    
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUser(data?.user || null)
    })
  }, [lead])

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

  // Initialize or fetch lead thread channel + members
  const initLeadThreadChannel = async () => {
    if (!lead?.id) return
    setThreadLoading(true)

    // 1. Check if channel already exists
    let { data: existingChan } = await supabase
      .from('chat_channels')
      .select('*')
      .eq('type', 'lead_thread')
      .eq('lead_id', lead.id)
      .maybeSingle()

    // 2. If not, create lead_thread channel
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

      if (!createErr && newChan) {
        existingChan = newChan
      }
    }

    if (existingChan) {
      setChannel(existingChan)

      // 3. Auto-add key members: admins/managers + assigned_to + created_by
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

      // 4. Fetch message history
      const { data: msgData } = await supabase
        .from('chat_messages')
        .select('id, channel_id, sender_id, content, created_at, sender:profiles(id, full_name, avatar_url, email)')
        .eq('channel_id', existingChan.id)
        .order('created_at', { ascending: true })

      if (msgData) {
        setMessages(msgData)
      }
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

  const handleSave = () => {
    if (!form.hospital_name) { alert('Hospital name is required'); return }
    onSave(form)
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ width: '680px', maxWidth: '95vw' }}>
        
        {/* Modal Header & Tabs */}
        <div className="modal-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '12px', paddingBottom: '0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '15px', fontWeight: '600', color: '#ededed' }}>
              {lead ? (form.hospital_name || 'Edit Lead') : 'Add New Lead'}
            </span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>×</button>
          </div>

          {/* Navigation Tabs (Only for existing leads) */}
          {lead?.id && (
            <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid #2a2a2a' }}>
              <button
                type="button"
                onClick={() => setActiveTab('details')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: activeTab === 'details' ? '#3ecf8e' : '#a0a0a0',
                  fontWeight: activeTab === 'details' ? '600' : '400',
                  padding: '8px 0',
                  fontSize: '13px',
                  cursor: 'pointer',
                  borderBottom: activeTab === 'details' ? '2px solid #3ecf8e' : 'none'
                }}
              >
                Lead Details
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('discussion')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: activeTab === 'discussion' ? '#3ecf8e' : '#a0a0a0',
                  fontWeight: activeTab === 'discussion' ? '600' : '400',
                  padding: '8px 0',
                  fontSize: '13px',
                  cursor: 'pointer',
                  borderBottom: activeTab === 'discussion' ? '2px solid #3ecf8e' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>Discussion Thread</span>
                <span style={{ fontSize: '11px', background: 'rgba(62,207,142,0.1)', color: '#3ecf8e', padding: '1px 6px', borderRadius: '10px' }}>💬</span>
              </button>
            </div>
          )}
        </div>

        {/* Modal Body */}
        {activeTab === 'details' ? (
          <>
            <div className="modal-body">
              {allFields.map(f => (
                <div key={f.key} className={`form-group ${f.full ? 'col-span-2' : ''}`}>
                  <label>{f.label}</label>
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
              <button className="btn-primary" onClick={handleSave}>Save</button>
            </div>
          </>
        ) : (
          /* Discussion Thread View */
          <div style={{ display: 'flex', flexDirection: 'column', height: '420px', background: '#141414' }}>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {threadLoading ? (
                <div style={{ color: '#555', fontSize: '12px', textAlign: 'center', margin: 'auto' }}>Loading discussion...</div>
              ) : messages.length === 0 ? (
                <div style={{ color: '#555', fontSize: '12px', textAlign: 'center', margin: 'auto' }}>
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
                        background: '#2a2a2a',
                        display: 'flex',
                        alignItems: 'center',
                        justify: 'center',
                        fontSize: '11px',
                        fontWeight: '600',
                        color: '#ededed',
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
                          <span style={{ fontSize: '12px', fontWeight: '600', color: isSelf ? '#3ecf8e' : '#ededed' }}>
                            {displayName}
                          </span>
                          <span style={{ fontSize: '10px', color: '#555' }}>
                            {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>

                        <div style={{
                          fontSize: '12px',
                          color: '#d4d4d4',
                          marginTop: '2px',
                          background: '#1a1a1a',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '0.5px solid #262626',
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

            {/* Input form inside LeadModal Discussion tab */}
            <form onSubmit={handleSendDiscussionMessage} style={{ padding: '12px 16px', borderTop: '0.5px solid #2a2a2a', background: '#1a1a1a', display: 'flex', gap: '8px' }}>
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
    </div>
  )
}