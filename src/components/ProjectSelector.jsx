import { useState, useRef, useEffect } from 'react'

export default function ProjectSelector({ role, projects, activeProject, onChangeProject, onEditProject, onDeleteProject, onNewProject }) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (!activeProject) return null

  if (role === 'viewer') {
    return (
      <div style={{ marginLeft: '12px', padding: '4px 10px', background: '#242424', borderRadius: '6px', border: '0.5px solid #2a2a2a', fontSize: '12px', color: '#ededed' }}>
        {activeProject.name}
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', marginLeft: '12px' }} ref={dropdownRef}>
      <button 
        onClick={() => setOpen(!open)}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: '#1a1a1a', border: '0.5px solid #2a2a2a', borderRadius: '6px', color: '#ededed', fontSize: '13px', cursor: 'pointer' }}
      >
        <span style={{ fontWeight: '500', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {activeProject.name}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
      </button>

      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, minWidth: '220px', background: '#1a1a1a', border: '0.5px solid #333', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', zIndex: 100, padding: '4px' }}>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {projects.map(p => (
              <div 
                key={p.id} 
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', borderRadius: '4px', background: p.id === activeProject.id ? '#2a2a2a' : 'transparent', cursor: 'pointer' }}
                onClick={() => { onChangeProject(p); setOpen(false) }}
              >
                <div 
                  style={{ flex: 1, fontSize: '13px', color: p.id === activeProject.id ? '#3ecf8e' : '#ededed', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {p.name}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={(e) => { e.stopPropagation(); onEditProject(p); setOpen(false) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', padding: '2px', opacity: 0.7 }} title="Edit Project">✏️</button>
                  <button onClick={(e) => { e.stopPropagation(); onDeleteProject(p); setOpen(false) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', padding: '2px', opacity: 0.7 }} title="Delete Project">🗑️</button>
                </div>
              </div>
            ))}
          </div>
          <div style={{ height: '0.5px', background: '#2a2a2a', margin: '4px 0' }} />
          <button 
            onClick={() => { onNewProject(); setOpen(false) }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', background: 'transparent', border: 'none', color: '#a0a0a0', fontSize: '13px', cursor: 'pointer', borderRadius: '4px' }}
          >
            ➕ New Project
          </button>
        </div>
      )}
    </div>
  )
}
