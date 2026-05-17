export default function Toolbar({ search, setSearch, filterPriority, setFilterPriority, filterContacted, setFilterContacted, filterNumber, setFilterNumber, onAddLead }) {
  return (
    <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
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
        <option value="">All contacted</option>
        <option value="Yes">Contacted</option>
        <option value="No">Not contacted</option>
      </select>
      <select className="input-base" style={{ width: 'auto' }} value={filterNumber} onChange={e => setFilterNumber(e.target.value)}>
        <option value="">All numbers</option>
        <option value="Mobile ✅">Mobile</option>
        <option value="Landline ⚠️">Landline</option>
        <option value="No Number">No number</option>
      </select>
      <button className="btn-primary" onClick={onAddLead}>+ Add Lead</button>
    </div>
  )
}