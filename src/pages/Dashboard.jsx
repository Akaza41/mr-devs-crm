import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import StatsBar from '../components/StatsBar'
import Toolbar from '../components/Toolbar'
import LeadsTable from '../components/LeadsTable'
import LeadModal from '../components/LeadModal'
import ColManager from '../components/ColManager'
import ImportModal from '../components/ImportModal'

export default function Dashboard({ role, onLogout }) {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterContacted, setFilterContacted] = useState('')
  const [filterNumber, setFilterNumber] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [colManagerOpen, setColManagerOpen] = useState(false)
  const [importFile, setImportFile] = useState(null)
  const [customColumns, setCustomColumns] = useState([])
  const [editingLead, setEditingLead] = useState(null)
  const [toast, setToast] = useState('')

  const fileInputRef = useRef(null)
  const historyRef = useRef([])
  const futureRef = useRef([])
  const leadsRef = useRef([])

  useEffect(() => { 
    fetchLeads() 
    fetchCustomColumns()
  }, [])

  const fetchCustomColumns = async () => {
    const { data } = await supabase.from('custom_columns').select('*').order('created_at', { ascending: true })
    if (data) setCustomColumns(data)
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setImportFile(file)
      e.target.value = ''
    }
  }

  useEffect(() => {
    leadsRef.current = leads
  }, [leads])

  useEffect(() => {
    const handleKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo() }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const fetchLeads = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('leads').select('*')
    if (!error) {
      const order = { High: 0, Medium: 1, Low: 2 }
      const sorted = data.sort((a, b) => {
        if (order[a.priority] !== order[b.priority]) return order[a.priority] - order[b.priority]
        return (b.rating || 0) - (a.rating || 0)
      })
      setLeads(sorted)
      leadsRef.current = sorted
      historyRef.current = []
      futureRef.current = []
    }
    setLoading(false)
  }

  const updateLeads = (newLeads) => {
    setLeads(newLeads)
    leadsRef.current = newLeads
  }

  const pushHistory = () => {
    historyRef.current = [...historyRef.current, [...leadsRef.current]]
    futureRef.current = []
  }

  const undo = async () => {
    if (historyRef.current.length === 0) { showToast('Nothing to undo'); return }
    const prev = historyRef.current[historyRef.current.length - 1]
    futureRef.current = [leadsRef.current, ...futureRef.current]
    historyRef.current = historyRef.current.slice(0, -1)
    updateLeads(prev)
    await syncToSupabase(prev)
    showToast('Undo done')
  }

  const redo = async () => {
    if (futureRef.current.length === 0) { showToast('Nothing to redo'); return }
    const next = futureRef.current[0]
    historyRef.current = [...historyRef.current, leadsRef.current]
    futureRef.current = futureRef.current.slice(1)
    updateLeads(next)
    await syncToSupabase(next)
    showToast('Redo done')
  }

  const syncToSupabase = async (newLeads) => {
    await supabase.from('leads').delete().neq('hospital_name', '')
    if (newLeads.length > 0) {
      await supabase.from('leads').insert(newLeads.map(({ id, ...rest }) => rest))
    }
  }

  const filteredLeads = leads.filter(l => {
    const q = search.toLowerCase()
    const matchSearch = !q || (l.hospital_name || '').toLowerCase().includes(q) || (l.phone || '').toLowerCase().includes(q) || (l.notes || '').toLowerCase().includes(q)
    const matchPriority = !filterPriority || l.priority === filterPriority
    const matchContacted = !filterContacted || l.contacted === filterContacted
    const matchNumber = !filterNumber || l.number_type === filterNumber
    return matchSearch && matchPriority && matchContacted && matchNumber
  })

  const handleSave = async (form) => {
    pushHistory()
    const updatedLeads = editingLead
      ? leadsRef.current.map(l => l.hospital_name === editingLead.hospital_name ? { ...l, ...form } : l)
      : [...leadsRef.current, form]
    updateLeads(updatedLeads)
    if (editingLead) {
      await supabase.from('leads').update(form).eq('hospital_name', editingLead.hospital_name)
    } else {
      await supabase.from('leads').insert([form])
    }
    setModalOpen(false)
    showToast(editingLead ? 'Lead updated' : 'Lead added')
  }

  const handleDelete = async (lead) => {
    if (!confirm(`Delete ${lead.hospital_name}?`)) return
    pushHistory()
    const updatedLeads = leadsRef.current.filter(l => l.hospital_name !== lead.hospital_name)
    updateLeads(updatedLeads)
    await supabase.from('leads').delete().eq('hospital_name', lead.hospital_name)
    showToast('Lead deleted')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f' }}>

      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: '#1a1a1a', border: '0.5px solid #3ecf8e', borderRadius: '8px', padding: '10px 20px', color: '#3ecf8e', fontSize: '13px', zIndex: 999 }}>
          {toast}
        </div>
      )}

      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '15px', fontWeight: '600', color: '#ededed', letterSpacing: '-0.5px' }}>
            MR<span style={{ color: '#3ecf8e' }}>.</span>DEVS
          </span>
          <span style={{ fontSize: '12px', color: '#555' }}>Lead CRM</span>
          {role === 'viewer' && (
            <span className="badge badge-gray" style={{ marginLeft: '4px' }}>👁️ View Only</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {role !== 'viewer' && (
            <>
              <button onClick={undo} style={{ background: 'none', border: '0.5px solid #2a2a2a', borderRadius: '6px', color: '#a0a0a0', cursor: 'pointer', padding: '5px 10px', fontSize: '13px' }}>
                ↩ Undo
              </button>
              <button onClick={redo} style={{ background: 'none', border: '0.5px solid #2a2a2a', borderRadius: '6px', color: '#a0a0a0', cursor: 'pointer', padding: '5px 10px', fontSize: '13px' }}>
                ↪ Redo
              </button>
            </>
          )}
          <span style={{ fontSize: '12px', color: '#555' }}>{filteredLeads.length} leads</span>
          <button onClick={onLogout} style={{ background: 'none', border: 'none', color: '#a0a0a0', cursor: 'pointer', fontSize: '13px' }}>Sign out</button>
        </div>
      </div>

      <div style={{ padding: '24px' }}>
        <StatsBar leads={leads} />
        <Toolbar
          role={role}
          search={search} setSearch={setSearch}
          filterPriority={filterPriority} setFilterPriority={setFilterPriority}
          filterContacted={filterContacted} setFilterContacted={setFilterContacted}
          filterNumber={filterNumber} setFilterNumber={setFilterNumber}
          onAddLead={() => { setEditingLead(null); setModalOpen(true) }}
          onManageColumns={() => setColManagerOpen(true)}
          onImportClick={() => fileInputRef?.current?.click()}
        />
        <input type="file" accept=".xlsx,.csv" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#555', fontSize: '13px' }}>Loading leads...</div>
        ) : (
          <LeadsTable role={role} leads={filteredLeads} customColumns={customColumns} onEdit={l => { setEditingLead(l); setModalOpen(true) }} onDelete={handleDelete} />
        )}
      </div>

      {modalOpen && <LeadModal lead={editingLead} customColumns={customColumns} onClose={() => setModalOpen(false)} onSave={handleSave} />}
      {colManagerOpen && <ColManager onClose={() => setColManagerOpen(false)} onCustomColumnsChange={setCustomColumns} />}
      {importFile && (
        <ImportModal 
          file={importFile} 
          customColumns={customColumns} 
          onClose={() => setImportFile(null)} 
          onSuccess={async (count) => {
            setImportFile(null)
            showToast(`${count} leads imported successfully`)
            await fetchLeads()
          }} 
        />
      )}
    </div>
  )
}