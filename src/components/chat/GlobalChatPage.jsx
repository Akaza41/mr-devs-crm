import React, { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

export default function GlobalChatPage({ currentUserProfile, onBack }) {
  const [channels, setChannels] = useState(() => {
    try {
      const cached = localStorage.getItem('mrdevs_chat_channels')
      return cached ? JSON.parse(cached) : []
    } catch {
      return []
    }
  })

  const [activeChannel, setActiveChannel] = useState(null)
  const [messages, setMessages] = useState([])
  const [members, setMembers] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [channelSearch, setChannelSearch] = useState('')
  const [messageSearch, setMessageSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [toast, setToast] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
  const [creatingChannel, setCreatingChannel] = useState(false)

  const messagesEndRef = useRef(null)

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
  }

  // ── 1. FETCH & CACHE CHANNELS ──
  const fetchUserChannels = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('chat_channels')
      .select('*')
      .order('created_at', { ascending: true })

    let channelList = []
    if (!error && data && data.length > 0) {
      channelList = data
    } else {
      // Fallback default #general channel if DB is initializing or empty
      channelList = [
        { id: 'general-channel-id', name: 'general', type: 'team' },
        { id: 'announcements-channel-id', name: 'announcements', type: 'team' }
      ]
    }

    setChannels(channelList)
    try {
      localStorage.setItem('mrdevs_chat_channels', JSON.stringify(channelList))
    } catch {}

    // Set active channel if not set
    setActiveChannel(prev => {
      if (prev) {
        const found = channelList.find(c => c.id === prev.id)
        if (found) return found
      }
      const gen = channelList.find(c => c.name === 'general') || channelList[0]
      return gen || null
    })

    setLoading(false)
  }, [])

  useEffect(() => {
    fetchUserChannels()
  }, [fetchUserChannels])

  // ── 2. FETCH MESSAGES & MEMBERS FOR ACTIVE CHANNEL ──
  const fetchChannelData = useCallback(async (channelId) => {
    if (!channelId) return
    setMessagesLoading(true)

    // Load cached messages first for instant UI response
    try {
      const cached = localStorage.getItem(`mrdevs_chat_messages_${channelId}`)
      if (cached) {
        setMessages(JSON.parse(cached))
      }
    } catch {}

    // Fetch fresh messages with sender profiles
    const { data: msgData } = await supabase
      .from('chat_messages')
      .select('id, channel_id, sender_id, content, created_at, sender:profiles(id, full_name, avatar_url, email)')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })

    if (msgData) {
      const formatted = msgData.map(m => ({ ...m, status: 'sent' }))
      setMessages(formatted)
      try {
        localStorage.setItem(`mrdevs_chat_messages_${channelId}`, JSON.stringify(formatted.slice(-100)))
      } catch {}
    }

    // Fetch channel members (or workspace profiles as fallback)
    const { data: memberData } = await supabase
      .from('channel_members')
      .select('user_id, joined_at, profile:profiles(id, full_name, avatar_url, role)')
      .eq('channel_id', channelId)

    if (memberData && memberData.length > 0) {
      setMembers(memberData.map(m => m.profile).filter(Boolean))
    } else {
      // Fallback: fetch all active workspace profiles
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role')
        .eq('status', 'active')
        .limit(10)
      if (allProfiles) setMembers(allProfiles)
    }

    setMessagesLoading(false)
    setTimeout(() => scrollToBottom(false), 50)
  }, [])

  useEffect(() => {
    if (activeChannel?.id) {
      fetchChannelData(activeChannel.id)

      // Realtime subscription
      const channel = supabase
        .channel(`chat_messages:${activeChannel.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
            filter: `channel_id=eq.${activeChannel.id}`
          },
          async (payload) => {
            const newMsg = payload.new

            // Check if sender profile is already available
            let sender = newMsg.sender_id === currentUserProfile?.id ? currentUserProfile : null
            if (!sender) {
              const { data: s } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url, email')
                .eq('id', newMsg.sender_id)
                .single()
              if (s) sender = s
            }

            setMessages(prev => {
              // Update optimistic message if matches or append new
              const existingIdx = prev.findIndex(m => 
                m.id === newMsg.id || 
                (m.status === 'sending' && m.sender_id === newMsg.sender_id && m.content === newMsg.content)
              )

              if (existingIdx !== -1) {
                const updated = [...prev]
                updated[existingIdx] = { ...newMsg, sender: sender || updated[existingIdx].sender, status: 'sent' }
                return updated
              }

              return [...prev, { ...newMsg, sender, status: 'sent' }]
            })

            setTimeout(() => scrollToBottom(true), 50)
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [activeChannel, fetchChannelData, currentUserProfile])

  useEffect(() => {
    scrollToBottom(true)
  }, [messages.length])

  // ── 3. OPTIMISTIC MESSAGE SENDING ──
  const sendMessagePayload = async (messageText, tempId) => {
    if (!activeChannel || !currentUserProfile) return

    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        channel_id: activeChannel.id,
        sender_id: currentUserProfile.id,
        content: messageText
      })
      .select('*, sender:profiles(id, full_name, avatar_url, email)')
      .single()

    if (error) {
      // Mark as error
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'error', errorMsg: error.message } : m))
      showToast('Failed to send message: ' + error.message)
    } else {
      // Replace temp message with server message
      const serverMsg = data || { id: tempId, content: messageText, created_at: new Date().toISOString(), status: 'sent', sender: currentUserProfile }
      setMessages(prev => {
        const next = prev.map(m => m.id === tempId ? { ...serverMsg, status: 'sent' } : m)
        try {
          localStorage.setItem(`mrdevs_chat_messages_${activeChannel.id}`, JSON.stringify(next.slice(-100)))
        } catch {}
        return next
      })
    }
  }

  const handleSendMessage = (e) => {
    if (e) e.preventDefault()
    if (!newMessage.trim() || !activeChannel || !currentUserProfile) return

    const messageText = newMessage.trim()
    setNewMessage('')

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
    const tempMsg = {
      id: tempId,
      channel_id: activeChannel.id,
      sender_id: currentUserProfile.id,
      content: messageText,
      created_at: new Date().toISOString(),
      status: 'sending',
      sender: currentUserProfile
    }

    setMessages(prev => {
      const next = [...prev, tempMsg]
      try {
        localStorage.setItem(`mrdevs_chat_messages_${activeChannel.id}`, JSON.stringify(next.slice(-100)))
      } catch {}
      return next
    })

    setTimeout(() => scrollToBottom(true), 50)
    sendMessagePayload(messageText, tempId)
  }

  const handleRetryMessage = (msg) => {
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: 'sending' } : m))
    sendMessagePayload(msg.content, msg.id)
  }

  // ── 4. CREATE NEW CHANNEL ──
  const handleCreateChannel = async (e) => {
    e.preventDefault()
    if (!newChannelName.trim()) return

    const cleanName = newChannelName.toLowerCase().replace(/[^a-z0-9_-]/g, '-').trim()
    setCreatingChannel(true)

    const { data, error } = await supabase
      .from('chat_channels')
      .insert({
        name: cleanName,
        type: 'team'
      })
      .select('*')
      .single()

    if (error) {
      showToast('Error creating channel: ' + error.message)
    } else if (data) {
      const updated = [...channels, data]
      setChannels(updated)
      setActiveChannel(data)
      setShowCreateModal(false)
      setNewChannelName('')
      showToast(`Channel #${cleanName} created!`)
    }
    setCreatingChannel(false)
  }

  // Filter channels & messages
  const filteredChannels = channels.filter(c => c.name.toLowerCase().includes(channelSearch.toLowerCase()))
  const filteredMessages = messages.filter(m => !messageSearch || m.content.toLowerCase().includes(messageSearch.toLowerCase()))

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '260px 1fr',
      height: 'calc(100vh - 130px)',
      background: '#1a1a1a',
      border: '0.5px solid #2a2a2a',
      borderRadius: '12px',
      overflow: 'hidden',
      position: 'relative'
    }}>
      
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: '#1a1a1a', border: '0.5px solid #3ecf8e', borderRadius: '8px', padding: '10px 20px', color: '#3ecf8e', fontSize: '13px', zIndex: 999 }}>
          {toast}
        </div>
      )}

      {/* ── SIDEBAR: CHANNEL LIST ── */}
      <div style={{
        background: '#141414',
        borderRight: '0.5px solid #2a2a2a',
        display: 'flex',
        flexDirection: 'column'
      }}>
        
        {/* Sidebar Header */}
        <div style={{ padding: '16px', borderBottom: '0.5px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#ededed', margin: 0 }}>Team Chat</h3>
            <span style={{ fontSize: '11px', color: '#666' }}>Workspace Channels</span>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              background: '#242424',
              border: '0.5px solid #333',
              color: '#3ecf8e',
              borderRadius: '6px',
              width: '28px',
              height: '28px',
              fontSize: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold'
            }}
            title="Create New Channel"
          >
            +
          </button>
        </div>

        {/* Channel Search */}
        <div style={{ padding: '10px 12px', borderBottom: '0.5px solid #222' }}>
          <input
            type="text"
            placeholder="Filter channels..."
            value={channelSearch}
            onChange={e => setChannelSearch(e.target.value)}
            className="input-base"
            style={{ fontSize: '12px', padding: '6px 10px', background: '#1a1a1a' }}
          />
        </div>

        {/* Channels List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {loading && channels.length === 0 ? (
            <div style={{ color: '#555', fontSize: '12px', textAlign: 'center', padding: '12px' }}>Loading channels...</div>
          ) : filteredChannels.length === 0 ? (
            <div style={{ color: '#555', fontSize: '12px', textAlign: 'center', padding: '12px' }}>No channels found</div>
          ) : (
            filteredChannels.map(channel => {
              const isActive = activeChannel?.id === channel.id
              return (
                <button
                  key={channel.id}
                  onClick={() => setActiveChannel(channel)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: isActive ? '#222' : 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    color: isActive ? '#3ecf8e' : '#a0a0a0',
                    fontSize: '13px',
                    fontWeight: isActive ? '600' : '400',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justify: 'space-between',
                    transition: 'background 0.15s'
                  }}
                  onMouseOver={e => !isActive && (e.currentTarget.style.background = '#1a1a1a')}
                  onMouseOut={e => !isActive && (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    <span style={{ color: isActive ? '#3ecf8e' : '#666', fontWeight: 'bold' }}>
                      #
                    </span>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {channel.name}
                    </span>
                  </div>
                  {isActive && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3ecf8e' }} />}
                </button>
              )
            })
          )}
        </div>

      </div>

      {/* ── MAIN CHAT AREA ── */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#181818' }}>
        
        {/* Header */}
        <div style={{
          padding: '12px 20px',
          borderBottom: '0.5px solid #2a2a2a',
          background: '#1a1a1a',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {onBack && (
              <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#a0a0a0', cursor: 'pointer', fontSize: '14px' }}>
                ←
              </button>
            )}
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#ededed', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#3ecf8e' }}>#</span>
                {activeChannel?.name || 'select-channel'}
              </h3>
              <span style={{ fontSize: '11px', color: '#666' }}>
                {members.length} workspace member{members.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Search messages inside channel */}
            <input
              type="text"
              placeholder={`Search in #${activeChannel?.name || 'chat'}...`}
              value={messageSearch}
              onChange={e => setMessageSearch(e.target.value)}
              className="input-base"
              style={{ width: '180px', fontSize: '12px', padding: '4px 8px', background: '#141414' }}
            />

            {/* Member Avatars Stack */}
            <div style={{ display: 'flex', alignItems: 'center', marginLeft: '6px' }}>
              {members.slice(0, 5).map((m, idx) => (
                <div
                  key={m.id || idx}
                  title={m.full_name || m.email}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: '#2a2a2a',
                    border: '1.5px solid #1a1a1a',
                    display: 'flex',
                    alignItems: 'center',
                    justify: 'center',
                    fontSize: '11px',
                    fontWeight: '600',
                    color: '#ededed',
                    marginLeft: idx > 0 ? '-8px' : '0'
                  }}
                >
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt={m.full_name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    (m.full_name?.charAt(0) || 'U').toUpperCase()
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Messages List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {messagesLoading && messages.length === 0 ? (
            <div style={{ color: '#555', fontSize: '13px', textAlign: 'center', margin: 'auto' }}>Loading chat history...</div>
          ) : filteredMessages.length === 0 ? (
            <div style={{ color: '#666', fontSize: '13px', textAlign: 'center', margin: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '24px' }}>💬</div>
              <div>No messages yet in <strong>#{activeChannel?.name}</strong></div>
              <div style={{ fontSize: '12px', color: '#555' }}>Send a message below to start the conversation with your team!</div>
            </div>
          ) : (
            filteredMessages.map((msg, index) => {
              const sender = msg.sender || (msg.sender_id === currentUserProfile?.id ? currentUserProfile : null)
              const displayName = sender?.full_name || sender?.email || 'Workspace User'
              const isSelf = msg.sender_id === currentUserProfile?.id
              const isSending = msg.status === 'sending'
              const isError = msg.status === 'error'

              // Show date header if first message of the day
              const msgDate = msg.created_at ? new Date(msg.created_at).toLocaleDateString() : ''
              const prevMsgDate = index > 0 && messages[index - 1].created_at ? new Date(messages[index - 1].created_at).toLocaleDateString() : ''
              const showDateSeparator = index === 0 || (msgDate && msgDate !== prevMsgDate)

              return (
                <React.Fragment key={msg.id}>
                  {showDateSeparator && msgDate && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '10px 0 4px 0' }}>
                      <div style={{ flex: 1, height: '0.5px', background: '#262626' }} />
                      <span style={{ fontSize: '11px', color: '#666', fontWeight: '500' }}>{msgDate}</span>
                      <div style={{ flex: 1, height: '0.5px', background: '#262626' }} />
                    </div>
                  )}

                  <div style={{
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'flex-start',
                    opacity: isSending ? 0.7 : 1,
                    justifyContent: isSelf ? 'flex-end' : 'flex-start'
                  }}>
                    
                    {!isSelf && (
                      <div style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '50%',
                        background: '#2a2a2a',
                        display: 'flex',
                        alignItems: 'center',
                        justify: 'center',
                        fontSize: '13px',
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
                    )}

                    <div style={{ maxWidth: '75%', display: 'flex', flexDirection: 'column', alignItems: isSelf ? 'flex-end' : 'flex-start' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '3px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: isSelf ? '#3ecf8e' : '#ededed' }}>
                          {isSelf ? 'You' : displayName}
                        </span>
                        <span style={{ fontSize: '10px', color: '#666' }}>
                          {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>

                      <div style={{
                        fontSize: '13px',
                        color: isSelf ? '#ffffff' : '#d4d4d4',
                        background: isSelf ? '#1e382b' : '#141414',
                        border: isSelf ? '0.5px solid #2e5944' : '0.5px solid #262626',
                        padding: '10px 14px',
                        borderRadius: isSelf ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                        lineHeight: '1.45',
                        wordBreak: 'break-word',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
                      }}>
                        {msg.content}
                      </div>

                      {/* Status Indicator */}
                      {isSelf && (
                        <div style={{ fontSize: '10px', color: isError ? '#f87171' : '#666', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {isSending && <span>🕒 Sending...</span>}
                          {isError && (
                            <button
                              onClick={() => handleRetryMessage(msg)}
                              style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: 0, textDecoration: 'underline', fontSize: '10px' }}
                            >
                              ⚠️ Failed to send — Click to retry
                            </button>
                          )}
                          {!isSending && !isError && <span style={{ color: '#3ecf8e' }}>✓</span>}
                        </div>
                      )}
                    </div>

                    {isSelf && (
                      <div style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '50%',
                        background: '#2e5944',
                        display: 'flex',
                        alignItems: 'center',
                        justify: 'center',
                        fontSize: '13px',
                        fontWeight: '600',
                        color: '#3ecf8e',
                        flexShrink: 0
                      }}>
                        {currentUserProfile?.avatar_url ? (
                          <img src={currentUserProfile.avatar_url} alt="You" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          (currentUserProfile?.full_name || currentUserProfile?.email || 'Y').charAt(0).toUpperCase()
                        )}
                      </div>
                    )}

                  </div>
                </React.Fragment>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input Box */}
        <form onSubmit={handleSendMessage} style={{ padding: '16px 20px', borderTop: '0.5px solid #2a2a2a', background: '#141414', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            type="text"
            placeholder={`Message #${activeChannel?.name || 'channel'}...`}
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            className="input-base"
            style={{ flex: 1, background: '#1a1a1a', border: '0.5px solid #333', padding: '10px 14px', borderRadius: '8px' }}
          />
          <button
            type="submit"
            className="btn-primary"
            disabled={!newMessage.trim()}
            style={{ padding: '10px 20px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span>Send</span>
            <span>✈️</span>
          </button>
        </form>

      </div>

      {/* ── CREATE CHANNEL MODAL ── */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '16px', color: '#ededed' }}>Create New Channel</h3>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', color: '#a0a0a0', cursor: 'pointer', fontSize: '18px' }}>×</button>
            </div>
            <form onSubmit={handleCreateChannel}>
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#a0a0a0', marginBottom: '6px' }}>Channel Name</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '16px', color: '#3ecf8e', fontWeight: 'bold' }}>#</span>
                    <input
                      required
                      type="text"
                      placeholder="e.g. sales-strategy"
                      value={newChannelName}
                      onChange={e => setNewChannelName(e.target.value)}
                      className="input-base"
                      style={{ flex: 1 }}
                      autoFocus
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={creatingChannel || !newChannelName.trim()}>
                  {creatingChannel ? 'Creating...' : 'Create Channel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
