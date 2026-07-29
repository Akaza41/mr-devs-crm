import React from 'react'

// ── EMPLOYEE ACTIVITY FEED ──
// Renders a timeline of the user's actions.
// This is a UI placeholder for Phase 4 where data will stream from activity_logs.
export default function EmployeeActivityFeed() {
  
  // Dummy data for Phase 3 layout building
  const placeholderEvents = [
    { id: 1, action: 'Lead Added', details: 'Added lead "St. Mary Hospital"', time: '2 hours ago' },
    { id: 2, action: 'Lead Edited', details: 'Updated priority for "City Clinic"', time: '4 hours ago' },
    { id: 3, action: 'Imported Excel', details: 'Imported 142 leads', time: '1 day ago' },
    { id: 4, action: 'Logged In', details: 'Session started', time: '1 day ago' }
  ]

  return (
    <div style={{ background: '#1a1a1a', border: '0.5px solid #2a2a2a', borderRadius: '12px', padding: '24px', marginTop: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0, fontSize: '15px', color: '#ededed', fontWeight: '500' }}>Recent Activity</h3>
        <span style={{ fontSize: '11px', color: '#555', background: '#141414', padding: '4px 8px', borderRadius: '12px', border: '0.5px solid #222' }}>
          Preview (Phase 4)
        </span>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {placeholderEvents.map((event, index) => (
          <div key={event.id} style={{ display: 'flex', gap: '16px' }}>
            
            {/* Timeline line and dot */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#3ecf8e', marginTop: '4px' }}></div>
              {index !== placeholderEvents.length - 1 && (
                <div style={{ width: '1px', flex: 1, background: '#2a2a2a', margin: '4px 0' }}></div>
              )}
            </div>

            {/* Event content */}
            <div style={{ paddingBottom: index === placeholderEvents.length - 1 ? 0 : '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: '500', color: '#ededed' }}>
                {event.action}
              </div>
              <div style={{ fontSize: '12px', color: '#a0a0a0', marginTop: '2px' }}>
                {event.details}
              </div>
              <div style={{ fontSize: '11px', color: '#555', marginTop: '4px' }}>
                {event.time}
              </div>
            </div>

          </div>
        ))}
      </div>
      
    </div>
  )
}
