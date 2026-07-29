import React from 'react'

// ── EMPLOYEE STATS CARDS ──
// Renders professional SaaS dashboard metrics for the employee.
// In Phase 3, these simply display placeholders to reserve the layout.
export default function EmployeeStatsCards() {
  
  const stats = [
    { label: 'Hours Worked', value: '--', subtext: 'Coming in Phase 4' },
    { label: 'Leads Added', value: '--', subtext: 'No data yet' },
    { label: 'Leads Edited', value: '--', subtext: 'No data yet' },
    { label: 'Total Imports', value: '--', subtext: 'No data yet' },
    { label: 'Last Login', value: '--', subtext: 'Coming in Phase 4' }
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginTop: '24px' }}>
      {stats.map((stat, i) => (
        <div key={i} style={{ background: '#1a1a1a', border: '0.5px solid #2a2a2a', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '12px', color: '#a0a0a0', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {stat.label}
          </div>
          <div style={{ fontSize: '28px', color: '#ededed', fontWeight: '600', marginTop: '8px' }}>
            {stat.value}
          </div>
          <div style={{ fontSize: '11px', color: '#555', marginTop: '4px' }}>
            {stat.subtext}
          </div>
        </div>
      ))}
    </div>
  )
}
