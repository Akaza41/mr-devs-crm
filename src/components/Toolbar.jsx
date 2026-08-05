import { canAccessTeam, canManageInvites, canWriteLeads, canImport, canManageColumns } from '../lib/permissions'

// ── TOOLBAR ──
// Lead filter bar + action buttons.
// Nav navigation is handled strictly by the LeftNav single component.
export default function Toolbar({ role, currentView = 'leads', search, setSearch, filterPriority, setFilterPriority, filterContacted, setFilterContacted, filterNumber, setFilterNumber, onAddLead, onManageColumns, onImportClick }) {
  if (currentView !== 'leads') return null

  return (
    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '20px' }}>
      <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
        <input className="input-base" type="text" placeholder="Search leads by name, phone, notes..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '34px' }} />
        <svg style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#8a8a85' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      </div>

      <select className="input-base" style={{ width: 'auto' }} value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
        <option value="">All Priorities</option>
        <option value="High">High Priority</option>
        <option value="Medium">Medium Priority</option>
        <option value="Low">Low Priority</option>
      </select>

      <select className="input-base" style={{ width: 'auto' }} value={filterContacted} onChange={e => setFilterContacted(e.target.value)}>
        <option value="">All Statuses</option>
        <option value="Yes">Contacted</option>
        <option value="Queued">Queued</option>
        <option value="Attempted">Attempted</option>
        <option value="Not Reachable">Not Reachable</option>
        <option value="No">Not Contacted</option>
      </select>

      <select className="input-base" style={{ width: 'auto' }} value={filterNumber} onChange={e => setFilterNumber(e.target.value)}>
        <option value="">All Numbers</option>
        <option value="Mobile ✅">Mobile ✅</option>
        <option value="Landline ⚠️">Landline ⚠️</option>
        <option value="No Number">No Number</option>
      </select>

      {/* Action buttons */}
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
  )
}