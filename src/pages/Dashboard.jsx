import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import StatsBar from '../components/StatsBar'
import Toolbar from '../components/Toolbar'
import LeadsTable from '../components/LeadsTable'
import LeadModal from '../components/LeadModal'
import ColManager from '../components/ColManager'
import ImportModal from '../components/ImportModal'
import ProjectSelector from '../components/ProjectSelector'
import ProjectModal from '../components/ProjectModal'

export default function Dashboard({ role, onLogout }) {
  const [projects, setProjects] = useState([])
  const [activeProject, setActiveProject] = useState(null)
  const [projectModalOpen, setProjectModalOpen] = useState(false)
  const [editingProject, setEditingProject] = useState(null)

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
    fetchCustomColumns()
    fetchProjects()
  }, [])

  async function fetchProjects() {
    setLoading(true)
    const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: true })
    if (data && data.length > 0) {
      setProjects(data)
      const lastId = localStorage.getItem('mrdevs_last_project')
      const active = data.find(p => p.id === lastId) || data[0]
      setActiveProject(active)
    } else {
      setProjects([])
      setActiveProject(null)
      setLoading(false)
    }
  }

  useEffect(() => {
    if (activeProject) {
      localStorage.setItem('mrdevs_last_project', activeProject.id)
      fetchLeads()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProject])

  async function fetchCustomColumns() {
    const { data } = await supabase.from('custom_columns').select('*').order('created_at', { ascending: true })
    if (data) setCustomColumns(data)
  }

  function handleFileChange(e) {
    const file = e.target.files[0]
    if (file) {
      setImportFile(file)
      e.target.value = ''
    }
  }

  async function fetchLeads() {
    if (!activeProject) return
    setLoading(true)
    const { data, error } = await supabase.from('leads').select('*').eq('project_id', activeProject.id)
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

  useEffect(() => {
    leadsRef.current = leads
  }, [leads])



  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const updateLeads = (newLeads) => {
    setLeads(newLeads)
    leadsRef.current = newLeads
  }

  const pushHistory = () => {
    historyRef.current = [...historyRef.current, [...leadsRef.current]]
    futureRef.current = []
  }

  async function undo() {
    if (historyRef.current.length === 0) { showToast('Nothing to undo'); return }
    const prev = historyRef.current[historyRef.current.length - 1]
    futureRef.current = [leadsRef.current, ...futureRef.current]
    historyRef.current = historyRef.current.slice(0, -1)
    updateLeads(prev)
    await syncToSupabase(prev)
    showToast('Undo done')
  }

  async function redo() {
    if (futureRef.current.length === 0) { showToast('Nothing to redo'); return }
    const next = futureRef.current[0]
    historyRef.current = [...historyRef.current, leadsRef.current]
    futureRef.current = futureRef.current.slice(1)
    updateLeads(next)
    await syncToSupabase(next)
    showToast('Redo done')
  }

  useEffect(() => {
    const handleKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo() }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function syncToSupabase(newLeads) {
    if (!activeProject) return
    await supabase.from('leads').delete().eq('project_id', activeProject.id)
    if (newLeads.length > 0) {
      await supabase.from('leads').insert(newLeads.map(lead => {
        const rest = { ...lead }
        delete rest.id
        return { ...rest, project_id: activeProject.id }
      }))
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
    if (!activeProject) return
    pushHistory()
    const updatedLeads = editingLead
      ? leadsRef.current.map(l => l.id === editingLead.id ? { ...l, ...form } : l)
      : [...leadsRef.current, { ...form, project_id: activeProject.id }]
    updateLeads(updatedLeads)
    if (editingLead) {
      await supabase.from('leads').update(form).eq('id', editingLead.id)
    } else {
      await supabase.from('leads').insert([{ ...form, project_id: activeProject.id }])
    }
    setModalOpen(false)
    showToast(editingLead ? 'Lead updated' : 'Lead added')
  }

  const handleDelete = async (lead) => {
    if (!confirm(`Delete ${lead.hospital_name}?`)) return
    pushHistory()
    const updatedLeads = leadsRef.current.filter(l => l.id !== lead.id)
    updateLeads(updatedLeads)
    await supabase.from('leads').delete().eq('id', lead.id)
    showToast('Lead deleted')
  }

  const handleSaveProject = async (form) => {
    if (editingProject) {
      const { data, error } = await supabase.from('projects').update(form).eq('id', editingProject.id).select().single()
      if (!error && data) {
        setProjects(projects.map(p => p.id === data.id ? data : p))
        if (activeProject?.id === data.id) setActiveProject(data)
        showToast('Project updated')
      }
    } else {
      const { data, error } = await supabase.from('projects').insert([form]).select().single()
      if (!error && data) {
        setProjects([...projects, data])
        setActiveProject(data)
        showToast('Project created')
      }
    }
    setProjectModalOpen(false)
  }

  const handleDeleteProject = async (project) => {
    if (!confirm(`Are you sure you want to delete the project "${project.name}" and all its leads?`)) return
    const { error } = await supabase.from('projects').delete().eq('id', project.id)
    if (!error) {
      const remaining = projects.filter(p => p.id !== project.id)
      setProjects(remaining)
      if (activeProject?.id === project.id) {
        setActiveProject(remaining.length > 0 ? remaining[0] : null)
      }
      showToast('Project deleted')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f' }}>

      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: '#1a1a1a', border: '0.5px solid #3ecf8e', borderRadius: '8px', padding: '10px 20px', color: '#3ecf8e', fontSize: '13px', zIndex: 999 }}>
          {toast}
        </div>
      )}

      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: '15px', fontWeight: '600', color: '#ededed', letterSpacing: '-0.5px' }}>
            MR<span style={{ color: '#3ecf8e' }}>.</span>DEVS
          </span>
          <ProjectSelector 
            role={role}
            projects={projects}
            activeProject={activeProject}
            onChangeProject={setActiveProject}
            onEditProject={(p) => { setEditingProject(p); setProjectModalOpen(true) }}
            onDeleteProject={handleDeleteProject}
            onNewProject={() => { setEditingProject(null); setProjectModalOpen(true) }}
          />
          {role === 'viewer' && (
            <span className="badge badge-gray" style={{ marginLeft: '12px' }}>👁️ View Only</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {role !== 'viewer' && projects.length > 0 && (
            <>
              <button onClick={undo} style={{ background: 'none', border: '0.5px solid #2a2a2a', borderRadius: '6px', color: '#a0a0a0', cursor: 'pointer', padding: '5px 10px', fontSize: '13px' }}>
                ↩ Undo
              </button>
              <button onClick={redo} style={{ background: 'none', border: '0.5px solid #2a2a2a', borderRadius: '6px', color: '#a0a0a0', cursor: 'pointer', padding: '5px 10px', fontSize: '13px' }}>
                ↪ Redo
              </button>
            </>
          )}
          {projects.length > 0 && (
            <span style={{ fontSize: '12px', color: '#555' }}>{filteredLeads.length} leads</span>
          )}
          <button onClick={onLogout} style={{ background: 'none', border: 'none', color: '#a0a0a0', cursor: 'pointer', fontSize: '13px' }}>Sign out</button>
        </div>
      </div>

      {projects.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 56px)', gap: '16px' }}>
          <div style={{ fontSize: '18px', color: '#ededed', fontWeight: '500' }}>Create your first project to get started</div>
          {role !== 'viewer' ? (
            <button className="btn-primary" onClick={() => { setEditingProject(null); setProjectModalOpen(true) }}>+ New Project</button>
          ) : (
            <div style={{ color: '#555', fontSize: '13px' }}>No projects exist yet. Ask an admin to create one.</div>
          )}
        </div>
      ) : (
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
      )}

      {modalOpen && <LeadModal lead={editingLead} customColumns={customColumns} onClose={() => setModalOpen(false)} onSave={handleSave} />}
      {colManagerOpen && <ColManager onClose={() => setColManagerOpen(false)} onCustomColumnsChange={setCustomColumns} />}
      {projectModalOpen && <ProjectModal project={editingProject} onClose={() => setProjectModalOpen(false)} onSave={handleSaveProject} />}
      {importFile && activeProject && (
        <ImportModal 
          file={importFile} 
          activeProject={activeProject}
          customColumns={customColumns} 
          onRefreshCustomColumns={fetchCustomColumns}
          onClose={() => setImportFile(null)} 
          onSuccess={async (count, skipped = 0) => {
            setImportFile(null)
            const msg = skipped > 0 
              ? `${count} imported, ${skipped} skipped (missing hospital name)`
              : `${count} leads imported successfully`
            showToast(msg)
            await fetchLeads()
          }} 
        />
      )}
    </div>
  )
}