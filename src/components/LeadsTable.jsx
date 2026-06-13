function Badge({ text, type }) {
  const styles = {
    green: { background: 'rgba(62,207,142,0.12)', color: '#3ecf8e' },
    red: { background: 'rgba(248,113,113,0.12)', color: '#f87171' },
    yellow: { background: 'rgba(250,204,21,0.12)', color: '#facc15' },
    blue: { background: 'rgba(96,165,250,0.12)', color: '#60a5fa' },
    gray: { background: '#242424', color: '#555' },
  }
  return (
    <span style={{ ...styles[type] || styles.gray, display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '500', whiteSpace: 'nowrap' }}>
      {text || '—'}
    </span>
  )
}

function PriorityBadge({ p }) {
  if (p === 'High') return <Badge text="High" type="green" />
  if (p === 'Medium') return <Badge text="Medium" type="yellow" />
  return <Badge text="Low" type="red" />
}

function YesNo({ v }) {
  return <Badge text={v} type={v === 'Yes' ? 'green' : 'gray'} />
}

function NumberBadge({ v }) {
  if (v === 'Mobile ✅') return <Badge text="Mobile" type="blue" />
  if (v === 'Landline ⚠️') return <Badge text="Landline" type="yellow" />
  return <Badge text="No Number" type="red" />
}

export default function LeadsTable({ leads, customColumns = [], onEdit, onDelete }) {
  if (!leads.length) {
    return (
      <div style={{ textAlign: 'center', padding: '60px', color: '#555', fontSize: '13px' }}>
        No leads found
      </div>
    )
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {['#', 'Hospital Name', 'Type', 'Rating', 'Phone', 'Number', 'Website', 'Priority', 'FB', 'Contacted', 'Reply', 'Notes', ...customColumns.map(c => c.display_name), ''].map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {leads.map((lead, i) => (
            <tr key={i} className="group">
              <td style={{ color: '#555' }}>{i + 1}</td>
              <td>
                <div style={{ fontWeight: '500', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={lead.hospital_name}>
                  {lead.hospital_name}
                </div>
                {lead.address && (
                  <div style={{ fontSize: '11px', color: '#555', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={lead.address}>
                    {lead.address}
                  </div>
                )}
              </td>
              <td style={{ color: '#a0a0a0', whiteSpace: 'nowrap' }}>{lead.type || '—'}</td>
              <td>
                <span style={{ color: '#facc15' }}>★</span>
                <span style={{ marginLeft: '4px' }}>{lead.rating || '—'}</span>
              </td>
              <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: '#a0a0a0', whiteSpace: 'nowrap' }}>
                {lead.phone || '—'}
              </td>
              <td><NumberBadge v={lead.number_type} /></td>
              <td><YesNo v={lead.has_website} /></td>
              <td><PriorityBadge p={lead.priority} /></td>
              <td><YesNo v={lead.fb_found} /></td>
              <td><YesNo v={lead.contacted} /></td>
              <td>
                {lead.reply ? <Badge text={lead.reply} type={lead.reply === 'Yes' ? 'green' : lead.reply === 'Later' ? 'yellow' : 'red'} /> : <span style={{ color: '#555' }}>—</span>}
              </td>
              <td style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#555', fontSize: '12px' }} title={lead.notes}>
                {lead.notes || '—'}
              </td>
              {customColumns.map(c => (
                <td key={c.id}>
                  {c.data_type === 'Yes/No' && lead[c.column_name] ? (
                    <YesNo v={lead[c.column_name]} />
                  ) : (
                    <span style={{ color: '#ededed', fontSize: '13px', whiteSpace: 'nowrap' }}>{lead[c.column_name] || '—'}</span>
                  )}
                </td>
              ))}
              <td>
                <div style={{ display: 'flex', gap: '12px', opacity: '0' }} className="actions">
                  <button onClick={() => onEdit(lead)} style={{ background: 'none', border: 'none', color: '#a0a0a0', cursor: 'pointer', fontSize: '12px', padding: '0' }}>Edit</button>
                  <button onClick={() => onDelete(lead)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '12px', padding: '0' }}>Delete</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}