// ── EMPLOYEE STATS CARDS ──
// Renders professional SaaS dashboard metrics for the employee
// using real data aggregated from the activity_logs table.
export default function EmployeeStatsCards({ member }) {
  const metrics = member?.metrics

  // Fallback defaults if no activity logs exist yet
  const leadsAdded = metrics?.leads_added || 0
  const leadsEdited = metrics?.leads_edited || 0
  const projectsWorkedOn = metrics?.projects_worked_on || 0
  const totalActions = metrics?.total_actions || 0
  
  // Calculate if online (active within 15 minutes)
  const isOnline = metrics?.last_active && (new Date() - new Date(metrics.last_active)) < 15 * 60 * 1000
  const statusText = isOnline ? 'Online Now' : (metrics?.last_active ? new Date(metrics.last_active).toLocaleString() : 'Never')

  const stats = [
    { label: 'Leads Created', value: leadsAdded, subtext: 'Total leads sourced' },
    { label: 'Leads Updated', value: leadsEdited, subtext: 'Total leads modified' },
    { label: 'Projects Worked On', value: projectsWorkedOn, subtext: 'Distinct projects' },
    { label: 'Total Activity', value: totalActions, subtext: `Last active: ${statusText}` }
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginTop: '24px' }}>
      {stats.map((stat, i) => (
        <div key={i} style={{ background: '#1a1a1a', border: '0.5px solid #2a2a2a', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '12px', color: '#a0a0a0', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {stat.label}
          </div>
          <div style={{ fontSize: '24px', color: stat.highlight ? '#3ecf8e' : '#ededed', fontWeight: '600', marginTop: '8px' }}>
            {stat.value}
          </div>
          <div style={{ fontSize: '11px', color: '#555', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {stat.subtext}
          </div>
        </div>
      ))}
    </div>
  )
}

