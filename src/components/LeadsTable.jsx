import { useState } from 'react'
import { canWriteLeads, canDeleteLeads, isReadOnly } from '../lib/permissions'

function Badge({ text, type }) {
  const styles = {
    green: { background: 'rgba(62,207,142,0.12)', color: '#3ecf8e' },
    red: { background: 'rgba(248,113,113,0.12)', color: '#f87171' },
    yellow: { background: 'rgba(250,204,21,0.12)', color: '#facc15' },
    blue: { background: 'rgba(96,165,250,0.12)', color: '#60a5fa' },
    gray: { background: '#242424', color: '#a0a0a0' },
  }
  return (
    <span style={{ ...styles[type] || styles.gray, display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '500', whiteSpace: 'nowrap' }}>
      {text || '—'}
    </span>
  )
}

function PriorityBadge({ p }) {
  if (p === 'High') return <Badge text="High" type="red" />
  if (p === 'Medium') return <Badge text="Medium" type="yellow" />
  if (p === 'Low') return <Badge text="Low" type="blue" />
  return <Badge text="—" type="gray" />
}

function YesNo({ v }) {
  return <Badge text={v === 'Yes' || v === true ? 'Yes' : 'No'} type={v === 'Yes' || v === true ? 'green' : 'gray'} />
}

function FbBadge({ v }) {
  if (v && v !== 'No') return <Badge text="Yes" type="green" />
  return <Badge text="No" type="gray" />
}

function ContactedBadge({ v }) {
  if (v === 'Yes') return <Badge text="Yes" type="green" />
  if (v === 'Attempted') return <Badge text="Attempted" type="yellow" />
  if (v === 'Queued') return <Badge text="Queued" type="blue" />
  if (v === 'Not Reachable') return <Badge text="Not Reachable" type="red" />
  return <Badge text="No" type="gray" />
}

function StageBadge({ v }) {
  if (v === 'Contacted') return <Badge text="Contacted" type="blue" />
  if (v === 'Interested') return <Badge text="Interested" type="yellow" />
  if (v === 'Converted') return <Badge text="Converted" type="green" />
  if (v === 'Lost') return <Badge text="Lost" type="red" />
  return <Badge text="New" type="gray" />
}

function ReplyBadge({ v }) {
  if (v === 'Yes') return <Badge text="Yes" type="green" />
  if (v === 'Later') return <Badge text="Later" type="yellow" />
  if (v === 'No') return <Badge text="No" type="red" />
  return <Badge text="—" type="gray" />
}

function NumberBadge({ v }) {
  if (v === 'Mobile ✅' || v === 'Mobile') return <Badge text="Mobile ✅" type="green" />
  if (v === 'Landline ⚠️' || v === 'Landline') return <Badge text="Landline ⚠️" type="yellow" />
  return <Badge text="No Number" type="red" />
}

export default function LeadsTable({ role, leads, customColumns = [], onEdit, onDelete, onImportClick, onAddLead }) {
  const [copiedCell, setCopiedCell] = useState(null)
  const [colMenuOpen, setColMenuOpen] = useState(false)

  // Default visible columns
  const [visibleCols, setVisibleCols] = useState({
    hospital_name: true,
    type: true,
    rating: true,
    phone: true,
    priority: true,
    stage: true,
    next_followup_due: true,
    // Hidden by default:
    reviews: false,
    number_type: false,
    website: false,
    fb: false,
    contacted: false,
    reply: false,
    notes: false,
  })

  const toggleColumn = (key) => {
    setVisibleCols(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleCopy = (text, id) => {
    if (isReadOnly(role) || !text || text === '—') return
    navigator.clipboard.writeText(text)
    setCopiedCell(id)
    setTimeout(() => setCopiedCell(null), 1500)
  }

  const Cell = ({ id, textToCopy, style, children, ...props }) => {
    const isCopied = copiedCell === id
    return (
      <td 
        onClick={() => handleCopy(textToCopy, id)}
        style={{ position: 'relative', cursor: !isReadOnly(role) && textToCopy && textToCopy !== '—' ? 'pointer' : 'default', background: isCopied ? '#2a2a2a' : '', ...style }}
        {...props}
      >
        {isCopied && (
          <span style={{ position: 'absolute', top: '-15px', left: '50%', transform: 'translateX(-50%)', background: '#3ecf8e', color: '#000', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', zIndex: 10, whiteSpace: 'nowrap', boxShadow: '0 2px 5px rgba(0,0,0,0.5)' }}>Copied!</span>
        )}
        {children}
      </td>
    )
  }

  if (!leads.length) {
    return (
      <div
        style={{
          background: '#161616',
          border: '0.5px solid #232323',
          borderRadius: '12px',
          padding: '48px 24px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px'
        }}
      >
        <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#232323', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
          📂
        </div>

        <div>
          <h3 className="font-headline" style={{ fontSize: '16px', fontWeight: '700', color: '#f5f5f0', margin: '0 0 6px 0' }}>
            No leads in this view
          </h3>
          <p style={{ fontSize: '13px', color: '#8a8a85', margin: 0, maxWidth: '420px', lineHeight: '1.5' }}>
            Import your leads from an Excel/CSV file or add your first lead to start tracking your sales pipeline.
          </p>
        </div>

        {!isReadOnly(role) && (
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            {onImportClick && (
              <button className="btn-primary" onClick={onImportClick}>
                📂 Import Leads
              </button>
            )}
            {onAddLead && (
              <button className="btn-ghost" onClick={onAddLead}>
                + Add Lead
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  const optionalColsConfig = [
    { key: 'next_followup_due', label: 'Next Follow-Up' },
    { key: 'reviews', label: 'Reviews' },
    { key: 'number_type', label: 'Number Type' },
    { key: 'website', label: 'Website' },
    { key: 'fb', label: 'FB Found' },
    { key: 'contacted', label: 'Contacted' },
    { key: 'reply', label: 'Reply' },
    { key: 'notes', label: 'Notes' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      
      {/* Table Toolbar / Column Toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
        <div style={{ fontSize: '12px', color: '#8a8a85', fontWeight: '500' }}>
          Showing <strong style={{ color: '#f5f5f0' }}>{leads.length}</strong> leads
        </div>

        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setColMenuOpen(!colMenuOpen)}
            className="btn-ghost"
            style={{ padding: '4px 10px', fontSize: '11px', gap: '6px', color: '#8a8a85' }}
          >
            👁️ Toggle Columns
          </button>

          {colMenuOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                right: 0,
                width: '180px',
                background: '#1c1c20',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '10px',
                padding: '10px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#8a8a85', textTransform: 'uppercase' }}>Optional Columns</div>
              {optionalColsConfig.map(col => (
                <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#ededed', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={visibleCols[col.key]}
                    onChange={() => toggleColumn(col.key)}
                    style={{ accentColor: '#3ecf8e' }}
                  />
                  <span>{col.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead style={{ background: '#1a1a1a' }}>
            <tr>
              <th style={{ padding: '10px 16px', color: '#ededed', fontWeight: '500' }}>#</th>
              {visibleCols.hospital_name && <th style={{ padding: '10px 16px', color: '#ededed', fontWeight: '500' }}>Hospital Name</th>}
              {visibleCols.type && <th style={{ padding: '10px 16px', color: '#ededed', fontWeight: '500' }}>Type</th>}
              {visibleCols.rating && <th style={{ padding: '10px 16px', color: '#ededed', fontWeight: '500' }}>Rating</th>}
              {visibleCols.reviews && <th style={{ padding: '10px 16px', color: '#ededed', fontWeight: '500' }}>Reviews</th>}
              {visibleCols.phone && <th style={{ padding: '10px 16px', color: '#ededed', fontWeight: '500' }}>Phone</th>}
              {visibleCols.number_type && <th style={{ padding: '10px 16px', color: '#ededed', fontWeight: '500' }}>Number</th>}
              {visibleCols.website && <th style={{ padding: '10px 16px', color: '#ededed', fontWeight: '500' }}>Website</th>}
              {visibleCols.priority && <th style={{ padding: '10px 16px', color: '#ededed', fontWeight: '500' }}>Priority</th>}
              {visibleCols.stage && <th style={{ padding: '10px 16px', color: '#ededed', fontWeight: '500' }}>Stage</th>}
              {visibleCols.next_followup_due && <th style={{ padding: '10px 16px', color: '#ededed', fontWeight: '500' }}>Next Follow-Up</th>}
              {visibleCols.fb && <th style={{ padding: '10px 16px', color: '#ededed', fontWeight: '500' }}>FB</th>}
              {visibleCols.contacted && <th style={{ padding: '10px 16px', color: '#ededed', fontWeight: '500' }}>Contacted</th>}
              {visibleCols.reply && <th style={{ padding: '10px 16px', color: '#ededed', fontWeight: '500' }}>Reply</th>}
              {visibleCols.notes && <th style={{ padding: '10px 16px', color: '#ededed', fontWeight: '500' }}>Notes</th>}
              {customColumns.map(c => (
                <th key={c.id} style={{ padding: '10px 16px', color: '#ededed', fontWeight: '500' }}>{c.display_name}</th>
              ))}
              {(canWriteLeads(role) || canDeleteLeads(role)) && <th style={{ padding: '10px 16px' }} />}
            </tr>
          </thead>
          <tbody>
            {leads.map((lead, i) => (
              <tr key={lead.id || i} className="group">
                <td style={{ color: '#555' }}>{i + 1}</td>
                
                {visibleCols.hospital_name && (
                  <Cell id={`${i}-name`} textToCopy={lead.hospital_name}>
                    <div style={{ fontWeight: '500', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={lead.hospital_name}>
                      {lead.hospital_name}
                    </div>
                    {lead.address && (
                      <div style={{ fontSize: '11px', color: '#555', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={lead.address}>
                        {lead.address}
                      </div>
                    )}
                  </Cell>
                )}

                {visibleCols.type && (
                  <Cell id={`${i}-type`} textToCopy={lead.type} style={{ color: '#a0a0a0', whiteSpace: 'nowrap' }}>{lead.type || '—'}</Cell>
                )}

                {visibleCols.rating && (
                  <Cell id={`${i}-rating`} textToCopy={lead.rating?.toString()}>
                    <span style={{ color: '#facc15' }}>★</span>
                    <span style={{ marginLeft: '4px' }}>{lead.rating || '—'}</span>
                  </Cell>
                )}

                {visibleCols.reviews && (
                  <Cell id={`${i}-reviews`} textToCopy={lead.reviews?.toString()} style={{ color: '#a0a0a0' }}>
                    {lead.reviews || '—'}
                  </Cell>
                )}

                {visibleCols.phone && (
                  <Cell id={`${i}-phone`} textToCopy={lead.phone} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: '#a0a0a0', whiteSpace: 'nowrap' }}>
                    {lead.phone || '—'}
                  </Cell>
                )}

                {visibleCols.number_type && (
                  <Cell id={`${i}-number`} textToCopy={lead.number_type}><NumberBadge v={lead.number_type} /></Cell>
                )}

                {visibleCols.website && (
                  <Cell id={`${i}-web`} textToCopy={lead.has_website}><YesNo v={lead.has_website} /></Cell>
                )}

                {visibleCols.priority && (
                  <Cell id={`${i}-pri`} textToCopy={lead.priority}><PriorityBadge p={lead.priority} /></Cell>
                )}

                {visibleCols.stage && (
                  <Cell id={`${i}-stage`} textToCopy={lead.stage || 'New'}><StageBadge v={lead.stage} /></Cell>
                )}

                {visibleCols.next_followup_due && (
                  <Cell id={`${i}-due`} textToCopy={lead.next_followup_due}>
                    {lead.next_followup_due ? (
                      <span style={{ fontSize: '12px', color: '#3ecf8e', fontFamily: 'monospace' }}>
                        {new Date(lead.next_followup_due).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    ) : (
                      <span style={{ color: '#8a8a85', fontSize: '12px' }}>—</span>
                    )}
                  </Cell>
                )}

                {visibleCols.fb && (
                  <Cell id={`${i}-fb`} textToCopy={lead.fb_found}><FbBadge v={lead.fb_found} /></Cell>
                )}

                {visibleCols.contacted && (
                  <Cell id={`${i}-cont`} textToCopy={lead.contacted}><ContactedBadge v={lead.contacted} /></Cell>
                )}

                {visibleCols.reply && (
                  <Cell id={`${i}-rep`} textToCopy={lead.reply}><ReplyBadge v={lead.reply} /></Cell>
                )}

                {visibleCols.notes && (
                  <Cell id={`${i}-notes`} textToCopy={lead.notes} style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#555', fontSize: '12px' }} title={lead.notes}>
                    {lead.notes || '—'}
                  </Cell>
                )}

                {customColumns.map(c => (
                  <Cell id={`${i}-${c.column_name}`} key={c.id} textToCopy={lead[c.column_name]}>
                    {c.data_type === 'Yes/No' ? (
                      <YesNo v={lead[c.column_name]} />
                    ) : (
                      <span style={{ color: '#ededed', fontSize: '13px', whiteSpace: 'nowrap' }}>{lead[c.column_name] || '—'}</span>
                    )}
                  </Cell>
                ))}

                {(canWriteLeads(role) || canDeleteLeads(role)) && (
                  <td>
                    <div style={{ display: 'flex', gap: '12px', opacity: '0' }} className="actions">
                      {canWriteLeads(role) && (
                        <button onClick={() => onEdit(lead)} style={{ background: 'none', border: 'none', color: '#a0a0a0', cursor: 'pointer', fontSize: '12px', padding: '0' }}>Edit</button>
                      )}
                      {canDeleteLeads(role) && (
                        <button onClick={() => onDelete(lead)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '12px', padding: '0' }}>Delete</button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}