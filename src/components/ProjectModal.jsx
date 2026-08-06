import { useState, useEffect } from 'react'

const AVAILABLE_CHANNELS = [
  { id: 'call', label: 'Call', icon: '📞' },
  { id: 'gmail', label: 'Gmail', icon: '✉️' },
  { id: 'linkedin', label: 'LinkedIn', icon: '💼' },
  { id: 'instagram', label: 'Instagram', icon: '📸' },
  { id: 'whatsapp', label: 'WhatsApp', icon: '💬' },
  { id: 'other', label: 'Other', icon: '🌐' },
]

export default function ProjectModal({ project, onClose, onSave }) {
  const [name, setName] = useState(() => project ? project.name || '' : '')
  const [description, setDescription] = useState(() => project ? project.description || '' : '')
  const [defaultChannels, setDefaultChannels] = useState(() => 
    project?.default_channels && Array.isArray(project.default_channels) && project.default_channels.length > 0
      ? project.default_channels
      : ['call', 'gmail', 'linkedin']
  )

  useEffect(() => {
    if (project) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(project.name || '')
      setDescription(project.description || '')
      setDefaultChannels(
        project.default_channels && Array.isArray(project.default_channels) && project.default_channels.length > 0
          ? project.default_channels
          : ['call', 'gmail', 'linkedin']
      )
    }
  }, [project])

  const toggleChannel = (channelId) => {
    if (defaultChannels.includes(channelId)) {
      if (defaultChannels.length === 1) return // Keep at least one default channel selected
      setDefaultChannels(defaultChannels.filter(c => c !== channelId))
    } else {
      setDefaultChannels([...defaultChannels, channelId])
    }
  }

  const handleSave = () => {
    if (!name.trim()) { alert('Project name is required'); return }
    onSave({ 
      name: name.trim(), 
      description: description.trim(),
      default_channels: defaultChannels
    })
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: '460px' }}>
        <div className="modal-header">
          <span style={{ fontSize: '14px', fontWeight: '600', color: '#ededed' }}>
            {project ? 'Edit Project' : 'New Project'}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8a8a85', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>×</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group">
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: '600', color: '#ededed' }}>
              Project Name <span style={{ color: '#f87171' }}>*</span>
            </label>
            <input className="input-base" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Real Estate Leads" autoFocus />
          </div>
          
          <div className="form-group">
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: '600', color: '#ededed' }}>
              Description (Optional)
            </label>
            <textarea className="input-base" value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description of this sector..." rows={2} />
          </div>

          <div className="form-group">
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '600', color: '#ededed' }}>
              Default Outreach Channels
            </label>
            <span style={{ display: 'block', fontSize: '11px', color: '#8a8a85', marginBottom: '10px' }}>
              Select channels prioritized for follow-up sequencing in this project.
            </span>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              {AVAILABLE_CHANNELS.map(ch => {
                const isSelected = defaultChannels.includes(ch.id)
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => toggleChannel(ch.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '500',
                      border: isSelected ? '1.5px solid #3ecf8e' : '1px solid rgba(255,255,255,0.08)',
                      background: isSelected ? 'rgba(62, 207, 142, 0.12)' : '#151518',
                      color: isSelected ? '#3ecf8e' : '#8a8a85',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>{ch.icon}</span>
                    <span>{ch.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} style={{ background: '#3ecf8e', color: '#000', fontWeight: '600' }}>Save Project</button>
        </div>
      </div>
    </div>
  )
}
