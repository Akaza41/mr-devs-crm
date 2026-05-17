import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import StatsBar from '../components/StatsBar'
import Toolbar from '../components/Toolbar'
import LeadsTable from '../components/LeadsTable'
import LeadModal from '../components/LeadModal'

export default function Dashboard({ onLogout }) {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterContacted, setFilterContacted] = useState('')
  const [filterNumber, setFilterNumber] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingLead, setEditingLead] = useState(null)

  useEffect(() => { fetchLeads() }, [])

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
    }
    setLoading(false)
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
    if (editingLead) {
      await supabase.from('leads').update(form).eq('hospital_name', editingLead.hospital_name)
    } else {
      await supabase.from('leads').insert([form])
    }
    setModalOpen(false)
    fetchLeads()
  }

  const handleDelete = async (lead) => {
    if (!confirm(`Delete ${lead.hospital_name}?`)) return
    await supabase.from('leads').delete().eq('hospital_name', lead.hospital_name)
    fetchLeads()
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f' }}>
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '15px', fontWeight: '600', color: '#ededed', letterSpacing: '-0.5px' }}>
            MR<span style={{ color: '#3ecf8e' }}>.</span>DEVS
          </span>
          <span style={{ fontSize: '12px', color: '#555' }}>Lead CRM</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
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