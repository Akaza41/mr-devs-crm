export default function StatsBar({ leads }) {
  const total = leads.length
  const contacted = leads.filter(l => l.contacted === 'Yes').length
  const replied = leads.filter(l => l.reply === 'Yes').length
  const highRemaining = leads.filter(l => l.priority === 'High' && l.contacted === 'No').length

  const stats = [
    { label: 'Total Leads', value: total, color: '#ededed' },
    { label: 'Contacted', value: contacted, color: '#3ecf8e' },
    { label: 'Replied', value: replied, color: '#facc15' },
    { label: 'High Priority Left', value: highRemaining, color: '#f87171' },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
      {stats.map(s => (
        <div key={s.label} style={{ background: '#1a1a1a', border: '0.5px solid #2a2a2a', borderRadius: '8px', padding: '16px 20px' }}>
          <div style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            {s.label}
          </div>
          <div style={{ fontSize: '26px', fontWeight: '600', color: s.color }}>
            {s.value}
          </div>
        </div>
      ))}
    </div>
  )
}