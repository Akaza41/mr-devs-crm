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

  // ── GROUP & CHANNEL CREATION MODAL STATE ──
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createType, setCreateType] = useState('group') // 'group' | 'team'
  const [newChannelName, setNewChannelName] = useState('')
  const [selectedMemberIds, setSelectedMemberIds] = useState([])
  const [creatingChannel, setCreatingChannel] = useState(false)

  // ── MENTIONS INBOX STATE ──
  const [unreadMentions, setUnreadMentions] = useState([])
  const [showMentionsInbox, setShowMentionsInbox] = useState(false)

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

  // ── 1. FETCH TEAM MEMBERS ──
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

  // ── 2. FETCH UNREAD MENTIONS FOR INBOX ──
  const fetchUnreadMentions = useCallback(async () => {
    if (!currentUserProfile?.id) return
    const { data } = await supabase.rpc('get_unread_mentions', { p_user_id: currentUserProfile.id })
    if (data) {
      setUnreadMentions(data)
    }
  }, [currentUserProfile])

  // ── 3. FETCH CHANNELS ──
  const fetchUserChannels = useCallback(async () => {
    setLoading(true)
    await fetchTeamMembers()
    await fetchUnreadMentions()

    const { data, error } = await supabase
      .from('chat_channels')
      .select('*')
      .order('created_at', { ascending: true })

    let channelList = []
    if (!error && data && data.length > 0) {
      channelList = data
    } else {
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
  }, [fetchTeamMembers, fetchUnreadMentions])

  useEffect(() => {
    fetchUserChannels()
  }, [fetchUserChannels])

  // ── 4. MARK CHANNEL AS READ ──
  const markChannelAsRead = useCallback(async (channelId) => {
    if (!currentUserProfile?.id || !channelId) return
    await supabase
      .from('channel_members')
      .upsert({
        channel_id: channelId,
        user_id: currentUserProfile.id,
        last_read_at: new Date().toISOString()
      }, { onConflict: 'channel_id,user_id' })

    fetchUnreadMentions()
  }, [currentUserProfile, fetchUnreadMentions])

  // ── 5. FETCH MESSAGES & MEMBERS FOR ACTIVE CHANNEL ──
  const fetchChannelData = useCallback(async (channelId) => {
    if (!channelId) return
    setMessagesLoading(true)

    try {
      const cached = localStorage.getItem(`mrdevs_chat_messages_${channelId}`)
      if (cached) setMessages(JSON.parse(cached))
    } catch {}

    const { data: msgData } = await supabase
      .from('chat_messages')
      .select('id, channel_id, sender_id, content, mentioned_user_ids, created_at, sender:profiles(id, full_name, avatar_url, email)')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })

    if (msgData) {
      const formatted = msgData.map(m => ({ ...m, status: 'sent' }))
      setMessages(formatted)
      try {
        localStorage.setItem(`mrdevs_chat_messages_${channelId}`, JSON.stringify(formatted.slice(-100)))
      } catch {}
    }

    const { data: memberData } = await supabase
      .from('channel_members')
      .select('user_id, profile:profiles(id, full_name, avatar_url, role)')
      .eq('channel_id', channelId)

    if (memberData && memberData.length > 0) {
      setMembers(memberData.map(m => m.profile).filter(Boolean))
    } else {
      setMembers(teamMembers)
    }

    markChannelAsRead(channelId)
    setMessagesLoading(false)
    setTimeout(() => scrollToBottom(false), 50)
  }, [teamMembers, markChannelAsRead])

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

            markChannelAsRead(activeChannel.id)
            setTimeout(() => scrollToBottom(true), 50)
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [activeChannel, fetchChannelData, currentUserProfile, markChannelAsRead])

  // ── 6. DIRECT MESSAGES (1-ON-1 CHAT) ──
  const handleOpenDirectChat = async (targetUser) => {
    if (!currentUserProfile || targetUser.id === currentUserProfile.id) return

    const directChannelName = [currentUserProfile.id, targetUser.id].sort().join('_')
    let dmChannel = channels.find(c => c.type === 'direct' && c.name === directChannelName)

    if (!dmChannel) {
      const { data, error } = await supabase
        .from('chat_channels')
        .insert({ name: directChannelName, type: 'direct' })
        .select('*')
        .single()

      if (!error && data) {
        dmChannel = data
        await supabase.from('channel_members').insert([
          { channel_id: data.id, user_id: currentUserProfile.id },
          { channel_id: data.id, user_id: targetUser.id }
        ])
        setChannels(prev => [...prev, data])
      } else {
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

  // ── 7. RESOLVE MENTIONED USER IDS AND SEND MESSAGE ──
  const parseMentionedUserIds = (messageText) => {
    if (!messageText) return []
    const ids = new Set()
    
    // Check for @Name or @Email matches against teamMembers
    teamMembers.forEach(member => {
      const name = (member.full_name || member.email.split('@')[0]).toLowerCase()
      if (messageText.toLowerCase().includes(`@${name}`)) {
        ids.add(member.id)
      }
    })

    return Array.from(ids)
  }

  const sendMessagePayload = async (messageText, tempId, mentionedIds) => {
    if (!activeChannel || !currentUserProfile) return

    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        channel_id: activeChannel.id,
        sender_id: currentUserProfile.id,
        content: messageText,
        mentioned_user_ids: mentionedIds
      })
      .select('*, sender:profiles(id, full_name, avatar_url, email)')
      .single()

    if (error) {
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'error', errorMsg: error.message } : m))
      showToast('Failed to send message: ' + error.message)
    } else {
      const serverMsg = data || { id: tempId, content: messageText, mentioned_user_ids: mentionedIds, created_at: new Date().toISOString(), status: 'sent', sender: currentUserProfile }
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
    const mentionedIds = parseMentionedUserIds(messageText)

    setNewMessage('')
    setMentionQuery(null)

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
    const tempMsg = {
      id: tempId,
      channel_id: activeChannel.id,
      sender_id: currentUserProfile.id,
      content: messageText,
      mentioned_user_ids: mentionedIds,
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
    sendMessagePayload(messageText, tempId, mentionedIds)
  }

  // ── 8. MENTIONS AUTOCOMPLETE LOGIC ──
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

  // ── 9. CREATE MULTI-MEMBER GROUP CHAT OR PUBLIC CHANNEL ──
  const handleCreateChannelOrGroup = async (e) => {
    e.preventDefault()
    if (!newChannelName.trim()) return

    const cleanName = newChannelName.toLowerCase().replace(/[^a-z0-9_-]/g, '-').trim()
    setCreatingChannel(true)

    const channelType = createType === 'group' ? 'group' : 'team'

    const { data, error } = await supabase
      .from('chat_channels')
      .insert({ name: cleanName, type: channelType })
      .select('*')
      .single()

    if (!error && data) {
      // Add all selected members + current user to channel_members
      const allMemberIds = new Set([...selectedMemberIds, currentUserProfile.id])
      const memberRows = Array.from(allMemberIds).map(uid => ({
        channel_id: data.id,
        user_id: uid
      }))

      await supabase.from('channel_members').insert(memberRows)

      setChannels(prev => [...prev, data])
      setActiveChannel(data)
      setShowCreateModal(false)
      setNewChannelName('')
      setSelectedMemberIds([])
      showToast(`${createType === 'group' ? 'Group Chat' : 'Channel'} #${cleanName} created!`)
    } else {
      showToast('Error creating group: ' + (error?.message || 'Failed'))
    }
    setCreatingChannel(false)
  }

  // Jump to channel from Mentions Inbox
  const handleJumpToMention = (mentionItem) => {
    const targetChan = channels.find(c => c.id === mentionItem.channel_id)
    if (targetChan) {
      setActiveChannel(targetChan)
      setShowMentionsInbox(false)
    } else {
      showToast('Channel not found')
    }
  }

  // Filter channels into categories
  const publicChannels = channels.filter(c => c.type === 'team' && c.name.toLowerCase().includes(channelSearch.toLowerCase()))
  const groupChats = channels.filter(c => c.type === 'group' && c.name.toLowerCase().includes(channelSearch.toLowerCase()))
  const otherTeamMembers = teamMembers.filter(m => m.id !== currentUserProfile?.id && (m.full_name || m.email).toLowerCase().includes(channelSearch.toLowerCase()))
  const filteredMessages = messages.filter(m => !messageSearch || m.content.toLowerCase().includes(messageSearch.toLowerCase()))

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

      {/* ── SIDEBAR: CHANNELS, GROUPS & DIRECT MESSAGES ── */}
      <div style={{
        background: '#121212',
        borderRight: '0.5px solid #232323',
        display: 'flex',
        flexDirection: 'column'
      }}>
        
        {/* Sidebar Header with Mentions Inbox Bell */}
        <div style={{ padding: '16px', borderBottom: '0.5px solid #232323', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 className="font-headline" style={{ fontSize: '15px', fontWeight: '700', color: '#f5f5f0', margin: 0 }}>Team Chat</h3>
            <span style={{ fontSize: '11px', color: '#8a8a85' }}>Groups, DMs & Mentions</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Mentions Inbox Bell */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowMentionsInbox(!showMentionsInbox)}
                style={{
                  background: unreadMentions.length > 0 ? 'rgba(62,207,142,0.15)' : '#232323',
                  border: unreadMentions.length > 0 ? '0.5px solid #3ecf8e' : '0.5px solid #333',
                  color: unreadMentions.length > 0 ? '#3ecf8e' : '#8a8a85',
                  borderRadius: '6px',
                  width: '28px',
                  height: '28px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative'
                }}
                title="Mentions Inbox"
              >
                🔔
                {unreadMentions.length > 0 && (
                  <span style={{ position: 'absolute', top: '-4px', right: '-4px', background: '#3ecf8e', color: '#0a0a0a', fontSize: '9px', fontWeight: '800', width: '14px', height: '14px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {unreadMentions.length}
                  </span>
                )}
              </button>

              {/* Mentions Inbox Dropdown */}
              {showMentionsInbox && (
                <div style={{
                  position: 'absolute',
                  top: '34px',
                  right: '0',
                  width: '280px',
                  background: '#161616',
                  border: '0.5px solid #3ecf8e',
                  borderRadius: '8px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  zIndex: 120,
                  padding: '8px',
                  maxHeight: '260px',
                  overflowY: 'auto'
                }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#8a8a85', padding: '4px 8px 8px 8px', borderBottom: '0.5px solid #232323', textTransform: 'uppercase' }}>
                    Unread Mentions ({unreadMentions.length})
                  </div>

                  {unreadMentions.length === 0 ? (
                    <div style={{ color: '#8a8a85', fontSize: '12px', padding: '16px', textAlign: 'center' }}>
                      No unread mentions!
                    </div>
                  ) : (
                    unreadMentions.map(m => (
                      <button
                        key={m.message_id}
                        onClick={() => handleJumpToMention(m)}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          background: '#232323',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '8px',
                          margin: '6px 0',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#3ecf8e', fontWeight: '600' }}>
                          <span>@{m.sender_name} in #{m.channel_name}</span>
                          <span style={{ color: '#666', fontWeight: '400' }}>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#f5f5f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {m.content}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
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
              title="Create Channel or Group"
            >
              +
            </button>
          </div>
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

        {/* Channels, Groups & DMs Scroll List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Section 1: # PUBLIC CHANNELS */}
          <div>
            <div style={{ padding: '0 8px 6px 8px', fontSize: '10px', fontWeight: '700', color: '#8a8a85', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              # Channels
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {publicChannels.map(channel => {
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
                      padding: '6px 10px',
                      color: isActive ? '#3ecf8e' : '#8a8a85',
                      fontSize: '13px',
                      fontWeight: isActive ? '600' : '400',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <span style={{ color: isActive ? '#3ecf8e' : '#666', fontWeight: 'bold' }}>#</span>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{channel.name}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Section 2: 👥 GROUP CHATS */}
          {groupChats.length > 0 && (
            <div>
              <div style={{ padding: '0 8px 6px 8px', fontSize: '10px', fontWeight: '700', color: '#8a8a85', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                👥 Group Chats
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {groupChats.map(channel => {
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
                        padding: '6px 10px',
                        color: isActive ? '#3ecf8e' : '#8a8a85',
                        fontSize: '12px',
                        fontWeight: isActive ? '600' : '400',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <span style={{ color: '#3ecf8e' }}>👥</span>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{channel.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Section 3: 💬 DIRECT MESSAGES */}
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
                      gap: '8px'
                    }}
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

      {/* ── MAIN CHAT STREAM ── */}
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
                <span style={{ color: '#3ecf8e' }}>{isDirect ? '💬' : activeChannel?.type === 'group' ? '👥' : '#'}</span>
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
            filteredMessages.map((msg) => {
              const sender = msg.sender || (msg.sender_id === currentUserProfile?.id ? currentUserProfile : null)
              const displayName = sender?.full_name || sender?.email || 'Workspace User'
              const isSelf = msg.sender_id === currentUserProfile?.id
              const isSending = msg.status === 'sending'

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

        {/* ── @MENTIONS AUTOCOMPLETE DROPDOWN ── */}
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

      {/* ── CREATE CHANNEL / MULTI-MEMBER GROUP CHAT MODAL ── */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" style={{ maxWidth: '440px', background: '#161616', border: '0.5px solid #232323' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="font-headline" style={{ margin: 0, fontSize: '16px', color: '#f5f5f0' }}>Create Channel or Group Chat</h3>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', color: '#8a8a85', cursor: 'pointer', fontSize: '18px' }}>×</button>
            </div>

            <form onSubmit={handleCreateChannelOrGroup}>
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* Type Selection */}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setCreateType('group')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      background: createType === 'group' ? 'rgba(62,207,142,0.15)' : '#121212',
                      border: createType === 'group' ? '0.5px solid #3ecf8e' : '0.5px solid #232323',
                      color: createType === 'group' ? '#3ecf8e' : '#8a8a85',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    👥 Group Chat
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateType('team')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      background: createType === 'team' ? 'rgba(62,207,142,0.15)' : '#121212',
                      border: createType === 'team' ? '0.5px solid #3ecf8e' : '0.5px solid #232323',
                      color: createType === 'team' ? '#3ecf8e' : '#8a8a85',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    # Public Channel
                  </button>
                </div>

                {/* Name Input */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#8a8a85', marginBottom: '6px' }}>
                    {createType === 'group' ? 'Group Name' : 'Channel Name'}
                  </label>
                  <input
                    required
                    type="text"
                    placeholder={createType === 'group' ? 'e.g. Sales Alpha Team' : 'e.g. healthcare-leads'}
                    value={newChannelName}
                    onChange={e => setNewChannelName(e.target.value)}
                    className="input-base"
                    autoFocus
                  />
                </div>

                {/* Member Selection Checkboxes for Group Chats */}
                {createType === 'group' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#8a8a85', marginBottom: '6px' }}>Select Group Members</label>
                    <div style={{ maxHeight: '150px', overflowY: 'auto', background: '#121212', border: '0.5px solid #232323', borderRadius: '6px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {teamMembers.filter(m => m.id !== currentUserProfile?.id).map(m => {
                        const isChecked = selectedMemberIds.includes(m.id)
                        return (
                          <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#f5f5f0', cursor: 'pointer', padding: '2px 4px' }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={e => {
                                if (e.target.checked) setSelectedMemberIds(prev => [...prev, m.id])
                                else setSelectedMemberIds(prev => prev.filter(id => id !== m.id))
                              }}
                            />
                            <span>{m.full_name || m.email}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}

              </div>

              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={creatingChannel || !newChannelName.trim()}>
                  {creatingChannel ? 'Creating...' : `Create ${createType === 'group' ? 'Group Chat' : 'Channel'}`}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  )
}
