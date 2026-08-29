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
import GlobalChatPage from '../components/chat/GlobalChatPage'
import EmployeeProfilePage from './EmployeeProfilePage'
import SettingsPage from './SettingsPage'
import LeaderboardPage from './LeaderboardPage'
import UsersPage from './UsersPage'
import ExtensionActivityPage from './ExtensionActivityPage'
import { canManageInvites } from '../lib/permissions'
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
  const [onlineUserIds, setOnlineUserIds] = useState([])
  const [teamMembers, setTeamMembers] = useState([])

  const leadsRef = useRef(leads)
  const historyRef = useRef([])
  const futureRef = useRef([])

  useEffect(() => {
    fetchProjects()
    fetchCustomColumns()
    fetchTeamMembers()
  }, [])

  async function fetchTeamMembers() {
    const { data } = await supabase.from('profiles').select('id, full_name, email, role, avatar_url').order('full_name')
    if (data) setTeamMembers(data)
  }

  const handleAssignLead = async (leadId, targetUserId) => {
    const { error } = await supabase.from('leads').update({ assigned_to: targetUserId, updated_at: new Date().toISOString() }).eq('id', leadId)
    if (error) {
      showToast('Error assigning lead: ' + error.message)
      return
    }
    const updated = leads.map(l => l.id === leadId ? { ...l, assigned_to: targetUserId } : l)
    updateLeads(updated)
    showToast('Lead assigned')
  }

  const handleBulkAssign = async (leadIds, targetUserId) => {
    if (!leadIds || leadIds.length === 0) return
    const { error } = await supabase.from('leads').update({ assigned_to: targetUserId, updated_at: new Date().toISOString() }).in('id', leadIds)
    if (error) {
      showToast('Error assigning leads: ' + error.message)
      return
    }
    const idSet = new Set(leadIds)
    const updated = leads.map(l => idSet.has(l.id) ? { ...l, assigned_to: targetUserId } : l)
    updateLeads(updated)
    showToast(`${leadIds.length} leads assigned`)
  }

  useEffect(() => {
    if (activeProject) fetchLeads()
  }, [activeProject])

  useEffect(() => {
    if (!userProfile) return
    const channel = supabase.channel('online-users', {
      config: { presence: { key: userProfile.id } }
    })
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        setOnlineUserIds(Object.keys(state))
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString() })
        }
      })
    return () => { supabase.removeChannel(channel) }
  }, [userProfile])

  async function fetchProjects() {
    const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: true })
    if (data && data.length > 0) {
      setProjects(data)
      if (!activeProject) setActiveProject(data[0])
    }
  }

  async function fetchLeads() {
    if (!activeProject) return
    setLoading(true)
    const { data } = await supabase.from('leads').select('*').eq('project_id', activeProject.id).order('id', { ascending: true })
    const fetched = data || []
    updateLeads(fetched)
    setLoading(false)
  }

  async function fetchCustomColumns() {
    const { data } = await supabase.from('custom_columns').select('*').order('created_at', { ascending: true })
    if (data) setCustomColumns(data)
  }

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
    setEditingProject(null)
  }

  const handleDeleteProject = async (project) => {
    if (projects.length <= 1) {
      alert('Cannot delete the only project.')
      return
    }
    if (!window.confirm(`Delete project "${project.name}" and all its leads?`)) return
    
    const { error } = await supabase.from('projects').delete().eq('id', project.id)
    if (error) {
      showToast('Error deleting project: ' + error.message)
      return
    }

    logActivity({
      action: ACTIONS.PROJECT_DELETED,
      entityType: 'project',
      entityId: project.id,
      metadata: { project_name: project.name },
    })

    const remaining = projects.filter(p => p.id !== project.id)
    setProjects(remaining)
    if (activeProject?.id === project.id) {
      setActiveProject(remaining[0])
    }
    showToast('Project deleted')
  }

  const handleUpdateLeadState = (updatedLead) => {
    const updatedLeads = leadsRef.current.map(l => l.id === updatedLead.id ? updatedLead : l)
    updateLeads(updatedLeads)
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen" style={{ background: '#0f0f0f' }}>
      
      {/* Toast Notification */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: '#161616', border: '0.5px solid #3ecf8e', borderRadius: '8px', padding: '10px 16px', color: '#3ecf8e', fontSize: '13px', zIndex: 1000, boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
          {toast}
        </div>
      )}

      {/* Sidebar Navigation */}
      <LeftNav
        userProfile={userProfile}
        role={role}
        currentView={currentView}
        onNavigate={navigate}
        onLogout={onLogout}
        projects={projects}
        activeProject={activeProject}
        onChangeProject={(p) => setActiveProject(p)}
        onEditProject={(p) => { setEditingProject(p); setProjectModalOpen(true) }}
        onDeleteProject={handleDeleteProject}
        onNewProject={() => { setEditingProject(null); setProjectModalOpen(true) }}
        onGoBack={goBack}
        canGoBack={canGoBack}
      />

      {/* Main View Area */}
      <main style={{ flex: 1, padding: '24px', overflowY: 'auto', minWidth: 0 }}>
        
        {loading ? (
          <SkeletonTable />
        ) : (
          <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
            
            {/* LEADS PIPELINE VIEW */}
            {currentView === 'leads' && (
              <>
                <TodaysQueue
                  leads={leads}
                  currentUserProfile={userProfile}
                  activeProject={activeProject}
                  onUpdateLead={handleUpdateLeadState}
                  showToast={showToast}
                />

                <PipelineFunnel
                  leads={leads}
                  activeStageFilter={activeStageFilter}
                  onSelectStageFilter={(stage) => setActiveStageFilter(stage)}
                />

                <Toolbar
                  role={role}
                  search={search}
                  onSearchChange={setSearch}
                  filterPriority={filterPriority}
                  onPriorityChange={setFilterPriority}
                  filterContacted={filterContacted}
                  onContactedChange={setFilterContacted}
                  filterNumber={filterNumber}
                  onNumberChange={setFilterNumber}
                  onAddLead={() => { setEditingLead(null); setModalOpen(true) }}
                  onManageCols={() => setColManagerOpen(true)}
                  onImportClick={(file) => setImportFile(file)}
                />

                <LeadsTable
                  role={role}
                  leads={filteredLeads}
                  customColumns={customColumns}
                  teamMembers={teamMembers}
                  onAssignLead={handleAssignLead}
                  onBulkAssign={handleBulkAssign}
                  onEdit={(lead) => { setEditingLead(lead); setModalOpen(true) }}
                  onDelete={handleDelete}
                  onImportClick={() => document.getElementById('excel-file-input')?.click()}
                  onAddLead={() => { setEditingLead(null); setModalOpen(true) }}
                />
              </>
            )}

            {/* TEAM CHAT VIEW */}
            {currentView === 'chat' && (
              <GlobalChatPage currentUserProfile={userProfile} onBack={goBack} />
            )}

            {/* EXTENSION ACTIVITY VIEW */}
            {currentView === 'extension_activity' && (
              <ExtensionActivityPage onBack={goBack} />
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

      {modalOpen && (
        <LeadModal 
          lead={editingLead} 
          customColumns={customColumns} 
          teamMembers={teamMembers}
          onClose={() => setModalOpen(false)} 
          onSave={handleSave} 
        />
      )}
      {colManagerOpen && <ColManager onClose={() => setColManagerOpen(false)} onCustomColumnsChange={setCustomColumns} />}
      {projectModalOpen && <ProjectModal project={editingProject} onClose={() => setProjectModalOpen(false)} onSave={handleSaveProject} />}
      {importFile && activeProject && (
        <ImportModal 
          file={importFile} 
          activeProject={activeProject}
          customColumns={customColumns} 
          currentUserProfile={userProfile}
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