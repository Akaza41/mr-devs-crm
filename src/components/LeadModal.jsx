import { useState, useEffect } from 'react'

const FIELDS = [
  { key: 'hospital_name', label: 'Hospital Name', type: 'text', full: true },
  { key: 'type', label: 'Type', type: 'text' },
  { key: 'rating', label: 'Rating', type: 'number' },
  { key: 'reviews', label: 'Reviews', type: 'number' },
  { key: 'phone', label: 'Phone', type: 'text' },
  { key: 'number_type', label: 'Number Type', type: 'select', options: ['Mobile ✅', 'Landline ⚠️', 'No Number'] },
  { key: 'address', label: 'Address', type: 'text', full: true },
  { key: 'has_website', label: 'Has Website', type: 'select', options: ['No', 'Yes'] },
  { key: 'priority', label: 'Priority', type: 'select', options: ['High', 'Medium', 'Low'] },
  { key: 'fb_found', label: 'FB Found', type: 'select', options: ['No', 'Yes'] },
  { key: 'contacted', label: 'Contacted', type: 'select', options: ['No', 'Queued', 'Attempted', 'Yes', 'Not Reachable'] },
  { key: 'reply', label: 'Reply', type: 'select', options: ['', 'Yes', 'No', 'Later'] },
  { key: 'notes', label: 'Notes', type: 'textarea', full: true },
]

export default function LeadModal({ lead, customColumns = [], onClose, onSave }) {
  const [form, setForm] = useState({})

  const dynamicFields = customColumns.map(c => ({
    key: c.column_name,
    label: c.display_name,
    type: c.data_type === 'Yes/No' ? 'select' : c.data_type === 'Number' ? 'number' : c.data_type === 'Date' ? 'date' : 'text',
    options: c.data_type === 'Yes/No' ? ['', 'Yes', 'No'] : undefined
  }))

  const allFields = [...FIELDS, ...dynamicFields]

  useEffect(() => {
    setForm(lead || { has_website: 'No', priority: 'High', fb_found: 'No', contacted: 'No', reply: '' })
  }, [lead])

  const handleSave = () => {
    if (!form.hospital_name) { alert('Hospital name is required'); return }
    onSave(form)
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <span style={{ fontSize: '13px', fontWeight: '500', color: '#ededed' }}>{lead ? 'Edit Lead' : 'Add New Lead'}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>×</button>
        </div>
        <div className="modal-body">
          {allFields.map(f => (
            <div key={f.key} className={`form-group ${f.full ? 'col-span-2' : ''}`}>
              <label>{f.label}</label>
              {f.type === 'textarea' ? (
                <textarea className="input-base" value={form[f.key] || ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
              ) : f.type === 'select' ? (
                <select className="input-base" value={form[f.key] || ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}>
                  {f.options.map(o => <option key={o} value={o}>{o || '—'}</option>)}
                </select>
              ) : (
                <input className="input-base" type={f.type} value={form[f.key] || ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
              )}
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  )
}