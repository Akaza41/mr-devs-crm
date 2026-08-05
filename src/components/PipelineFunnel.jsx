import React from 'react'

export default function PipelineFunnel({ leads = [], activeStageFilter = '', onSelectStage }) {
  const total = leads.length

  const stages = [
    { key: 'New', label: 'New Leads', color: '#333338', activeColor: '#8a8a85', badgeBg: 'rgba(255, 255, 255, 0.08)' },
    { key: 'Contacted', label: 'Contacted', color: 'rgba(59, 130, 246, 0.35)', activeColor: '#60a5fa', badgeBg: 'rgba(59, 130, 246, 0.15)' },
    { key: 'Interested', label: 'Interested', color: 'rgba(242, 184, 75, 0.45)', activeColor: '#f2b84b', badgeBg: 'rgba(242, 184, 75, 0.15)' },
    { key: 'Converted', label: 'Converted', color: '#3ecf8e', activeColor: '#3ecf8e', badgeBg: 'rgba(62, 207, 142, 0.2)' },
    { key: 'Lost', label: 'Lost', color: 'rgba(239, 68, 68, 0.35)', activeColor: '#f87171', badgeBg: 'rgba(239, 68, 68, 0.15)' },
  ]

  // Calculate counts for each stage
  const counts = stages.reduce((acc, stage) => {
    acc[stage.key] = leads.filter(l => {
      const s = l.stage || 'New'
      return s.toLowerCase() === stage.key.toLowerCase()
    }).length
    return acc
  }, {})

  return (
    <div style={{ background: '#1c1c20', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '24px', marginBottom: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.35)' }}>
      
      {/* Header Stat Summary */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h3 className="font-headline" style={{ fontSize: '15px', fontWeight: '700', color: '#f5f5f0', margin: 0, letterSpacing: '0.03em' }}>
            PIPELINE FUNNEL
          </h3>
          {activeStageFilter && (
            <button
              onClick={() => onSelectStage('')}
              style={{
                background: 'rgba(62, 207, 142, 0.12)',
                border: '1px solid rgba(62, 207, 142, 0.3)',
                color: '#3ecf8e',
                borderRadius: '6px',
                fontSize: '11px',
                padding: '3px 10px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              Filter: {activeStageFilter} ✕
            </button>
          )}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: '#8a8a85' }}>
          <span>Total Leads: <strong className="font-headline tabular-nums" style={{ color: '#f5f5f0', fontSize: '15px', fontWeight: '700' }}>{total}</strong></span>
          <span>Click stage to filter</span>
        </div>
      </div>

      {/* ── STAGE CARDS GRID ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '18px' }}>
        {stages.map(s => {
          const count = counts[s.key] || 0
          const pct = total > 0 ? Math.round((count / total) * 100) : 0
          const isSelected = activeStageFilter.toLowerCase() === s.key.toLowerCase()

          return (
            <div
              key={s.key}
              onClick={() => onSelectStage(isSelected ? '' : s.key)}
              style={{
                background: isSelected ? '#242428' : '#151518',
                border: isSelected ? `1.5px solid ${s.activeColor}` : '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '10px',
                padding: '14px 16px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{ fontSize: '11px', color: '#8a8a85', fontWeight: '500', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{s.label}</span>
                <span style={{ fontSize: '10px', opacity: 0.8 }}>{pct}%</span>
              </div>
              <div className="font-headline tabular-nums" style={{ fontSize: '24px', fontWeight: '800', color: isSelected ? s.activeColor : '#f5f5f0' }}>
                {count}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── PROPORTIONAL HORIZONTAL FUNNEL BAR ── */}
      <div
        style={{
          display: 'flex',
          height: '14px',
          width: '100%',
          background: '#151518',
          borderRadius: '8px',
          overflow: 'hidden',
          padding: '2px',
          gap: '2px',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}
      >
        {total === 0 ? (
          <div style={{ flex: 1, background: '#242428', borderRadius: '4px' }} title="No leads data" />
        ) : (
          stages.map(s => {
            const count = counts[s.key] || 0
            if (count === 0) return null
            const flexShare = count / total
            const isSelected = activeStageFilter.toLowerCase() === s.key.toLowerCase()

            return (
              <div
                key={s.key}
                onClick={() => onSelectStage(isSelected ? '' : s.key)}
                title={`${s.label}: ${count} leads (${Math.round(flexShare * 100)}%)`}
                style={{
                  flex: flexShare,
                  background: isSelected ? s.activeColor : s.color,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'flex 0.4s cubic-bezier(0.4, 0, 0.2, 1), background 0.2s ease',
                  boxShadow: isSelected ? `0 0 10px ${s.activeColor}` : 'none'
                }}
              />
            )
          })
        )}
      </div>

    </div>
  )
}
