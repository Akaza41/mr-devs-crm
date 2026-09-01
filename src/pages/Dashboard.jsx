import { useState, useEffect, useRef } from 'react'
import { db } from '../lib/firebase'
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore'
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
  const [onlineUserIds, setOnlineUserIds] = useState(new Set())
  const [teamMembers, setTeamMembers] = useState([])

  const leadsRef = useRef(leads)
  const historyRef = useRef([])
  const futureRef = useRef([])

  // ── INITIAL DATA SNAPSHOTS ──
  useEffect(() => {
    // 1. Projects Realtime Listener
    const qProjects = query(collection(db, 'projects'), orderBy('createdAt', 'asc'))
    const unsubProjects = onSnapshot(qProjects, (snapshot) => {
      const projs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setProjects(projs)
      if (projs.length > 0 && !activeProject) {
        setActiveProject(projs[0])
      }
    })

    // 2. Custom Columns Realtime Listener
    const qCols = query(collection(db, 'custom_columns'), orderBy('createdAt', 'asc'))
    const unsubCols = onSnapshot(qCols, (snapshot) => {
      const cols = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setCustomColumns(cols)
    })

    // 3. Team Members Realtime Listener
    const qUsers = query(collection(db, 'users'), orderBy('displayName', 'asc'))
    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      const members = snapshot.docs.map(doc => ({
        id: doc.id,
        full_name: doc.data().displayName || doc.data().email,
        email: doc.data().email,
        role: doc.data().role,
        avatar_url: doc.data().photoURL
      }))
      setTeamMembers(members)
      setOnlineUserIds(new Set(snapshot.docs.filter(d => d.data().active).map(d => d.id)))
    })

    return () => {
      unsubProjects()
      unsubCols()
      unsubUsers()
    }
  }, [])

  // ── LEADS REALTIME LISTENER PER ACTIVE PROJECT ──
  useEffect(() => {
    if (!activeProject) return
    setLoading(true)

    const qLeads = query(
      collection(db, 'leads'),
      where('projectId', '==', activeProject.id)
    )

    const unsubLeads = onSnapshot(qLeads, (snapshot) => {
      const leadList = snapshot.docs.map(doc => {
        const d = doc.data()
        return {
          id: doc.id,
          project_id: d.projectId,
          hospital_name: d.hospitalName || d.leadName || 'Unnamed Lead',
          lead_name: d.leadName || d.hospitalName || 'Unnamed Lead',
          address: d.address || '',
          type: d.type || '',
          rating: d.rating || null,
          reviews: d.reviews || 0,
          phone: d.phone || '',
          number_type: d.numberType || 'No Number',
          has_website: d.hasWebsite || 'No',
          priority: d.priority || 'Medium',
          stage: d.stage || 'New',
          fb_found: d.fbFound || 'No',
          contacted: d.contacted || 'No',
          reply: d.reply || '—',
          notes: d.notes || '',
          assigned_to: d.assignedTo || null,
          created_by: d.createdBy || null,
          ...(d.customFields || {}),
          ...d
        }
      })
      updateLeads(leadList)
      setLoading(false)
    }, (err) => {
      console.error('Error fetching leads snapshot:', err)
      setLoading(false)
    })

    return () => unsubLeads()
  }, [activeProject])

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const updateLeads = (newLeads) => {
    setLeads(newLeads)
    leadsRef.current = newLeads
  }

  // ── ASSIGNMENT HANDLERS ──
  const handleAssignLead = async (leadId, targetUserId) => {
    try {
      await updateDoc(doc(db, 'leads', String(leadId)), {
        assignedTo: targetUserId,
        updatedAt: serverTimestamp()
      })
      showToast('Lead assigned')
    } catch (err) {
      showToast('Error assigning lead: ' + err.message)
    }
  }

  const handleBulkAssign = async (leadIds, targetUserId) => {
    if (!leadIds || leadIds.length === 0) return
    try {
      const batch = writeBatch(db)
      for (const id of leadIds) {
        batch.update(doc(db, 'leads', String(id)), {
          assignedTo: targetUserId,
          updatedAt: serverTimestamp()
        })
      }
      await batch.commit()
      showToast(`${leadIds.length} leads assigned`)
    } catch (err) {
      showToast('Error assigning leads: ' + err.message)
    }
  }

  // ── UNDO / REDO HISTORY ──
  const pushHistory = (action) => {
    historyRef.current = [...historyRef.current, action]
    futureRef.current = []
  }

  async function undo() {
    if (historyRef.current.length === 0) { showToast('Nothing to undo'); return }
    const action = historyRef.current[historyRef.current.length - 1]
    
    futureRef.current = [action, ...futureRef.current]
    historyRef.current = historyRef.current.slice(0, -1)

    try {
      if (action.type === 'ADD') {
        await deleteDoc(doc(db, 'leads', String(action.lead.id)))
      } else if (action.type === 'DELETE') {
        await updateDoc(doc(db, 'leads', String(action.lead.id)), action.lead)
      } else if (action.type === 'UPDATE') {
        await updateDoc(doc(db, 'leads', String(action.id)), action.before)
      }
      showToast('Undo done')
    } catch (err) {
      showToast('Undo error: ' + err.message)
    }
  }

  async function redo() {
    if (futureRef.current.length === 0) { showToast('Nothing to redo'); return }
    const action = futureRef.current[0]
    
    historyRef.current = [...historyRef.current, action]
    futureRef.current = futureRef.current.slice(1)

    try {
      if (action.type === 'ADD') {
        await updateDoc(doc(db, 'leads', String(action.lead.id)), action.lead)
      } else if (action.type === 'DELETE') {
        await deleteDoc(doc(db, 'leads', String(action.lead.id)))
      } else if (action.type === 'UPDATE') {
        await updateDoc(doc(db, 'leads', String(action.id)), action.after)
      }
      showToast('Redo done')
    } catch (err) {
      showToast('Redo error: ' + err.message)
    }
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

  // ── SAVE / UPDATE LEAD ──
  const handleSave = async (form) => {
    if (!activeProject) return
    
    const leadPayload = {
      projectId: activeProject.id,
      hospitalName: form.hospital_name || form.lead_name || 'Unnamed Lead',
      leadName: form.lead_name || form.hospital_name || 'Unnamed Lead',
      address: form.address || '',
      type: form.type || '',
      rating: form.rating ? Number(form.rating) : null,
      reviews: form.reviews ? Number(form.reviews) : 0,
      phone: form.phone || '',
      numberType: form.number_type || 'No Number',
      hasWebsite: form.has_website || 'No',
      priority: form.priority || 'Medium',
      stage: form.stage || 'New',
      fbFound: form.fb_found || 'No',
      contacted: form.contacted || 'No',
      reply: form.reply || '—',
      notes: form.notes || '',
      updatedAt: serverTimestamp()
    }

    try {
      if (editingLead) {
        await updateDoc(doc(db, 'leads', String(editingLead.id)), leadPayload)
        
        pushHistory({ type: 'UPDATE', id: editingLead.id, before: editingLead, after: { ...editingLead, ...leadPayload } })
        showToast('Lead updated')

        logActivity({
          action: ACTIONS.LEAD_UPDATED,
          entityType: 'lead',
          entityId: editingLead.id,
          projectId: activeProject.id,
          metadata: { lead_name: leadPayload.hospitalName },
        })
      } else {
        leadPayload.createdAt = serverTimestamp()
        leadPayload.createdBy = userProfile?.id || null
        const docRef = await addDoc(collection(db, 'leads'), leadPayload)
        
        pushHistory({ type: 'ADD', lead: { id: docRef.id, ...leadPayload } })
        showToast('Lead added')

        logActivity({
          action: ACTIONS.LEAD_CREATED,
          entityType: 'lead',
          entityId: docRef.id,
          projectId: activeProject.id,
          metadata: { lead_name: leadPayload.hospitalName },
        })
      }
    } catch (err) {
      console.error('Save lead error:', err)
      showToast('Error saving lead: ' + err.message)
    }
    setModalOpen(false)
  }

  // ── DELETE LEAD ──
  const handleDelete = async (lead) => {
    if (!window.confirm(`Delete ${lead.hospital_name}?`)) return
    
    try {
      await deleteDoc(doc(db, 'leads', String(lead.id)))
      pushHistory({ type: 'DELETE', lead })
      showToast('Lead deleted')

      logActivity({
        action: ACTIONS.LEAD_DELETED,
        entityType: 'lead',
        entityId: lead.id,
        projectId: activeProject?.id,
        metadata: { lead_name: lead.hospital_name },
      })
    } catch (err) {
      showToast('Error deleting lead: ' + err.message)
    }
  }

  // ── SAVE / UPDATE PROJECT ──
  const handleSaveProject = async (form) => {
    try {
      if (editingProject) {
        await updateDoc(doc(db, 'projects', String(editingProject.id)), {
          name: form.name,
          updatedAt: serverTimestamp()
        })
        showToast('Project updated')

        logActivity({
          action: ACTIONS.PROJECT_UPDATED,
          entityType: 'project',
          entityId: editingProject.id,
          metadata: { project_name: form.name },
        })
      } else {
        const docRef = await addDoc(collection(db, 'projects'), {
          name: form.name,
          createdAt: serverTimestamp()
        })
        setActiveProject({ id: docRef.id, name: form.name })
        showToast('Project created')

        logActivity({
          action: ACTIONS.PROJECT_CREATED,
          entityType: 'project',
          entityId: docRef.id,
          metadata: { project_name: form.name },
        })
      }
    } catch (err) {
      showToast('Error saving project: ' + err.message)
    }
    setProjectModalOpen(false)
    setEditingProject(null)
  }

  // ── DELETE PROJECT ──
  const handleDeleteProject = async (project) => {
    if (projects.length <= 1) {
      alert('Cannot delete the only project.')
      return
    }
    if (!window.confirm(`Delete project "${project.name}"?`)) return
    
    try {
      await deleteDoc(doc(db, 'projects', String(project.id)))
      
      logActivity({
        action: ACTIONS.PROJECT_DELETED,
        entityType: 'project',
        entityId: project.id,
        metadata: { project_name: project.name },
      })

      const remaining = projects.filter(p => p.id !== project.id)
      if (activeProject?.id === project.id && remaining.length > 0) {
        setActiveProject(remaining[0])
      }
      showToast('Project deleted')
    } catch (err) {
      showToast('Error deleting project: ' + err.message)
    }
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
          onRefreshCustomColumns={() => {}}
          onClose={() => setImportFile(null)} 
          onSuccess={async (count, skipped = 0, duplicates = 0) => {
            setImportFile(null)
            const parts = [`${count} imported`]
            if (skipped > 0) parts.push(`${skipped} skipped (missing name)`)
            if (duplicates > 0) parts.push(`${duplicates} skipped (duplicates)`)
            showToast(parts.join(', '))
          }} 
        />
      )}
    </div>
  )
}