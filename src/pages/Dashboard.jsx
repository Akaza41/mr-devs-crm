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
import TeamPage from '../components/TeamPage'
import EmployeeProfilePage from './EmployeeProfilePage'
import UserMenu from '../components/UserMenu'
import SettingsPage from './SettingsPage'
import { canManageProjects, isReadOnly } from '../lib/permissions'
// ── Activity Logging ──
// Import the logger and action constants to record business events without
// scattering raw insert logic across multiple components.
import { logActivity } from '../lib/activityLogger'
import { ACTIONS } from '../lib/activityActions'

export default function Dashboard({ userProfile, role, onLogout }) {
  const [projects, setProjects] = useState([])
  const [activeProject, setActiveProject] = useState(null)
  const [projectModalOpen, setProjectModalOpen] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [currentView, setCurrentView] = useState('leads')
  const [selectedUserId, setSelectedUserId] = useState(null)

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

  const fetchLeads = async (ignoreFlag = { current: false }) => {
    if (!activeProject) return
    setLoading(true)
    const { data, error } = await supabase.from('leads').select('*').eq('project_id', activeProject.id)
    if (!error && !ignoreFlag.current) {
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
    if (!ignoreFlag.current) setLoading(false)
  }

  useEffect(() => {
    const ignoreFlag = { current: false }
    if (activeProject) {
      localStorage.setItem('mrdevs_last_project', activeProject.id)
      fetchLeads(ignoreFlag)
    }
    return () => { ignoreFlag.current = true }
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

  const pushHistory = (action) => {
    historyRef.current = [...historyRef.current, action]
    futureRef.current = []
  }

  async function undo() {
    if (historyRef.current.length === 0) { showToast('Nothing to undo'); return }
    const action = historyRef.current[historyRef.current.length - 1]
    
    futureRef.current = [action, ...futureRef.current]
    historyRef.current = historyRef.current.slice(0, -1)

    // ── Apply the reverse action locally and to Supabase ──
    if (action.type === 'ADD') {
      updateLeads(leadsRef.current.filter(l => l.id !== action.lead.id))
      await supabase.from('leads').delete().eq('id', action.lead.id)
    } else if (action.type === 'DELETE') {
      updateLeads([...leadsRef.current, action.lead])
      await supabase.from('leads').insert([action.lead]) // preserves original id
    } else if (action.type === 'UPDATE') {
      updateLeads(leadsRef.current.map(l => l.id === action.id ? action.before : l))
      await supabase.from('leads').update(action.before).eq('id', action.id)
    }
    
    showToast('Undo done')
  }

  async function redo() {
    if (futureRef.current.length === 0) { showToast('Nothing to redo'); return }
    const action = futureRef.current[0]
    
    historyRef.current = [...historyRef.current, action]
    futureRef.current = futureRef.current.slice(1)

    // ── Re-apply the action locally and to Supabase ──
    if (action.type === 'ADD') {
      updateLeads([...leadsRef.current, action.lead])
      await supabase.from('leads').insert([action.lead])
    } else if (action.type === 'DELETE') {
      updateLeads(leadsRef.current.filter(l => l.id !== action.lead.id))
      await supabase.from('leads').delete().eq('id', action.lead.id)
    } else if (action.type === 'UPDATE') {
      updateLeads(leadsRef.current.map(l => l.id === action.id ? action.after : l))
      await supabase.from('leads').update(action.after).eq('id', action.id)
    }

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
    
    if (editingLead) {
      const { error } = await supabase.from('leads').update(form).eq('id', editingLead.id)
      if (error) {
        showToast('Error updating lead: ' + error.message)
        return
      }

      // ── Action-based history: Track the UPDATE ──
      const before = { ...editingLead }
      const after = { ...editingLead, ...form }
      pushHistory({ type: 'UPDATE', id: editingLead.id, before, after })
      
      const updatedLeads = leadsRef.current.map(l => l.id === editingLead.id ? after : l)
      updateLeads(updatedLeads)
      showToast('Lead updated')

      // ── Log the update event (fire-and-forget, never blocks UI) ──
      logActivity({
        action: ACTIONS.LEAD_UPDATED,
        entityType: 'lead',
        entityId: editingLead.id,
        projectId: activeProject.id,
        metadata: { lead_name: form.hospital_name || editingLead.hospital_name },
      })
    } else {
      // ── Action-based history: Track the ADD ──
      // We must insert first to capture the DB-generated ID before pushing to history
      const { data, error } = await supabase.from('leads').insert([{ ...form, project_id: activeProject.id }]).select().single()
      if (error) {
        showToast('Error adding lead')
        return
      }
      
      pushHistory({ type: 'ADD', lead: data })
      const updatedLeads = [...leadsRef.current, data]
      updateLeads(updatedLeads)
      showToast('Lead added')

      // ── Log the create event (fire-and-forget, never blocks UI) ──
      logActivity({
        action: ACTIONS.LEAD_CREATED,
        entityType: 'lead',
        entityId: data.id,
        projectId: activeProject.id,
        metadata: { lead_name: data.hospital_name },
      })
    }
    setModalOpen(false)
  }

  const handleDelete = async (lead) => {
    if (!window.confirm(`Delete ${lead.hospital_name}?`)) return
    
    const { error } = await supabase.from('leads').delete().eq('id', lead.id)
    
    if (error) {
      showToast('Error deleting lead: ' + error.message)
      return
    }

    // ── Action-based history: Track the DELETE ──
    pushHistory({ type: 'DELETE', lead })
    
    const updatedLeads = leadsRef.current.filter(l => l.id !== lead.id)
    updateLeads(updatedLeads)
    showToast('Lead deleted')

    // ── Log the delete event (fire-and-forget, never blocks UI) ──
    logActivity({
      action: ACTIONS.LEAD_DELETED,
      entityType: 'lead',
      entityId: lead.id,
      projectId: activeProject?.id,
      metadata: { lead_name: lead.hospital_name },
    })
  }

  const handleSaveProject = async (form) => {
    if (editingProject) {
      const { data, error } = await supabase.from('projects').update(form).eq('id', editingProject.id).select().single()
      if (error) {
        showToast('Error updating project: ' + error.message)
        return
      }
      if (data) {
        setProjects(projects.map(p => p.id === data.id ? data : p))
        if (activeProject?.id === data.id) setActiveProject(data)
        showToast('Project updated')

        // ── Log project update (fire-and-forget) ──
        logActivity({
          action: ACTIONS.PROJECT_UPDATED,
          entityType: 'project',
          entityId: data.id,
          metadata: { project_name: data.name },
        })
      }
    } else {
      const { data, error } = await supabase.from('projects').insert([form]).select().single()
      if (error) {
        showToast('Error creating project: ' + error.message)
        return
      }
      if (data) {
        setProjects([...projects, data])
        setActiveProject(data)
        showToast('Project created')

        // ── Log project creation (fire-and-forget) ──
        logActivity({
          action: ACTIONS.PROJECT_CREATED,
          entityType: 'project',
          entityId: data.id,
          metadata: { project_name: data.name },
        })
      }
    }
    setProjectModalOpen(false)
  }

  const handleDeleteProject = async (project) => {
    if (!window.confirm(`Are you sure you want to delete the project "${project.name}" and all its leads?`)) return
    const { error } = await supabase.from('projects').delete().eq('id', project.id)
    if (!error) {
      const remaining = projects.filter(p => p.id !== project.id)
      setProjects(remaining)
      if (activeProject?.id === project.id) {
        setActiveProject(remaining.length > 0 ? remaining[0] : null)
      }
      showToast('Project deleted')

      // ── Log project deletion (fire-and-forget) ──
      logActivity({
        action: ACTIONS.PROJECT_DELETED,
        entityType: 'project',
        entityId: project.id,
        metadata: { project_name: project.name },
      })
    } else {
      showToast('Error deleting project: ' + error.message)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f' }}>

      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: '#1a1a1a', border: '0.5px solid #3ecf8e', borderRadius: '8px', padding: '10px 20px', color: '#3ecf8e', fontSize: '13px', zIndex: 999 }}>
          {toast}
        </div>
      )}

      {/* ── TOP NAV BAR ── */}
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ fontWeight: '600', fontSize: '16px', color: '#ededed', letterSpacing: '0.05em' }}>MR.DEVS CRM</div>
          <ProjectSelector 
            role={role}
            projects={projects}
            activeProject={activeProject}
            onChangeProject={setActiveProject}
            onEditProject={(p) => { setEditingProject(p); setProjectModalOpen(true) }}
            onDeleteProject={handleDeleteProject}
            onNewProject={() => { setEditingProject(null); setProjectModalOpen(true) }}
          />
          {isReadOnly(role) && (
            <span className="badge badge-gray" style={{ marginLeft: '12px' }}>👁️ View Only</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {!isReadOnly(role) && projects.length > 0 && currentView === 'leads' && (
            <>
              <button onClick={undo} style={{ background: 'none', border: '0.5px solid #2a2a2a', borderRadius: '6px', color: '#a0a0a0', cursor: 'pointer', padding: '5px 10px', fontSize: '13px' }}>
                ↩ Undo
              </button>
              <button onClick={redo} style={{ background: 'none', border: '0.5px solid #2a2a2a', borderRadius: '6px', color: '#a0a0a0', cursor: 'pointer', padding: '5px 10px', fontSize: '13px' }}>
                ↪ Redo
              </button>
            </>
          )}
          <UserMenu userProfile={userProfile} onLogout={onLogout} onSelectMenu={(view) => {
            if (view === 'my_profile') {
              setSelectedUserId(userProfile.id)
              setCurrentView('employee_profile')
            } else if (view === 'activity') {
              setSelectedUserId(userProfile.id)
              setCurrentView('employee_profile') // Activity is at the bottom of the profile
            } else {
              setCurrentView(view)
            }
          }} />
        </div>
      </div>

      {projects.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 56px)', gap: '16px' }}>
          <div style={{ fontSize: '18px', color: '#ededed', fontWeight: '500' }}>Create your first project to get started</div>
          {canManageProjects(role) ? (
            <button className="btn-primary" onClick={() => { setEditingProject(null); setProjectModalOpen(true) }}>+ New Project</button>
          ) : (
            <div style={{ color: '#555', fontSize: '13px' }}>No projects exist yet. Ask an admin to create one.</div>
          )}
        </div>
      ) : (
        <>
          {currentView === 'leads' && (
            <div style={{ padding: '24px' }}>
              <Toolbar
                role={role}
                currentView={currentView} setCurrentView={setCurrentView}
                search={search} setSearch={setSearch}
                filterPriority={filterPriority} setFilterPriority={setFilterPriority}
                filterContacted={filterContacted} setFilterContacted={setFilterContacted}
                filterNumber={filterNumber} setFilterNumber={setFilterNumber}
                onAddLead={() => { setEditingLead(null); setModalOpen(true) }}
                onManageColumns={() => setColManagerOpen(true)}
                onImportClick={() => fileInputRef?.current?.click()}
              />
              <StatsBar leads={leads} />
              <input type="file" accept=".xlsx,.csv" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
              {loading ? (
                <div style={{ textAlign: 'center', padding: '60px', color: '#555', fontSize: '13px' }}>Loading leads...</div>
              ) : (
                <LeadsTable role={role} leads={filteredLeads} customColumns={customColumns} onEdit={l => { setEditingLead(l); setModalOpen(true) }} onDelete={handleDelete} />
              )}
            </div>
          )}
          
          {currentView === 'team' && (
            <TeamPage onSelectMember={(id) => { setSelectedUserId(id); setCurrentView('employee_profile') }} />
          )}
          
          {currentView === 'employee_profile' && (
            <EmployeeProfilePage userId={selectedUserId} onBack={() => setCurrentView('leads')} />
          )}

          {currentView === 'settings' && (
            <SettingsPage userProfile={userProfile} />
          )}
        </>
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
          onSuccess={async (count, skipped = 0, duplicates = 0) => {
            setImportFile(null)
            // Always start with the imported count, then append each skip reason only if non-zero.
            // This means the toast only mentions what actually happened (e.g. no "0 duplicates" noise).
            const parts = [`${count} imported`]
            if (skipped > 0) parts.push(`${skipped} skipped (missing name)`)
            if (duplicates > 0) parts.push(`${duplicates} skipped (duplicates)`)
            showToast(parts.join(', '))
            await fetchLeads()
          }} 
        />
      )}
    </div>
  )
}