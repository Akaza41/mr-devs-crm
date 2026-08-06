import React from 'react'

export default function PipelineFunnel({ leads = [], activeStageFilter = '', onSelectStage }) {
  const total = leads.length

  const stages = [
    { key: 'New', label: 'New', color: '#333338', activeColor: '#8a8a85' },
    { key: 'Contacted', label: 'Contacted', color: 'rgba(59, 130, 246, 0.35)', activeColor: '#60a5fa' },
    { key: 'Interested', label: 'Interested', color: 'rgba(242, 184, 75, 0.45)', activeColor: '#f2b84b' },
    { key: 'Converted', label: 'Converted', color: 'rgba(62, 207, 142, 0.45)', activeColor: '#3ecf8e' },
    { key: 'Lost', label: 'Lost', color: 'rgba(239, 68, 68, 0.35)', activeColor: '#f87171' },
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
    <div
      style={{
        background: '#1c1c20',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '12px 18px',
        marginBottom: '20px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}
    >
      {/* Sleek Compact Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#8a8a85', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            PIPELINE FUNNEL
          </span>
          <span style={{ fontSize: '11px', color: '#555' }}>
            ({total} Total)
          </span>
        </div>

        {activeStageFilter ? (
          <button
            onClick={() => onSelectStage('')}
            style={{
              background: 'rgba(62, 207, 142, 0.12)',
              border: '1px solid rgba(62, 207, 142, 0.3)',
              color: '#3ecf8e',
              borderRadius: '4px',
              fontSize: '11px',
              padding: '2px 8px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            Stage: {activeStageFilter} ✕
          </button>
        ) : (
          <span style={{ fontSize: '11px', color: '#666' }}>Click stage to filter</span>
        )}
      </div>

      {/* ── SINGLE COMPACT HORIZONTAL FUNNEL STRIP ── */}
      <div
        style={{
          display: 'flex',
          gap: '6px',
          width: '100%',
          alignItems: 'center'
        }}
      >
        {stages.map(s => {
          const count = counts[s.key] || 0
          const pct = total > 0 ? Math.round((count / total) * 100) : 0
          const isSelected = activeStageFilter.toLowerCase() === s.key.toLowerCase()

          return (
            <button
              key={s.key}
              type="button"
              onClick={() => onSelectStage(isSelected ? '' : s.key)}
              title={`${s.label}: ${count} (${pct}%)`}
              style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                borderRadius: '6px',
                background: isSelected ? s.color : '#151518',
                border: isSelected ? `1.5px solid ${s.activeColor}` : '1px solid rgba(255, 255, 255, 0.06)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                userSelect: 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: s.activeColor,
                  flexShrink: 0
                }} />
                <span style={{
                  fontSize: '11px',
                  fontWeight: isSelected ? '700' : '500',
                  color: isSelected ? s.activeColor : '#ededed',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {s.label}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                <span className="font-headline tabular-nums" style={{
                  fontSize: '12px',
                  fontWeight: '700',
                  color: isSelected ? s.activeColor : '#f5f5f0'
                }}>
                  {count}
                </span>
                <span style={{ fontSize: '10px', color: '#777' }}>
                  ({pct}%)
                </span>
              </div>
            </button>
          )
        })}
      </div>

    </div>
  )
}
