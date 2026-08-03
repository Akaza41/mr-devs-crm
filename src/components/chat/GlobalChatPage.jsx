import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'

export default function GlobalChatPage({ currentUserProfile }) {
  const [channels, setChannels] = useState([])
  const [activeChannel, setActiveChannel] = useState(null)
  const [messages, setMessages] = useState([])
  const [members, setMembers] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    fetchUserChannels()
  }, [])

  useEffect(() => {
    if (activeChannel) {
      fetchChannelData(activeChannel.id)
      const subscription = subscribeToChannelMessages(activeChannel.id)
      return () => {
        supabase.removeChannel(subscription)
      }
    }
  }, [activeChannel])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Fetch channels caller is entitled to see via RLS
  const fetchUserChannels = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('chat_channels')
      .select('*')
      .order('created_at', { ascending: true })

    if (!error && data) {
      setChannels(data)
      if (data.length > 0 && !activeChannel) {
        // Default to #general or first channel
        const gen = data.find(c => c.name === 'general') || data[0]
        setActiveChannel(gen)
      }
    }
    setLoading(false)
  }

  // Fetch messages and member profiles for selected channel
  const fetchChannelData = async (channelId) => {
    setMessagesLoading(true)
    
    // Fetch messages with sender profiles
    const { data: msgData } = await supabase
      .from('chat_messages')
      .select('id, channel_id, sender_id, content, created_at, sender:profiles(id, full_name, avatar_url, email)')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })

    if (msgData) {
      setMessages(msgData)
    }

    // Fetch channel members
    const { data: memberData } = await supabase
      .from('channel_members')
      .select('user_id, joined_at, profile:profiles(id, full_name, avatar_url, role)')
      .eq('channel_id', channelId)

    if (memberData) {
      setMembers(memberData.map(m => m.profile).filter(Boolean))
    }

    setMessagesLoading(false)
  }

  // Realtime subscription for Postgres INSERT events on chat_messages
  const subscribeToChannelMessages = (channelId) => {
    return supabase
      .channel(`chat_messages:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `channel_id=eq.${channelId}`
        },
        async (payload) => {
          const newMsg = payload.new
          // Fetch sender info if missing
          const { data: sender } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url, email')
            .eq('id', newMsg.sender_id)
            .single()

          setMessages(prev => {
            // Avoid duplicate rendering if already present
            if (prev.some(m => m.id === newMsg.id)) return prev
            return [...prev, { ...newMsg, sender }]
          })
        }
      )
      .subscribe()
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || !activeChannel || !currentUserProfile) return

    const messageText = newMessage.trim()
    setNewMessage('')

    const { error } = await supabase
      .from('chat_messages')
      .insert({
        channel_id: activeChannel.id,
        sender_id: currentUserProfile.id,
        content: messageText
      })

    if (error) {
      alert('Failed to send message: ' + error.message)
    }
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '260px 1fr',
      height: 'calc(100vh - 120px)',
      background: '#1a1a1a',
      border: '0.5px solid #2a2a2a',
      borderRadius: '12px',
      overflow: 'hidden'
    }}>
      
      {/* Sidebar: Channel List */}
      <div style={{
        background: '#141414',
        borderRight: '0.5px solid #2a2a2a',
        display: 'flex',
        flexDirection: 'column',
        padding: '16px 0'
      }}>
        <div style={{ padding: '0 16px 12px 16px', borderBottom: '0.5px solid #222' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#ededed', margin: 0 }}>Team Channels</h3>
          <span style={{ fontSize: '11px', color: '#666' }}>Realtime workspace chat</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {loading ? (
            <div style={{ color: '#555', fontSize: '12px', textAlign: 'center', padding: '12px' }}>Loading channels...</div>
          ) : channels.length === 0 ? (
            <div style={{ color: '#555', fontSize: '12px', textAlign: 'center', padding: '12px' }}>No channels accessible</div>
          ) : (
            channels.map(channel => {
              const isActive = activeChannel?.id === channel.id
              const isGeneral = channel.name === 'general'
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
                    gap: '8px',
                    transition: 'background 0.15s'
                  }}
                  onMouseOver={e => !isActive && (e.currentTarget.style.background = '#1a1a1a')}
                  onMouseOut={e => !isActive && (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ color: isActive ? '#3ecf8e' : '#666', fontWeight: 'bold' }}>
                    {channel.type === 'team' ? '#' : '💬'}
                  </span>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {channel.name}
                  </span>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        
        {/* Header */}
        <div style={{
          padding: '14px 20px',
          borderBottom: '0.5px solid #2a2a2a',
          background: '#1a1a1a',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#ededed', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: '#3ecf8e' }}>{activeChannel?.type === 'team' ? '#' : '💬'}</span>
              {activeChannel?.name || 'Select a channel'}
            </h3>
            <span style={{ fontSize: '11px', color: '#666' }}>
              {members.length} member{members.length === 1 ? '' : 's'} in channel
            </span>
          </div>

          {/* Member Avatars */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '-6px' }}>
            {members.slice(0, 5).map(m => (
              <div
                key={m.id}
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
                  marginLeft: '-6px'
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

        {/* Messages List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {messagesLoading ? (
            <div style={{ color: '#555', fontSize: '13px', textAlign: 'center', margin: 'auto' }}>Loading messages...</div>
          ) : messages.length === 0 ? (
            <div style={{ color: '#555', fontSize: '13px', textAlign: 'center', margin: 'auto' }}>
              No messages yet in #{activeChannel?.name}. Start the conversation!
            </div>
          ) : (
            messages.map(msg => {
              const sender = msg.sender
              const displayName = sender?.full_name || sender?.email || 'Unknown User'
              const isSelf = sender?.id === currentUserProfile?.id

              return (
                <div key={msg.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: '#2a2a2a',
                    display: 'flex',
                    alignItems: 'center',
                    justify: 'center',
                    fontSize: '14px',
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
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: isSelf ? '#3ecf8e' : '#ededed' }}>
                        {displayName}
                      </span>
                      <span style={{ fontSize: '11px', color: '#555' }}>
                        {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>

                    <div style={{
                      fontSize: '13px',
                      color: '#d4d4d4',
                      marginTop: '4px',
                      lineHeight: '1.4',
                      background: '#141414',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '0.5px solid #222',
                      display: 'inline-block',
                      maxWidth: '85%',
                      wordBreak: 'break-word'
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

        {/* Message Input Box */}
        <form onSubmit={handleSendMessage} style={{ padding: '16px 20px', borderTop: '0.5px solid #2a2a2a', background: '#141414', display: 'flex', gap: '12px' }}>
          <input
            type="text"
            placeholder={`Message #${activeChannel?.name || 'channel'}...`}
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            className="input-base"
            style={{ flex: 1, background: '#1a1a1a', border: '0.5px solid #333' }}
          />
          <button type="submit" className="btn-primary" disabled={!newMessage.trim()}>
            Send
          </button>
        </form>

      </div>

    </div>
  )
}
