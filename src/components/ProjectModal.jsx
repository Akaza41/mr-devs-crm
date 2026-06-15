import { useState, useEffect } from 'react'

export default function ProjectModal({ project, onClose, onSave }) {
  const [name, setName] = useState(() => project ? project.name || '' : '')
  const [description, setDescription] = useState(() => project ? project.description || '' : '')

  useEffect(() => {
    if (project) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(project.name || '')
      setDescription(project.description || '')
    }
  }, [project])

  const handleSave = () => {
    if (!name.trim()) { alert('Project name is required'); return }
    onSave({ name: name.trim(), description: description.trim() })
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: '400px' }}>
        <div className="modal-header">
          <span style={{ fontSize: '13px', fontWeight: '500', color: '#ededed' }}>{project ? 'Edit Project' : 'New Project'}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>×</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', gridTemplateColumns: '1fr' }}>
          <div className="form-group">
            <label>Project Name</label>
            <input className="input-base" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Real Estate Leads" autoFocus />
          </div>
          <div className="form-group">
            <label>Description (Optional)</label>
            <textarea className="input-base" value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description of this sector..." />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  )
}
