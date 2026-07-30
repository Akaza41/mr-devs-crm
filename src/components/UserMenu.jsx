import { useState, useRef, useEffect } from 'react'
import { RoleBadge } from './team/EmployeeCard'

export default function UserMenu({ userProfile, onLogout, onSelectMenu }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (!userProfile) return null

  const displayName = userProfile.full_name || userProfile.username || 'Unnamed User'
  const initial = displayName.charAt(0).toUpperCase()

  return (
    <div style={{ position: 'relative' }} ref={menuRef}>
      {/* Trigger */}
      <button 
        onClick={() => setOpen(!open)}
        style={{ 
          background: 'none', border: 'none', cursor: 'pointer', padding: '0',
          display: 'flex', alignItems: 'center', gap: '8px' 
        }}
      >
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '600', color: '#ededed' }}>
          {userProfile.avatar_url ? (
            <img src={userProfile.avatar_url} alt={displayName} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
          ) : initial}
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{ 
          position: 'absolute', top: 'calc(100% + 8px)', right: 0, minWidth: '240px', 
          background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', 
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 100, padding: '4px',
          animation: 'fadeIn 0.15s ease-out'
        }}>
          
          {/* Header */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #2a2a2a', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontWeight: '500', color: '#ededed', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {displayName}
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <RoleBadge role={userProfile.role} />
            </div>
          </div>

          <div style={{ padding: '4px 0' }}>
            <button onClick={() => { setOpen(false); onSelectMenu('my_profile') }} className="user-menu-item">
              👤 My Profile
            </button>
            <button onClick={() => { setOpen(false); onSelectMenu('settings') }} className="user-menu-item">
              ⚙️ Settings
            </button>
            <button onClick={() => { setOpen(false); onSelectMenu('activity') }} className="user-menu-item">
              📈 Activity
            </button>
            <button onClick={() => { setOpen(false) }} className="user-menu-item" style={{ color: '#a0a0a0' }} disabled>
              🔔 Notifications <span style={{ fontSize: '10px', marginLeft: 'auto', background: '#333', padding: '2px 6px', borderRadius: '4px' }}>Soon</span>
            </button>
          </div>

          <div style={{ borderTop: '1px solid #2a2a2a', padding: '4px 0' }}>
            <button onClick={onLogout} className="user-menu-item" style={{ color: '#f87171' }}>
              🚪 Sign Out
            </button>
          </div>

        </div>
      )}
    </div>
  )
}
