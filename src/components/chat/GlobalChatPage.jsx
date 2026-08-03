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

  const [teamMembers, setTeamMembers] = useState([])
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

  // ── @MENTIONS AUTOCOMPLETE STATE ──
  const [mentionQuery, setMentionQuery] = useState(null)
  const [mentionIndex, setMentionIndex] = useState(0)
  const inputRef = useRef(null)
  const messagesEndRef = useRef(null)

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
  }

  // ── 1. FETCH TEAM MEMBERS FOR DMS & MENTIONS ──
  const fetchTeamMembers = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, email, full_name, avatar_url, role, status')
      .eq('status', 'active')
      .order('full_name', { ascending: true })

    if (data) {
      setTeamMembers(data)
    }
  }, [])

  // ── 2. FETCH & CACHE CHANNELS ──
  const fetchUserChannels = useCallback(async () => {
    setLoading(true)
    await fetchTeamMembers()

    const { data, error } = await supabase
      .from('chat_channels')
      .select('*')
      .order('created_at', { ascending: true })

    let channelList = []
    if (!error && data && data.length > 0) {
      channelList = data
    } else {
      // Fallback default channels
      channelList = [
        { id: 'general-channel-id', name: 'general', type: 'team' },
        { id: 'announcements-channel-id', name: 'announcements', type: 'team' }
      ]
    }

    setChannels(channelList)
    try {
      localStorage.setItem('mrdevs_chat_channels', JSON.stringify(channelList))
    } catch {}

    setActiveChannel(prev => {
      if (prev) {
        const found = channelList.find(c => c.id === prev.id)
        if (found) return found
      }
      const gen = channelList.find(c => c.name === 'general') || channelList[0]
      return gen || null
    })

    setLoading(false)
  }, [fetchTeamMembers])

  useEffect(() => {
    fetchUserChannels()
  }, [fetchUserChannels])

  // ── 3. FETCH MESSAGES & MEMBERS FOR ACTIVE CHANNEL ──
  const fetchChannelData = useCallback(async (channelId) => {
    if (!channelId) return
    setMessagesLoading(true)

    // Load cached messages first for instant response
    try {
      const cached = localStorage.getItem(`mrdevs_chat_messages_${channelId}`)
      if (cached) setMessages(JSON.parse(cached))
    } catch {}

    // Fetch fresh messages
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

    // Fetch channel members
    const { data: memberData } = await supabase
      .from('channel_members')
      .select('user_id, profile:profiles(id, full_name, avatar_url, role)')
      .eq('channel_id', channelId)

    if (memberData && memberData.length > 0) {
      setMembers(memberData.map(m => m.profile).filter(Boolean))
    } else {
      setMembers(teamMembers)
    }

    setMessagesLoading(false)
    setTimeout(() => scrollToBottom(false), 50)
  }, [teamMembers])

  useEffect(() => {
    if (activeChannel?.id) {
      fetchChannelData(activeChannel.id)

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

  // ── 4. OPEN OR CREATE DIRECT MESSAGE CHANNEL (1-on-1 CHAT) ──
  const handleOpenDirectChat = async (targetUser) => {
    if (!currentUserProfile || targetUser.id === currentUserProfile.id) return

    // Find existing direct channel between current user and target user
    const directChannelName = [currentUserProfile.id, targetUser.id].sort().join('_')

    let dmChannel = channels.find(c => c.type === 'direct' && c.name === directChannelName)

    if (!dmChannel) {
      // Create new direct channel in Supabase
      const { data, error } = await supabase
        .from('chat_channels')
        .insert({
          name: directChannelName,
          type: 'direct'
        })
        .select('*')
        .single()

      if (!error && data) {
        dmChannel = data
        // Add both members to channel_members
        await supabase.from('channel_members').insert([
          { channel_id: data.id, user_id: currentUserProfile.id },
          { channel_id: data.id, user_id: targetUser.id }
        ])
        setChannels(prev => [...prev, data])
      } else {
        // Fallback local direct channel
        dmChannel = {
          id: `dm_${directChannelName}`,
          name: directChannelName,
          type: 'direct',
          targetUser
        }
      }
    }

    dmChannel.targetUser = targetUser
    setActiveChannel(dmChannel)
  }

  // ── 5. OPTIMISTIC MESSAGE SENDING ──
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
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'error', errorMsg: error.message } : m))
      showToast('Failed to send message: ' + error.message)
    } else {
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
    setMentionQuery(null)

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

  // ── 6. MENTIONS AUTOCOMPLETE LOGIC ──
  const handleInputChange = (e) => {
    const val = e.target.value
    setNewMessage(val)

    const cursor = e.target.selectionStart
    const textBeforeCursor = val.slice(0, cursor)
    const lastAt = textBeforeCursor.lastIndexOf('@')

    if (lastAt !== -1 && (lastAt === 0 || /\s/.test(textBeforeCursor[lastAt - 1]))) {
      const q = textBeforeCursor.slice(lastAt + 1)
      if (!/\s/.test(q)) {
        setMentionQuery(q)
        setMentionIndex(0)
        return
      }
    }
    setMentionQuery(null)
  }

  const matchingMentionUsers = teamMembers.filter(m => {
    if (!mentionQuery) return true
    const name = (m.full_name || m.email || '').toLowerCase()
    return name.includes(mentionQuery.toLowerCase())
  })

  const insertMention = (user) => {
    const name = user.full_name || user.email.split('@')[0]
    const cursor = inputRef.current?.selectionStart || newMessage.length
    const textBeforeCursor = newMessage.slice(0, cursor)
    const lastAt = textBeforeCursor.lastIndexOf('@')

    const before = newMessage.slice(0, lastAt)
    const after = newMessage.slice(cursor)
    const updated = `${before}@${name} ${after}`

    setNewMessage(updated)
    setMentionQuery(null)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  // Render message content with styled @Mentions
  const renderMessageContent = (content) => {
    if (!content) return null
    const parts = content.split(/(@[\w\s]+)/g)

    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return (
          <span
            key={i}
            style={{
              background: 'rgba(62, 207, 142, 0.18)',
              color: '#3ecf8e',
              padding: '1px 6px',
              borderRadius: '4px',
              fontWeight: '600',
              fontSize: '12px'
            }}
          >
            {part}
          </span>
        )
      }
      return part
    })
  }

  // ── 7. CREATE NEW GROUP CHANNEL ──
  const handleCreateChannel = async (e) => {
    e.preventDefault()
    if (!newChannelName.trim()) return

    const cleanName = newChannelName.toLowerCase().replace(/[^a-z0-9_-]/g, '-').trim()
    setCreatingChannel(true)

    const { data, error } = await supabase
      .from('chat_channels')
      .insert({ name: cleanName, type: 'team' })
      .select('*')
      .single()

    if (!error && data) {
      setChannels(prev => [...prev, data])
      setActiveChannel(data)
      setShowCreateModal(false)
      setNewChannelName('')
      showToast(`Channel #${cleanName} created!`)
    } else {
      showToast('Error creating channel: ' + (error?.message || 'Failed'))
    }
    setCreatingChannel(false)
  }

  // Group channels vs Direct Message channels
  const groupChannels = channels.filter(c => c.type !== 'direct' && c.name.toLowerCase().includes(channelSearch.toLowerCase()))
  const otherTeamMembers = teamMembers.filter(m => m.id !== currentUserProfile?.id && (m.full_name || m.email).toLowerCase().includes(channelSearch.toLowerCase()))
  const filteredMessages = messages.filter(m => !messageSearch || m.content.toLowerCase().includes(messageSearch.toLowerCase()))

  // Compute label for active channel header
  const isDirect = activeChannel?.type === 'direct'
  const activeDirectUser = isDirect ? (activeChannel.targetUser || teamMembers.find(m => activeChannel.name?.includes(m.id))) : null

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '260px 1fr',
      height: 'calc(100vh - 120px)',
      background: '#161616',
      border: '0.5px solid #232323',
      borderRadius: '12px',
      overflow: 'hidden',
      position: 'relative'
    }}>
      
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: '#161616', border: '0.5px solid #3ecf8e', borderRadius: '8px', padding: '10px 20px', color: '#3ecf8e', fontSize: '13px', zIndex: 999 }}>
          {toast}
        </div>
      )}

      {/* ── SIDEBAR: CHANNELS & DIRECT MESSAGES ── */}
      <div style={{
        background: '#121212',
        borderRight: '0.5px solid #232323',
        display: 'flex',
        flexDirection: 'column'
      }}>
        
        {/* Sidebar Header */}
        <div style={{ padding: '16px', borderBottom: '0.5px solid #232323', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 className="font-headline" style={{ fontSize: '15px', fontWeight: '700', color: '#f5f5f0', margin: 0 }}>Team Chat</h3>
            <span style={{ fontSize: '11px', color: '#8a8a85' }}>Group & 1-on-1 DMs</span>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              background: '#232323',
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

        {/* Filter Input */}
        <div style={{ padding: '10px 12px', borderBottom: '0.5px solid #232323' }}>
          <input
            type="text"
            placeholder="Search channels & team..."
            value={channelSearch}
            onChange={e => setChannelSearch(e.target.value)}
            className="input-base"
            style={{ fontSize: '12px', padding: '6px 10px', background: '#161616' }}
          />
        </div>

        {/* Channels & DMs Scroll List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Section: # GROUP CHANNELS */}
          <div>
            <div style={{ padding: '0 8px 6px 8px', fontSize: '10px', fontWeight: '700', color: '#8a8a85', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              # Channels
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {groupChannels.map(channel => {
                const isActive = activeChannel?.id === channel.id
                return (
                  <button
                    key={channel.id}
                    onClick={() => setActiveChannel(channel)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      background: isActive ? '#232323' : 'transparent',
                      border: 'none',
                      borderLeft: isActive ? '3px solid #3ecf8e' : '3px solid transparent',
                      borderRadius: '6px',
                      padding: '7px 10px',
                      color: isActive ? '#3ecf8e' : '#8a8a85',
                      fontSize: '13px',
                      fontWeight: isActive ? '600' : '400',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'background 0.15s'
                    }}
                    onMouseOver={e => !isActive && (e.currentTarget.style.background = '#1a1a1a')}
                    onMouseOut={e => !isActive && (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ color: isActive ? '#3ecf8e' : '#666', fontWeight: 'bold' }}>#</span>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {channel.name}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Section: 💬 DIRECT MESSAGES (1-on-1 CHATS) */}
          <div>
            <div style={{ padding: '0 8px 6px 8px', fontSize: '10px', fontWeight: '700', color: '#8a8a85', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              💬 Direct Messages
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {otherTeamMembers.map(member => {
                const isSelectedDM = isDirect && (activeDirectUser?.id === member.id || activeChannel?.name?.includes(member.id))

                return (
                  <button
                    key={member.id}
                    onClick={() => handleOpenDirectChat(member)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      background: isSelectedDM ? '#232323' : 'transparent',
                      border: 'none',
                      borderLeft: isSelectedDM ? '3px solid #3ecf8e' : '3px solid transparent',
                      borderRadius: '6px',
                      padding: '6px 10px',
                      color: isSelectedDM ? '#f5f5f0' : '#8a8a85',
                      fontSize: '12px',
                      fontWeight: isSelectedDM ? '600' : '400',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'background 0.15s'
                    }}
                    onMouseOver={e => !isSelectedDM && (e.currentTarget.style.background = '#1a1a1a')}
                    onMouseOut={e => !isSelectedDM && (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ position: 'relative', width: '22px', height: '22px', borderRadius: '50%', background: '#2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', flexShrink: 0 }}>
                      {member.avatar_url ? (
                        <img src={member.avatar_url} alt={member.full_name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        (member.full_name || member.email).charAt(0).toUpperCase()
                      )}
                      <div style={{ position: 'absolute', bottom: '-1px', right: '-1px', width: '6px', height: '6px', borderRadius: '50%', background: '#3ecf8e', border: '1px solid #121212' }} />
                    </div>

                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {member.full_name || member.email}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

        </div>

      </div>

      {/* ── MAIN CHAT VIEW ── */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0a0a0a' }}>
        
        {/* Header Bar */}
        <div style={{
          padding: '12px 20px',
          borderBottom: '0.5px solid #232323',
          background: '#161616',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {onBack && (
              <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#8a8a85', cursor: 'pointer', fontSize: '14px' }}>
                ←
              </button>
            )}
            <div>
              <h3 className="font-headline" style={{ fontSize: '15px', fontWeight: '700', color: '#f5f5f0', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#3ecf8e' }}>{isDirect ? '💬' : '#'}</span>
                {isDirect ? (activeDirectUser?.full_name || activeDirectUser?.email || 'Direct Message') : (activeChannel?.name || 'select-channel')}
              </h3>
              <span style={{ fontSize: '11px', color: '#8a8a85' }}>
                {isDirect ? `Private 1-on-1 chat with ${activeDirectUser?.full_name || 'team member'}` : `${members.length} members in channel`}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <input
              type="text"
              placeholder="Search messages..."
              value={messageSearch}
              onChange={e => setMessageSearch(e.target.value)}
              className="input-base"
              style={{ width: '180px', fontSize: '12px', padding: '4px 10px', background: '#121212' }}
            />
          </div>
        </div>

        {/* Message Stream */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {messagesLoading && messages.length === 0 ? (
            <div style={{ color: '#8a8a85', fontSize: '13px', textAlign: 'center', margin: 'auto' }}>Loading chat history...</div>
          ) : filteredMessages.length === 0 ? (
            <div style={{ color: '#8a8a85', fontSize: '13px', textAlign: 'center', margin: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '28px' }}>💬</div>
              <div>No messages yet in <strong>{isDirect ? activeDirectUser?.full_name || 'this DM' : `#${activeChannel?.name}`}</strong></div>
              <div style={{ fontSize: '12px', color: '#666' }}>Type a message below or mention `@member` to get started!</div>
            </div>
          ) : (
            filteredMessages.map((msg, index) => {
              const sender = msg.sender || (msg.sender_id === currentUserProfile?.id ? currentUserProfile : null)
              const displayName = sender?.full_name || sender?.email || 'Workspace User'
              const isSelf = msg.sender_id === currentUserProfile?.id
              const isSending = msg.status === 'sending'
              const isError = msg.status === 'error'

              return (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'flex-start',
                    opacity: isSending ? 0.7 : 1,
                    justifyContent: isSelf ? 'flex-end' : 'flex-start'
                  }}
                >
                  {!isSelf && (
                    <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#232323', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '600', color: '#f5f5f0', flexShrink: 0 }}>
                      {sender?.avatar_url ? (
                        <img src={sender.avatar_url} alt={displayName} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        displayName.charAt(0).toUpperCase()
                      )}
                    </div>
                  )}

                  <div style={{ maxWidth: '75%', display: 'flex', flexDirection: 'column', alignItems: isSelf ? 'flex-end' : 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '3px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: isSelf ? '#3ecf8e' : '#f5f5f0' }}>
                        {isSelf ? 'You' : displayName}
                      </span>
                      <span style={{ fontSize: '10px', color: '#666' }}>
                        {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>

                    <div style={{
                      fontSize: '13px',
                      color: isSelf ? '#ffffff' : '#f5f5f0',
                      background: isSelf ? '#204031' : '#161616',
                      border: isSelf ? '0.5px solid #3ecf8e' : '0.5px solid #232323',
                      padding: '10px 14px',
                      borderRadius: isSelf ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                      lineHeight: '1.45',
                      wordBreak: 'break-word',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                    }}>
                      {renderMessageContent(msg.content)}
                    </div>
                  </div>

                  {isSelf && (
                    <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#204031', border: '1px solid #3ecf8e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '600', color: '#3ecf8e', flexShrink: 0 }}>
                      {currentUserProfile?.avatar_url ? (
                        <img src={currentUserProfile.avatar_url} alt="You" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        (currentUserProfile?.full_name || currentUserProfile?.email || 'Y').charAt(0).toUpperCase()
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ── @MENTIONS POPUP AUTOCOMPLETE DROPDOWN ── */}
        {mentionQuery !== null && matchingMentionUsers.length > 0 && (
          <div style={{
            position: 'absolute',
            bottom: '70px',
            left: '280px',
            background: '#161616',
            border: '0.5px solid #3ecf8e',
            borderRadius: '8px',
            padding: '4px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            zIndex: 100,
            maxWidth: '240px',
            maxHeight: '180px',
            overflowY: 'auto'
          }}>
            <div style={{ padding: '4px 8px', fontSize: '10px', color: '#8a8a85', fontWeight: '700', textTransform: 'uppercase' }}>
              Mention Team Member
            </div>
            {matchingMentionUsers.map((user, idx) => (
              <button
                key={user.id}
                onClick={() => insertMention(user)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: idx === mentionIndex ? '#232323' : 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '6px 8px',
                  color: '#f5f5f0',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>
                  {(user.full_name || user.email).charAt(0).toUpperCase()}
                </div>
                <span>{user.full_name || user.email}</span>
              </button>
            ))}
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSendMessage} style={{ padding: '14px 20px', borderTop: '0.5px solid #232323', background: '#121212', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            ref={inputRef}
            type="text"
            placeholder={`Message ${isDirect ? activeDirectUser?.full_name || 'member' : '#' + (activeChannel?.name || 'channel')} (type @ to mention)...`}
            value={newMessage}
            onChange={handleInputChange}
            className="input-base"
            style={{ flex: 1, background: '#161616', border: '0.5px solid #232323', padding: '10px 14px', borderRadius: '8px' }}
          />
          <button
            type="submit"
            className="btn-primary"
            disabled={!newMessage.trim()}
            style={{ padding: '10px 18px', borderRadius: '8px' }}
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
              <h3 className="font-headline" style={{ margin: 0, fontSize: '16px', color: '#f5f5f0' }}>Create Group Channel</h3>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', color: '#8a8a85', cursor: 'pointer', fontSize: '18px' }}>×</button>
            </div>
            <form onSubmit={handleCreateChannel}>
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#8a8a85', marginBottom: '6px' }}>Channel Name</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '16px', color: '#3ecf8e', fontWeight: 'bold' }}>#</span>
                    <input
                      required
                      type="text"
                      placeholder="e.g. sales-leads"
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
