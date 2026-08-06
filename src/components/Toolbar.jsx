import React, { useState, useRef, useEffect } from 'react'
import { canWriteLeads, canImport, canManageColumns } from '../lib/permissions'

export default function Toolbar({
  role,
  currentView = 'leads',
  search,
  setSearch,
  filterPriority,
  setFilterPriority,
  filterContacted,
  setFilterContacted,
  filterNumber,
  setFilterNumber,
  onAddLead,
  onManageColumns,
  onImportClick
}) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [overflowOpen, setOverflowOpen] = useState(false)

  const filterRef = useRef(null)
  const overflowRef = useRef(null)

  // Close popovers when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setFiltersOpen(false)
      }
      if (overflowRef.current && !overflowRef.current.contains(event.target)) {
        setOverflowOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (currentView !== 'leads') return null

  const activeFiltersCount = (filterPriority ? 1 : 0) + (filterContacted ? 1 : 0) + (filterNumber ? 1 : 0)

  const hasOverflowPermissions = canImport(role) || canManageColumns(role)

  const clearAllFilters = () => {
    setFilterPriority('')
    setFilterContacted('')
    setFilterNumber('')
  }

  return (
    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '20px' }}>
      
      {/* 1. SEARCH INPUT */}
      <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
        <input
          className="input-base"
          type="text"
          placeholder="Search leads by name, phone, notes..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ paddingLeft: '34px', width: '100%' }}
        />
        <svg
          style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#8a8a85' }}
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
      </div>

      {/* 2. SINGLE GROUPED FILTERS BUTTON & DROPDOWN */}
      <div style={{ position: 'relative' }} ref={filterRef}>
        <button
          type="button"
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="btn-ghost"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: activeFiltersCount > 0 ? 'rgba(62, 207, 142, 0.12)' : '#1c1c20',
            borderColor: activeFiltersCount > 0 ? 'rgba(62, 207, 142, 0.3)' : 'rgba(255, 255, 255, 0.1)',
            color: activeFiltersCount > 0 ? '#3ecf8e' : '#ededed',
            fontWeight: '500'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
          <span>Filters</span>
          {activeFiltersCount > 0 && (
            <span style={{
              background: '#3ecf8e',
              color: '#000',
              borderRadius: '50%',
              fontSize: '10px',
              fontWeight: '700',
              width: '16px',
              height: '16px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {activeFiltersCount}
            </span>
          )}
          <span style={{ fontSize: '10px', opacity: 0.6 }}>▼</span>
        </button>

        {filtersOpen && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              right: 0,
              width: '260px',
              background: '#1c1c20',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '12px',
              padding: '16px',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#f5f5f0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Grouped Filters</span>
              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  style={{ background: 'none', border: 'none', color: '#f87171', fontSize: '11px', cursor: 'pointer', padding: 0 }}
                >
                  Reset all
                </button>
              )}
            </div>

            {/* Priority Filter */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', color: '#8a8a85', fontWeight: '600' }}>Priority</label>
              <select className="input-base" style={{ width: '100%', fontSize: '12px' }} value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
                <option value="">All Priorities</option>
                <option value="High">High Priority</option>
                <option value="Medium">Medium Priority</option>
                <option value="Low">Low Priority</option>
              </select>
            </div>

            {/* Status Filter */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', color: '#8a8a85', fontWeight: '600' }}>Status / Contacted</label>
              <select className="input-base" style={{ width: '100%', fontSize: '12px' }} value={filterContacted} onChange={e => setFilterContacted(e.target.value)}>
                <option value="">All Statuses</option>
                <option value="Yes">Contacted</option>
                <option value="Queued">Queued</option>
                <option value="Attempted">Attempted</option>
                <option value="Not Reachable">Not Reachable</option>
                <option value="No">Not Contacted</option>
              </select>
            </div>

            {/* Number Type Filter */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', color: '#8a8a85', fontWeight: '600' }}>Number Type</label>
              <select className="input-base" style={{ width: '100%', fontSize: '12px' }} value={filterNumber} onChange={e => setFilterNumber(e.target.value)}>
                <option value="">All Numbers</option>
                <option value="Mobile ✅">Mobile ✅</option>
                <option value="Landline ⚠️">Landline ⚠️</option>
                <option value="No Number">No Number</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* 3. OVERFLOW MENU (⋯) — HIDDEN FOR REP ROLE USERS */}
      {hasOverflowPermissions && (
        <div style={{ position: 'relative' }} ref={overflowRef}>
          <button
            type="button"
            onClick={() => setOverflowOpen(!overflowOpen)}
            className="btn-ghost"
            style={{
              padding: '6px 12px',
              fontSize: '14px',
              fontWeight: '700',
              letterSpacing: '1px'
            }}
            title="More actions"
          >
            ⋯
          </button>

          {overflowOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                width: '160px',
                background: '#1c1c20',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '10px',
                padding: '6px',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                gap: '2px'
              }}
            >
              {canImport(role) && (
                <button
                  type="button"
                  onClick={() => { setOverflowOpen(false); onImportClick() }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: '12px',
                    color: '#ededed',
                    background: 'none',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                  onMouseOver={e => e.currentTarget.style.background = '#28282e'}
                  onMouseOut={e => e.currentTarget.style.background = 'none'}
                >
                  <span>📂</span>
                  <span>Import</span>
                </button>
              )}

              {canManageColumns(role) && (
                <button
                  type="button"
                  onClick={() => { setOverflowOpen(false); onManageColumns() }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: '12px',
                    color: '#ededed',
                    background: 'none',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                  onMouseOver={e => e.currentTarget.style.background = '#28282e'}
                  onMouseOut={e => e.currentTarget.style.background = 'none'}
                >
                  <span>⚙️</span>
                  <span>Columns</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 4. PRIMARY ADD LEAD BUTTON */}
      {canWriteLeads(role) && (
        <button className="btn-primary" onClick={onAddLead}>
          + Add Lead
        </button>
      )}

    </div>
  )
}