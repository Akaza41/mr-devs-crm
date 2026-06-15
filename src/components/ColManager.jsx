import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function ColManager({ onClose, onCustomColumnsChange }) {
  const [columns, setColumns] = useState([])
  const [newColName, setNewColName] = useState('')
  const [newColType, setNewColType] = useState('Text')
  const [loading, setLoading] = useState(false)

  async function fetchColumns() {
    const { data } = await supabase.from('custom_columns').select('*').order('created_at', { ascending: true })
    if (data) setColumns(data)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchColumns()
  }, [])

  const handleAdd = async () => {
    if (!newColName.trim()) return
    const key = newColName.toLowerCase().replace(/[^a-z0-9]/g, '_')
    if (columns.find(c => c.column_name === key)) {
      alert('Column already exists')
      return
    }
    
    setLoading(true)
    
    const { error: rpcError } = await supabase.rpc('add_custom_column', {
      col_name: key,
      col_type: newColType === 'Number' ? 'numeric' : newColType === 'Date' ? 'date' : 'text'
    })
    
    if (rpcError) {
      alert('Error adding column: ' + rpcError.message)
      setLoading(false)
      return
    }

    const newCol = {
      column_name: key,
      display_name: newColName.trim(),
      data_type: newColType
    }
    
    const { data, error } = await supabase.from('custom_columns').insert([newCol]).select().single()
    if (!error && data) {
      const updated = [...columns, data]
      setColumns(updated)
      setNewColName('')
      setNewColType('Text')
      if (onCustomColumnsChange) onCustomColumnsChange(updated)
    }
    setLoading(false)
  }

  const handleDelete = async (col) => {
    if (!confirm(`Delete column "${col.display_name}"? This will drop the data for this column!`)) return
    setLoading(true)
    
    const { error: rpcError } = await supabase.rpc('delete_custom_column', {
      col_name: col.column_name
    })

    if (rpcError) {
      alert('Error deleting column: ' + rpcError.message)
      setLoading(false)
      return
    }

    const { error } = await supabase.from('custom_columns').delete().eq('id', col.id)
    if (!error) {
      const updated = columns.filter(c => c.id !== col.id)
      setColumns(updated)
      if (onCustomColumnsChange) onCustomColumnsChange(updated)
    }
    setLoading(false)
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: '500px' }}>
        <div className="modal-header">
          <span style={{ fontSize: '13px', fontWeight: '500', color: '#ededed' }}>Manage Custom Columns</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>×</button>
        </div>
        
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '11px', color: '#a0a0a0', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Existing Custom Columns</div>
            {columns.length === 0 ? (
              <div style={{ fontSize: '13px', color: '#555' }}>No custom columns added yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {columns.map(c => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#242424', padding: '8px 12px', borderRadius: '6px', border: '0.5px solid #2a2a2a' }}>
                    <div>
                      <span style={{ fontSize: '13px', color: '#ededed' }}>{c.display_name}</span>
                      <span style={{ fontSize: '11px', color: '#555', marginLeft: '8px' }}>({c.data_type})</span>
                    </div>
                    <button onClick={() => handleDelete(c)} disabled={loading} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '12px' }}>Delete</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ height: '0.5px', background: '#2a2a2a', margin: '8px 0' }} />

          <div>
            <div style={{ fontSize: '11px', color: '#a0a0a0', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Add New Column</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                className="input-base" 
                placeholder="Column Name" 
                value={newColName} 
                onChange={e => setNewColName(e.target.value)}
                style={{ flex: 1 }}
              />
              <select 
                className="input-base" 
                value={newColType} 
                onChange={e => setNewColType(e.target.value)}
                style={{ width: '120px' }}
              >
                <option value="Text">Text</option>
                <option value="Number">Number</option>
                <option value="Date">Date</option>
                <option value="Yes/No">Yes/No</option>
              </select>
              <button className="btn-primary" onClick={handleAdd} disabled={loading || !newColName.trim()} style={{ whiteSpace: 'nowrap' }}>
                Add
              </button>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}
