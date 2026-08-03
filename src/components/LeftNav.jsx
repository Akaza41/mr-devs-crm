import React, { useState } from 'react'
import ProjectSelector from './ProjectSelector'
import UserMenu from './UserMenu'
import { canAccessTeam, canManageInvites, isReadOnly } from '../lib/permissions'

export default function LeftNav({
  userProfile,
  role,
  currentView = 'leads',
  onNavigate,
  onLogout,
  projects = [],
  activeProject = null,
  onChangeProject,
  onEditProject,
  onDeleteProject,
  onNewProject,
  onGoBack,
  canGoBack = false
}) {
  const [mobileOpen, setMobileOpen] = useState(false)

  const showTeamTab = canAccessTeam(role)
  const showAddUserTab = canManageInvites(role)

  const navItems = [
    { key: 'leads', label: 'Leads Pipeline', icon: '📊', visible: true },
    { key: 'leaderboard', label: 'Leaderboard', icon: '🏆', visible: true },
    { key: 'chat', label: 'Team Chat', icon: '💬', visible: true, badge: '💬' },
    { key: 'team', label: 'Team Directory', icon: '👥', visible: showTeamTab },
    { key: 'add_user', label: 'Add User & Invites', icon: '➕', visible: showAddUserTab },
    { key: 'settings', label: 'Settings', icon: '⚙️', visible: true },
  ]

  const handleNavClick = (key) => {
    onNavigate(key)
    setMobileOpen(false)
  }

  return (
    <>
      {/* Mobile Header Bar */}
      <div className="md:hidden" style={{ background: '#161616', borderBottom: '0.5px solid #232323', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 45 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            style={{ background: 'none', border: 'none', color: '#f5f5f0', fontSize: '18px', cursor: 'pointer' }}
          >
            ☰
          </button>
          <span className="font-headline" style={{ fontWeight: '700', fontSize: '15px', color: '#f5f5f0' }}>MR.DEVS CRM</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {canGoBack && (
            <button onClick={onGoBack} style={{ background: '#232323', border: '0.5px solid #333', color: '#f5f5f0', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>
              ← Back
            </button>
          )}
          <UserMenu userProfile={userProfile} onLogout={onLogout} onSelectMenu={(v) => onNavigate(v === 'my_profile' ? 'employee_profile' : v)} />
        </div>
      </div>

      {/* Sidebar Container */}
      <aside
        style={{
          width: '240px',
          height: '100vh',
          position: 'sticky',
          top: 0,
          background: '#161616',
          borderRight: '0.5px solid #232323',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 40,
          flexShrink: 0
        }}
        className={`${mobileOpen ? 'block' : 'hidden'} md:flex`}
      >
        {/* Brand Logo & Project Selector Header */}
        <div style={{ padding: '18px 20px', borderBottom: '0.5px solid #232323', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div
              className="font-headline"
              onClick={() => handleNavClick('leads')}
              style={{ fontWeight: '800', fontSize: '16px', color: '#f5f5f0', letterSpacing: '0.04em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: '#3ecf8e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontSize: '12px', fontWeight: 'bold' }}>
                M
              </div>
              MR.DEVS CRM
            </div>

            {canGoBack && (
              <button
                onClick={onGoBack}
                style={{
                  background: '#232323',
                  border: '0.5px solid #333',
                  borderRadius: '6px',
                  color: '#f5f5f0',
                  padding: '2px 8px',
                  fontSize: '11px',
                  cursor: 'pointer'
                }}
                title="Go back"
              >
                ← Back
              </button>
            )}
          </div>

          <ProjectSelector
            role={role}
            projects={projects}
            activeProject={activeProject}
            onChangeProject={onChangeProject}
            onEditProject={onEditProject}
            onDeleteProject={onDeleteProject}
            onNewProject={onNewProject}
          />

          {isReadOnly(role) && (
            <span className="badge badge-gray" style={{ alignSelf: 'flex-start' }}>👁️ View Only</span>
          )}
        </div>

        {/* Navigation Items List */}
        <nav style={{ flex: 1, padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navItems.filter(item => item.visible).map(item => {
            const isActive = currentView === item.key || (item.key === 'team' && currentView === 'employee_profile')

            return (
              <button
                key={item.key}
                onClick={() => handleNavClick(item.key)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: isActive ? '#232323' : 'transparent',
                  border: 'none',
                  borderLeft: isActive ? '3px solid #3ecf8e' : '3px solid transparent',
                  padding: '10px 20px',
                  color: isActive ? '#f5f5f0' : '#8a8a85',
                  fontSize: '13px',
                  fontWeight: isActive ? '600' : '400',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'all 0.15s ease'
                }}
                onMouseOver={e => !isActive && (e.currentTarget.style.background = '#1a1a1a')}
                onMouseOut={e => !isActive && (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ fontSize: '15px' }}>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge && (
                  <span style={{ fontSize: '10px', background: 'rgba(62,207,142,0.15)', color: '#3ecf8e', padding: '1px 6px', borderRadius: '10px' }}>
                    {item.badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Footer User Info */}
        <div style={{ padding: '16px 20px', borderTop: '0.5px solid #232323', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <UserMenu
            userProfile={userProfile}
            onLogout={onLogout}
            onSelectMenu={(v) => handleNavClick(v === 'my_profile' ? 'employee_profile' : v)}
          />
          <span style={{ fontSize: '11px', color: '#555', textTransform: 'capitalize' }}>
            {role || 'User'}
          </span>
        </div>
      </aside>
    </>
  )
}
