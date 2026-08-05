import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import LeftNav from '../components/LeftNav'
import PipelineFunnel from '../components/PipelineFunnel'
import TodaysQueue from '../components/TodaysQueue'
import Toolbar from '../components/Toolbar'
import LeadsTable from '../components/LeadsTable'
import SkeletonTable from '../components/SkeletonTable'
import LeadModal from '../components/LeadModal'
import ColManager from '../components/ColManager'
import ImportModal from '../components/ImportModal'
import ProjectModal from '../components/ProjectModal'
import TeamPage from '../components/TeamPage'
import AddUserScreen from '../components/team/AddUserScreen'
import GlobalChatPage from '../components/chat/GlobalChatPage'
import EmployeeProfilePage from './EmployeeProfilePage'
import SettingsPage from './SettingsPage'
import LeaderboardPage from './LeaderboardPage'
import UsersPage from './UsersPage'
import { canManageProjects, canManageInvites } from '../lib/permissions'
import { useRouting } from '../lib/useRouting'
import { logActivity } from '../lib/activityLogger'
import { ACTIONS } from '../lib/activityActions'

export default function Dashboard({ userProfile, role, onLogout }) {
  const [projects, setProjects] = useState([])
  const [activeProject, setActiveProject] = useState(null)
  const [projectModalOpen, setProjectModalOpen] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const { currentView, selectedUserId, navigate, goBack, canGoBack } = useRouting()

  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterContacted, setFilterContacted] = useState('')
  const [filterNumber, setFilterNumber] = useState('')
  const [activeStageFilter, setActiveStageFilter] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [colManagerOpen, setColManagerOpen] = useState(false)
  const [importFile, setImportFile] = useState(null)
  const [customColumns, setCustomColumns] = useState([])
  const [editingLead, setEditingLead] = useState(null)
  const [toast, setToast] = useState('')
  const [onlineUserIds, setOnlineUserIds] = useState(new Set())

  const fileInputRef = useRef(null)
  const historyRef = useRef([])
  const futureRef = useRef([])
  const leadsRef = useRef([])

  useEffect(() => { 
    fetchCustomColumns()
    fetchProjects()
  }, [])

  // ── Realtime Presence ──
  useEffect(() => {
    if (!userProfile) return
    const channel = supabase.channel('team-presence')

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const ids = new Set()
        for (const key in state) {
          state[key].forEach(presence => {
            if (presence.user_id) ids.add(presence.user_id)
          })
        }
        setOnlineUserIds(ids)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: userProfile.id })
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userProfile])

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

    let query = supabase.from('leads').select('*').eq('project_id', activeProject.id)

    if ((role === 'sales' || role === 'lead generator') && userProfile?.id) {
      query = query.or(`assigned_to.eq.${userProfile.id},assigned_to.is.null,created_by.eq.${userProfile.id}`)
    }

    const { data, error } = await query
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

    if (action.type === 'ADD') {
      updateLeads(leadsRef.current.filter(l => l.id !== action.lead.id))
      await supabase.from('leads').delete().eq('id', action.lead.id)
    } else if (action.type === 'DELETE') {
      updateLeads([...leadsRef.current, action.lead])
      await supabase.from('leads').insert([action.lead])
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
  }, [])

  const filteredLeads = leads.filter(l => {
    const q = search.toLowerCase()
    const matchSearch = !q || (l.hospital_name || '').toLowerCase().includes(q) || (l.phone || '').toLowerCase().includes(q) || (l.notes || '').toLowerCase().includes(q)
    const matchPriority = !filterPriority || l.priority === filterPriority
    const matchContacted = !filterContacted || l.contacted === filterContacted
    const matchNumber = !filterNumber || l.number_type === filterNumber
    const matchStage = !activeStageFilter || (l.stage || 'New').toLowerCase() === activeStageFilter.toLowerCase()
    return matchSearch && matchPriority && matchContacted && matchNumber && matchStage
  })

  const handleSave = async (form) => {
    if (!activeProject) return
    
    if (editingLead) {
      const { error } = await supabase.from('leads').update(form).eq('id', editingLead.id)
      if (error) {
        showToast('Error updating lead: ' + error.message)
        return
      }

      const before = { ...editingLead }
      const after = { ...editingLead, ...form }
      pushHistory({ type: 'UPDATE', id: editingLead.id, before, after })
      
      const updatedLeads = leadsRef.current.map(l => l.id === editingLead.id ? after : l)
      updateLeads(updatedLeads)
      showToast('Lead updated')

      logActivity({
        action: ACTIONS.LEAD_UPDATED,
        entityType: 'lead',
        entityId: editingLead.id,
        projectId: activeProject.id,
        metadata: { lead_name: form.hospital_name || editingLead.hospital_name },
      })
    } else {
      const { data, error } = await supabase.from('leads').insert([{ ...form, project_id: activeProject.id }]).select().single()
      if (error) {
        showToast('Error adding lead')
        return
      }
      
      pushHistory({ type: 'ADD', lead: data })
      const updatedLeads = [...leadsRef.current, data]
      updateLeads(updatedLeads)
      showToast('Lead added')

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

    pushHistory({ type: 'DELETE', lead })
    
    const updatedLeads = leadsRef.current.filter(l => l.id !== lead.id)
    updateLeads(updatedLeads)
    showToast('Lead deleted')

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
    <div style={{ minHeight: '100vh', background: '#0d0d10' }} className="flex flex-col md:flex-row">

      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: '#151518', border: '1px solid #3ecf8e', borderRadius: '10px', padding: '10px 20px', color: '#3ecf8e', fontSize: '13px', zIndex: 999, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
          {toast}
        </div>
      )}

      {/* ── ROLE-AWARE LEFT SIDEBAR NAVIGATION ── */}
      <LeftNav
        userProfile={userProfile}
        role={role}
        currentView={currentView}
        onNavigate={(view) => navigate(view)}
        onLogout={onLogout}
        projects={projects}
        activeProject={activeProject}
        onChangeProject={setActiveProject}
        onEditProject={(p) => { setEditingProject(p); setProjectModalOpen(true) }}
        onDeleteProject={handleDeleteProject}
        onNewProject={() => { setEditingProject(null); setProjectModalOpen(true) }}
        onGoBack={goBack}
        canGoBack={canGoBack}
      />

      {/* ── MAIN WORKSPACE CONTENT ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowX: 'hidden' }}>

        {projects.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '16px' }}>
            <div style={{ fontSize: '18px', color: '#f5f5f0', fontWeight: '500' }}>Create your first project to get started</div>
            {canManageProjects(role) ? (
              <button className="btn-primary" onClick={() => { setEditingProject(null); setProjectModalOpen(true) }}>+ New Project</button>
            ) : (
              <div style={{ color: '#8a8a85', fontSize: '13px' }}>No projects exist yet. Ask an admin to create one.</div>
            )}
          </div>
        ) : (
          <div style={{ padding: '24px', flex: 1 }}>
            
            {/* LEADS VIEW */}
            {currentView === 'leads' && (
              <>
                <Toolbar
                  role={role}
                  currentView={currentView}
                  setCurrentView={(view) => navigate(view)}
                  search={search} setSearch={setSearch}
                  filterPriority={filterPriority} setFilterPriority={setFilterPriority}
                  filterContacted={filterContacted} setFilterContacted={setFilterContacted}
                  filterNumber={filterNumber} setFilterNumber={setFilterNumber}
                  onAddLead={() => { setEditingLead(null); setModalOpen(true) }}
                  onManageColumns={() => setColManagerOpen(true)}
                  onImportClick={() => fileInputRef?.current?.click()}
                />

                {/* ── STEP 1: PIPELINE FUNNEL ── */}
                <PipelineFunnel
                  leads={leads}
                  activeStageFilter={activeStageFilter}
                  onSelectStage={(stage) => setActiveStageFilter(stage)}
                />

                {/* ── STEP 2: TODAY'S QUEUE PANEL ── */}
                <TodaysQueue
                  leads={leads}
                  currentUserProfile={userProfile}
                  activeProject={activeProject}
                  onUpdateLead={(updatedLead) => {
                    updateLeads(leads.map(l => l.id === updatedLead.id ? updatedLead : l))
                  }}
                  showToast={showToast}
                />

                <input type="file" accept=".xlsx,.csv" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />

                {/* ── STEP 4: LOADING SKELETON VS RICH TABLE / EMPTY STATE ── */}
                {loading ? (
                  <SkeletonTable rows={6} />
                ) : (
                  <LeadsTable
                    role={role}
                    leads={filteredLeads}
                    customColumns={customColumns}
                    onEdit={l => { setEditingLead(l); setModalOpen(true) }}
                    onDelete={handleDelete}
                    onImportClick={() => fileInputRef?.current?.click()}
                    onAddLead={() => { setEditingLead(null); setModalOpen(true) }}
                  />
                )}
              </>
            )}

            {/* TEAM CHAT VIEW */}
            {currentView === 'chat' && (
              <GlobalChatPage currentUserProfile={userProfile} onBack={goBack} />
            )}

            {/* TEAM DIRECTORY VIEW */}
            {currentView === 'team' && (
              <TeamPage 
                onlineUserIds={onlineUserIds} 
                onViewProfile={(id) => navigate('employee_profile', id)} 
              />
            )}

            {/* USERS & PERMISSIONS ADMIN VIEW */}
            {(currentView === 'users' || currentView === 'add_user') && canManageInvites(role) && (
              <UsersPage currentUserId={userProfile?.id} onBack={goBack} />
            )}
            
            {/* EMPLOYEE PROFILE VIEW */}
            {currentView === 'employee_profile' && (
              <EmployeeProfilePage userId={selectedUserId || userProfile?.id} onBack={goBack} />
            )}

            {/* LEADERBOARD VIEW */}
            {currentView === 'leaderboard' && (
              <LeaderboardPage onlineUserIds={onlineUserIds} onBack={goBack} />
            )}

            {/* SETTINGS VIEW */}
            {currentView === 'settings' && (
              <SettingsPage userProfile={userProfile} onBack={goBack} />
            )}

          </div>
        )}

      </main>

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