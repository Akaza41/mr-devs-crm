import { canAccessTeam, canManageInvites, canWriteLeads, canImport, canManageColumns, isReadOnly } from '../lib/permissions'

// ── TOOLBAR ──
// Navigation tabs + filter bar + action buttons.
// Visibility of each element is driven entirely by the permissions utility,
// not by hardcoded role strings, so future roles just require updating permissions.js.
export default function Toolbar({ role, currentView = 'leads', setCurrentView, search, setSearch, filterPriority, setFilterPriority, filterContacted, setFilterContacted, filterNumber, setFilterNumber, onAddLead, onManageColumns, onImportClick }) {
  // Determine which tabs this role can access
  const showTeamTab = canAccessTeam(role)
  const showAddUserTab = canManageInvites(role)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px' }}>
      
      {/* Navigation Tabs — available for all active users */}
      <div style={{ display: 'flex', gap: '20px', borderBottom: '0.5px solid #2a2a2a', paddingBottom: '12px' }}>
        <button 
          style={{ background: 'none', border: 'none', color: currentView === 'leads' ? '#3ecf8e' : '#a0a0a0', fontWeight: currentView === 'leads' ? '600' : '400', cursor: 'pointer', padding: 0, fontSize: '14px' }}
          onClick={() => setCurrentView('leads')}
        >
          Leads Management
        </button>

        <button 
          style={{ background: 'none', border: 'none', color: currentView === 'chat' ? '#3ecf8e' : '#a0a0a0', fontWeight: currentView === 'chat' ? '600' : '400', cursor: 'pointer', padding: 0, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}
          onClick={() => setCurrentView('chat')}
        >
          <span>Team Chat</span>
          <span style={{ fontSize: '11px', background: 'rgba(62,207,142,0.1)', color: '#3ecf8e', padding: '1px 6px', borderRadius: '10px' }}>💬</span>
        </button>

        {showTeamTab && (
          <button 
            style={{ background: 'none', border: 'none', color: currentView === 'team' || currentView === 'employee_profile' ? '#3ecf8e' : '#a0a0a0', fontWeight: currentView === 'team' || currentView === 'employee_profile' ? '600' : '400', cursor: 'pointer', padding: 0, fontSize: '14px' }}
            onClick={() => setCurrentView('team')}
          >
            Team
          </button>
        )}
        {showAddUserTab && (
          <button 
            style={{ background: 'none', border: 'none', color: currentView === 'add_user' ? '#3ecf8e' : '#a0a0a0', fontWeight: currentView === 'add_user' ? '600' : '400', cursor: 'pointer', padding: 0, fontSize: '14px' }}
            onClick={() => setCurrentView('add_user')}
          >
            + Add User & Invites
          </button>
        )}
      </div>

      {/* Leads Filters & Action Buttons — only visible on the leads view */}
      {currentView === 'leads' && (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <input className="input-base" type="text" placeholder="Search leads..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '32px' }} />
            <svg style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#555' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </div>
          <select className="input-base" style={{ width: 'auto' }} value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
            <option value="">All priorities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
          <select className="input-base" style={{ width: 'auto' }} value={filterContacted} onChange={e => setFilterContacted(e.target.value)}>
            <option value="">All</option>
            <option value="Yes"> Contacted</option>
            <option value="Queued"> Queued</option>
            <option value="Attempted"> Attempted</option>
            <option value="Not Reachable"> Not Reachable</option>
            <option value="No"> Not Contacted</option>
          </select>
          <select className="input-base" style={{ width: 'auto' }} value={filterNumber} onChange={e => setFilterNumber(e.target.value)}>
            <option value="">All numbers</option>
            <option value="Mobile ✅">Mobile</option>
            <option value="Landline ⚠️">Landline</option>
            <option value="No Number">No number</option>
          </select>

          {/* Action buttons — each gated by its own permission */}
          {canImport(role) && (
            <button className="btn-ghost" onClick={onImportClick}>📂 Import</button>
          )}
          {canManageColumns(role) && (
            <button className="btn-ghost" onClick={onManageColumns}>⚙️ Columns</button>
          )}
          {canWriteLeads(role) && (
            <button className="btn-primary" onClick={onAddLead}>+ Add Lead</button>
          )}
        </div>
      )}
    </div>
  )
}