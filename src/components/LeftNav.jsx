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
  const showAdminUsersTab = canManageInvites(role)

  const navItems = [
    { key: 'leads', label: 'Leads Pipeline', icon: '📊', visible: true },
    { key: 'leaderboard', label: 'Leaderboard', icon: '🏆', visible: true },
    { key: 'chat', label: 'Team Chat', icon: '💬', visible: true, badge: '💬' },
    { key: 'extension_activity', label: 'Extension Activity', icon: '⚡', visible: showAdminUsersTab },
    { key: 'team', label: 'Team Directory', icon: '👥', visible: showTeamTab },
    { key: 'users', label: 'Users & Invites', icon: '👤', visible: showAdminUsersTab },
    { key: 'settings', label: 'Settings', icon: '⚙️', visible: true },
  ]

  const handleNavClick = (key) => {
    onNavigate(key)
    setMobileOpen(false)
  }

  const renderNavContent = () => (
    <>
      {/* Brand Logo & Project Selector Header */}
      <div style={{ padding: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div
            className="font-headline"
            onClick={() => handleNavClick('leads')}
            style={{ fontWeight: '800', fontSize: '16px', color: '#f5f5f0', letterSpacing: '0.04em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
          >
            <div style={{ width: '26px', height: '26px', borderRadius: '7px', background: '#3ecf8e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontSize: '13px', fontWeight: 'bold', boxShadow: '0 2px 8px rgba(62, 207, 142, 0.3)' }}>
              M
            </div>
            MR.DEVS CRM
          </div>

          {canGoBack && (
            <button
              onClick={onGoBack}
              style={{
                background: '#242428',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '6px',
                color: '#f5f5f0',
                padding: '3px 9px',
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
      <nav style={{ flex: 1, padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto' }}>
        {navItems.filter(item => item.visible).map(item => {
          const isActive = currentView === item.key || 
            (item.key === 'team' && currentView === 'employee_profile') ||
            (item.key === 'users' && currentView === 'add_user')

          return (
            <button
              key={item.key}
              onClick={() => handleNavClick(item.key)}
              style={{
                width: '100%',
                textAlign: 'left',
                background: isActive ? '#242428' : 'transparent',
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
              onMouseOver={e => !isActive && (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)')}
              onMouseOut={e => !isActive && (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ fontSize: '15px' }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge && (
                <span style={{ fontSize: '10px', background: 'rgba(62, 207, 142, 0.15)', color: '#3ecf8e', padding: '1px 6px', borderRadius: '10px' }}>
                  {item.badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Footer User Info */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <UserMenu
          userProfile={userProfile}
          onLogout={onLogout}
          onSelectMenu={(v) => handleNavClick(v === 'my_profile' ? 'employee_profile' : v)}
        />
        <span style={{ fontSize: '11px', color: '#8a8a85', textTransform: 'capitalize' }}>
          {role || 'User'}
        </span>
      </div>
    </>
  )

  return (
    <>
      {/* ── MOBILE HEADER BAR (visible only on mobile < md) ── */}
      <div className="flex md:hidden" style={{ background: '#151518', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', padding: '12px 16px', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 45, width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            style={{ background: '#242428', border: '1px solid rgba(255, 255, 255, 0.08)', color: '#f5f5f0', fontSize: '16px', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer' }}
            aria-label="Toggle menu"
          >
            ☰
          </button>
          <span className="font-headline" style={{ fontWeight: '800', fontSize: '15px', color: '#f5f5f0', letterSpacing: '0.03em' }}>MR.DEVS CRM</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {canGoBack && (
            <button onClick={onGoBack} style={{ background: '#242428', border: '1px solid rgba(255, 255, 255, 0.08)', color: '#f5f5f0', padding: '4px 8px', borderRadius: '6px', fontSize: '12px' }}>
              ← Back
            </button>
          )}
          <UserMenu userProfile={userProfile} onLogout={onLogout} onSelectMenu={(v) => onNavigate(v === 'my_profile' ? 'employee_profile' : v)} />
        </div>
      </div>

      {/* ── MOBILE SLIDE-OVER DRAWER OVERLAY (visible only when opened on mobile) ── */}
      {mobileOpen && (
        <div className="md:hidden" style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex' }}>
          {/* Backdrop */}
          <div
            onClick={() => setMobileOpen(false)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(3px)' }}
          />

          {/* Off-canvas Navigation Drawer */}
          <aside style={{ position: 'relative', width: '280px', height: '100%', background: '#151518', borderRight: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column', zIndex: 51, boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)' }}>
            <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 52 }}>
              <button
                onClick={() => setMobileOpen(false)}
                style={{ background: 'none', border: 'none', color: '#8a8a85', fontSize: '18px', cursor: 'pointer', padding: '4px' }}
              >
                ✕
              </button>
            </div>
            {renderNavContent()}
          </aside>
        </div>
      )}

      {/* ── DESKTOP SIDEBAR (visible only on desktop >= md) ── */}
      <aside
        style={{
          width: '240px',
          height: '100vh',
          position: 'sticky',
          top: 0,
          background: '#151518',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          flexDirection: 'column',
          zIndex: 40,
          flexShrink: 0
        }}
        className="hidden md:flex"
      >
        {renderNavContent()}
      </aside>
    </>
  )
}
