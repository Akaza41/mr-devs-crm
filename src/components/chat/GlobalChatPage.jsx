import React, { useState, useEffect, useRef, useCallback } from 'react'
import { db } from '../../lib/firebase'
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore'

export default function GlobalChatPage({ currentUserProfile, onBack }) {
  const [channels, setChannels] = useState([])
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

  // ── 1. FETCH TEAM MEMBERS & CHANNELS VIA FIRESTORE ──
  useEffect(() => {
    setLoading(true)

    // Team Members listener
    const qUsers = query(collection(db, 'users'), orderBy('displayName', 'asc'))
    const unsubUsers = onSnapshot(qUsers, (snap) => {
      const list = snap.docs.map(d => ({
        id: d.id,
        email: d.data().email,
        full_name: d.data().displayName || d.data().email,
        avatar_url: d.data().photoURL,
        role: d.data().role,
        status: d.data().active ? 'active' : 'inactive'
      }))
      setTeamMembers(list)
    })

    // Channels listener
    const qChannels = query(collection(db, 'chat_channels'), orderBy('createdAt', 'asc'))
    const unsubChannels = onSnapshot(qChannels, async (snap) => {
      let chanList = snap.docs.map(d => ({ id: d.id, ...d.data() }))

      // If no channels exist yet, auto-create #general
      if (chanList.length === 0) {
        try {
          const genRef = await addDoc(collection(db, 'chat_channels'), {
            name: 'general',
            type: 'team',
            createdAt: serverTimestamp()
          })
          chanList = [{ id: genRef.id, name: 'general', type: 'team' }]
        } catch (e) {
          console.warn('Auto-create general channel error:', e)
        }
      }

      setChannels(chanList)
      if (chanList.length > 0 && !activeChannel) {
        setActiveChannel(chanList[0])
      }
      setLoading(false)
    }, (err) => {
      console.error('Error fetching chat_channels snapshot:', err)
      setLoading(false)
    })

    return () => {
      unsubUsers()
      unsubChannels()
    }
  }, [])

  // ── 2. REAL-TIME MESSAGES SNAPSHOT PER ACTIVE CHANNEL ──
  useEffect(() => {
    if (!activeChannel) return
    setMessagesLoading(true)

    const messagesRef = collection(db, 'chat_channels', String(activeChannel.id), 'messages')
    const qMsg = query(messagesRef, orderBy('createdAt', 'asc'))

    const unsubMsg = onSnapshot(qMsg, (snap) => {
      const msgList = snap.docs.map(d => {
        const data = d.data()
        return {
          id: d.id,
          channel_id: activeChannel.id,
          sender_id: data.senderId,
          content: data.content,
          mentioned_user_ids: data.mentionedUserIds || [],
          created_at: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
          sender: {
            id: data.senderId,
            full_name: data.senderName || 'Team Member',
            avatar_url: data.senderAvatar || null
          },
          status: 'sent'
        }
      })
      setMessages(msgList)
      setMessagesLoading(false)
      setTimeout(() => scrollToBottom(false), 50)
    }, (err) => {
      console.error('Error fetching messages snapshot:', err)
      setMessagesLoading(false)
    })

    return () => unsubMsg()
  }, [activeChannel])

  // ── 3. SEND MESSAGE ──
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !activeChannel || !currentUserProfile) return
    const content = newMessage.trim()
    setNewMessage('')

    // Extract @mentions
    const mentionedUserIds = []
    teamMembers.forEach(m => {
      if (content.toLowerCase().includes(`@${(m.full_name || '').toLowerCase()}`)) {
        mentionedUserIds.push(m.id)
      }
    })

    try {
      const messagesRef = collection(db, 'chat_channels', String(activeChannel.id), 'messages')
      await addDoc(messagesRef, {
        senderId: currentUserProfile.id,
        senderName: currentUserProfile.displayName || currentUserProfile.full_name || currentUserProfile.email,
        senderAvatar: currentUserProfile.photoURL || currentUserProfile.avatar_url || null,
        content,
        mentionedUserIds,
        createdAt: serverTimestamp()
      })
      setTimeout(() => scrollToBottom(true), 50)
    } catch (err) {
      console.error('Send message error:', err)
      showToast('Error sending message: ' + err.message)
    }
  }

  // ── 4. CREATE NEW CHANNEL ──
  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) return
    setCreatingChannel(true)
    try {
      const docRef = await addDoc(collection(db, 'chat_channels'), {
        name: newChannelName.trim().toLowerCase().replace(/\s+/g, '-'),
        type: createType,
        members: selectedMemberIds,
        createdBy: currentUserProfile?.id || null,
        createdAt: serverTimestamp()
      })

      const newChan = { id: docRef.id, name: newChannelName.trim(), type: createType }
      setActiveChannel(newChan)
      setShowCreateModal(false)
      setNewChannelName('')
      setSelectedMemberIds([])
      showToast('Channel created')
    } catch (err) {
      showToast('Error creating channel: ' + err.message)
    } finally {
      setCreatingChannel(false)
    }
  }

  const filteredMessages = messages.filter(m => 
    !messageSearch || (m.content || '').toLowerCase().includes(messageSearch.toLowerCase())
  )

  const filteredChannels = channels.filter(c =>
    !channelSearch || (c.name || '').toLowerCase().includes(channelSearch.toLowerCase())
  )

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 48px)', background: '#0f0f0f', color: '#ededed', borderRadius: '12px', overflow: 'hidden', border: '0.5px solid #2a2a2a' }}>
      
      {/* Toast Notification */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: '#161616', border: '0.5px solid #3ecf8e', borderRadius: '8px', padding: '10px 16px', color: '#3ecf8e', fontSize: '13px', zIndex: 1000 }}>
          {toast}
        </div>
      )}

      {/* CHANNELS SIDEBAR */}
      <div style={{ width: '280px', background: '#141414', borderRight: '0.5px solid #2a2a2a', display: 'flex', flexDirection: 'column' }}>
        
        {/* Sidebar Header */}
        <div style={{ padding: '16px', borderBottom: '0.5px solid #2a2a2a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: '600', fontSize: '14px', color: '#fff' }}>Team Chat</div>
          <button 
            onClick={() => setShowCreateModal(true)} 
            className="btn-primary"
            style={{ padding: '4px 10px', fontSize: '12px' }}
          >
            + New
          </button>
        </div>

        {/* Channel Search */}
        <div style={{ padding: '12px' }}>
          <input 
            className="input-base"
            placeholder="Search channels..."
            value={channelSearch}
            onChange={e => setChannelSearch(e.target.value)}
            style={{ fontSize: '12px', padding: '6px 10px' }}
          />
        </div>

        {/* Channel List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
          {loading ? (
            <div style={{ padding: '16px', fontSize: '12px', color: '#666', textAlign: 'center' }}>Loading channels...</div>
          ) : (
            filteredChannels.map(c => (
              <div 
                key={c.id}
                onClick={() => setActiveChannel(c)}
                style={{ 
                  padding: '8px 12px', 
                  borderRadius: '6px', 
                  marginBottom: '4px',
                  background: activeChannel?.id === c.id ? 'rgba(62, 207, 142, 0.15)' : 'transparent',
                  color: activeChannel?.id === c.id ? '#3ecf8e' : '#ccc',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: activeChannel?.id === c.id ? '600' : '400',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span>#</span>
                <span>{c.name}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* CHAT MAIN AREA */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0f0f0f' }}>
        
        {/* Chat Header */}
        <div style={{ padding: '16px 24px', borderBottom: '0.5px solid #2a2a2a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#141414' }}>
          <div>
            <span style={{ fontWeight: '600', fontSize: '15px', color: '#fff' }}>#{activeChannel?.name || 'general'}</span>
            <span style={{ fontSize: '12px', color: '#666', marginLeft: '12px' }}>{teamMembers.length} members</span>
          </div>
          <input 
            className="input-base"
            placeholder="Search in chat..."
            value={messageSearch}
            onChange={e => setMessageSearch(e.target.value)}
            style={{ width: '200px', fontSize: '12px', padding: '4px 10px' }}
          />
        </div>

        {/* Message Timeline */}
        <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {messagesLoading ? (
            <div style={{ textAlign: 'center', color: '#666', fontSize: '12px' }}>Loading messages...</div>
          ) : filteredMessages.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#555', fontSize: '13px', marginTop: '40px' }}>
              No messages yet in #{activeChannel?.name}. Send a message to start the conversation!
            </div>
          ) : (
            filteredMessages.map(m => {
              const isMe = m.sender_id === currentUserProfile?.id
              return (
                <div key={m.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 'bold', color: '#3ecf8e' }}>
                    {(m.sender?.full_name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '2px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: isMe ? '#3ecf8e' : '#fff' }}>{m.sender?.full_name || 'Team Member'}</span>
                      <span style={{ fontSize: '10px', color: '#555' }}>{m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                    </div>
                    <div style={{ fontSize: '13px', color: '#ddd', background: '#161616', border: '0.5px solid #262626', padding: '8px 12px', borderRadius: '8px', display: 'inline-block', maxWidth: '80%', lineHeight: '1.4' }}>
                      {m.content}
                    </div>
                  </div>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input Bar */}
        <div style={{ padding: '16px 24px', borderTop: '0.5px solid #2a2a2a', background: '#141414', display: 'flex', gap: '12px' }}>
          <input 
            ref={inputRef}
            className="input-base"
            placeholder={`Message #${activeChannel?.name || 'general'}...`}
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
            style={{ flex: 1 }}
          />
          <button className="btn-primary" onClick={handleSendMessage} disabled={!newMessage.trim()}>
            Send
          </button>
        </div>

      </div>

      {/* CREATE CHANNEL MODAL */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>Create New Channel</span>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', color: '#777', cursor: 'pointer' }}>×</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input 
                className="input-base"
                placeholder="Channel Name (e.g. sales-leads)"
                value={newChannelName}
                onChange={e => setNewChannelName(e.target.value)}
              />
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleCreateChannel} disabled={creatingChannel || !newChannelName.trim()}>
                {creatingChannel ? 'Creating...' : 'Create Channel'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
