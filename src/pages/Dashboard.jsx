import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import StatsBar from '../components/StatsBar'
import Toolbar from '../components/Toolbar'
import LeadsTable from '../components/LeadsTable'
import LeadModal from '../components/LeadModal'

export default function Dashboard({ onLogout }) {
  const [leads, setLeads] = useState([])
  const [history, setHistory] = useState([])
  const [future, setFuture] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterContacted, setFilterContacted] = useState('')
  const [filterNumber, setFilterNumber] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingLead, setEditingLead] = useState(null)
  const [toast, setToast] = useState('')

  useEffect(() => { fetchLeads() }, [])

  useEffect(() => {
    const handleKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo() }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [history, future, leads])

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
      setHistory([])
      setFuture([])
    }
    setLoading(false)
  }

  const pushHistory = (prevLeads) => {
    setHistory(h => [...h, prevLeads])
    setFuture([])
  }

  const undo = useCallback(async () => {
    if (history.length === 0) return
    const prev = history[history.length - 1]
    setFuture(f => [leads, ...f])
    setHistory(h => h.slice(0, -1))
    setLeads(prev)
    await syncToSupabase(prev)
    showToast('Undo done')
  }, [history, leads])

  const redo = useCallback(async () => {
    if (future.length === 0) return
    const next = future[0]
    setHistory(h => [...h, leads])
    setFuture(f => f.slice(1))
    setLeads(next)
    await syncToSupabase(next)
    showToast('Redo done')
  }, [future, leads])

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
    pushHistory(leads)
    if (editingLead) {
      await supabase.from('leads').update(form).eq('hospital_name', editingLead.hospital_name)
    } else {
      await supabase.from('leads').insert([form])
    }
    setModalOpen(false)
    fetchLeads()
    showToast(editingLead ? 'Lead updated' : 'Lead added')
  }

  const handleDelete = async (lead) => {
    if (!confirm(`Delete ${lead.hospital_name}?`)) return
    pushHistory(leads)
    await supabase.from('leads').delete().eq('hospital_name', lead.hospital_name)
    fetchLeads()
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
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={undo}
            disabled={history.length === 0}
            title="Undo (Ctrl+Z)"
            style={{ background: 'none', border: '0.5px solid #2a2a2a', borderRadius: '6px', color: history.length === 0 ? '#333' : '#a0a0a0', cursor: history.length === 0 ? 'not-allowed' : 'pointer', padding: '5px 10px', fontSize: '13px' }}
          >
            ↩ Undo
          </button>
          <button
            onClick={redo}
            disabled={future.length === 0}
            title="Redo (Ctrl+Y)"
            style={{ background: 'none', border: '0.5px solid #2a2a2a', borderRadius: '6px', color: future.length === 0 ? '#333' : '#a0a0a0', cursor: future.length === 0 ? 'not-allowed' : 'pointer', padding: '5px 10px', fontSize: '13px' }}
          >
            ↪ Redo
          </button>
          <span style={{ fontSize: '12px', color: '#555' }}>{filteredLeads.length} leads</span>
          <button onClick={onLogout} style={{ background: 'none', border: 'none', color: '#a0a0a0', cursor: 'pointer', fontSize: '13px' }}>Sign out</button>
        </div>
      </div>

      <div style={{ padding: '24px' }}>
        <StatsBar leads={leads} />
        <Toolbar
          search={search} setSearch={setSearch}
          filterPriority={filterPriority} setFilterPriority={setFilterPriority}
          filterContacted={filterContacted} setFilterContacted={setFilterContacted}
          filterNumber={filterNumber} setFilterNumber={setFilterNumber}
          onAddLead={() => { setEditingLead(null); setModalOpen(true) }}
        />
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#555', fontSize: '13px' }}>Loading leads...</div>
        ) : (
          <LeadsTable leads={filteredLeads} onEdit={l => { setEditingLead(l); setModalOpen(true) }} onDelete={handleDelete} />
        )}
      </div>

      {modalOpen && <LeadModal lead={editingLead} onClose={() => setModalOpen(false)} onSave={handleSave} />}
    </div>
  )
}