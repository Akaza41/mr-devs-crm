import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { formatActivityDetails } from '../../lib/activityFormatter'

// ── EMPLOYEE ACTIVITY FEED ──
// Renders a timeline of the user's actions by fetching from activity_logs.
// Uses cursor-based pagination (by created_at) to scale efficiently.
export default function EmployeeActivityFeed({ userId }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState(null)

  const BATCH_SIZE = 20

  useEffect(() => {
    if (userId) {
      fetchInitialLogs()
    }
  }, [userId])

  const fetchInitialLogs = async () => {
    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from('activity_logs')
      .select('id, created_at, action, entity_type, entity_id, metadata')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(BATCH_SIZE)

    if (fetchError) {
      setError('Failed to load activity logs.')
      console.error('[EmployeeActivityFeed]', fetchError)
    } else {
      setLogs(data || [])
      setHasMore((data || []).length === BATCH_SIZE)
    }
    
    setLoading(false)
  }

  const loadMore = async () => {
    if (!hasMore || logs.length === 0 || loadingMore) return

    setLoadingMore(true)
    // Use the created_at of the oldest loaded log as the cursor
    const lastCursor = logs[logs.length - 1].created_at

    const { data, error: fetchError } = await supabase
      .from('activity_logs')
      .select('id, created_at, action, entity_type, entity_id, metadata')
      .eq('user_id', userId)
      .lt('created_at', lastCursor)
      .order('created_at', { ascending: false })
      .limit(BATCH_SIZE)

    if (fetchError) {
      console.error('[EmployeeActivityFeed] Load more error:', fetchError)
      // Optionally show a toast here instead of breaking the UI
    } else {
      const newLogs = data || []
      setLogs(prev => [...prev, ...newLogs])
      setHasMore(newLogs.length === BATCH_SIZE)
    }

    setLoadingMore(false)
  }

  // Format a timestamp nicely (e.g. "Today at 2:30 PM", or full date)
  const formatTime = (isoString) => {
    const d = new Date(isoString)
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit'
    }).format(d)
  }

  if (loading) {
    return (
      <div style={{ background: '#1a1a1a', border: '0.5px solid #2a2a2a', borderRadius: '12px', padding: '24px', marginTop: '24px', textAlign: 'center' }}>
        <div style={{ color: '#555', fontSize: '13px' }}>Loading activity...</div>
      </div>
    )
  }

  return (
    <div style={{ background: '#1a1a1a', border: '0.5px solid #2a2a2a', borderRadius: '12px', padding: '24px', marginTop: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0, fontSize: '15px', color: '#ededed', fontWeight: '500' }}>Activity Timeline</h3>
      </div>
      
      {error && (
        <div style={{ color: '#f87171', fontSize: '13px', marginBottom: '16px' }}>{error}</div>
      )}

      {logs.length === 0 && !error ? (
        <div style={{ padding: '30px 0', textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>📭</div>
          <div style={{ fontSize: '13px', color: '#a0a0a0' }}>No recent activity recorded for this employee.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {logs.map((log, index) => {
            const { title, details } = formatActivityDetails(log)
            
            return (
              <div key={log.id} style={{ display: 'flex', gap: '16px' }}>
                
                {/* Timeline line and dot */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#3ecf8e', marginTop: '4px' }}></div>
                  {index !== logs.length - 1 && (
                    <div style={{ width: '1px', flex: 1, background: '#2a2a2a', margin: '4px 0' }}></div>
                  )}
                </div>

                {/* Event content */}
                <div style={{ paddingBottom: index === logs.length - 1 ? 0 : '12px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: '#ededed' }}>
                    {title}
                  </div>
                  <div style={{ fontSize: '12px', color: '#a0a0a0', marginTop: '2px' }}>
                    {details}
                  </div>
                  <div style={{ fontSize: '11px', color: '#555', marginTop: '4px' }}>
                    {formatTime(log.created_at)}
                  </div>
                </div>

              </div>
            )
          })}
        </div>
      )}

      {hasMore && (
        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
          <button 
            className="btn-ghost" 
            onClick={loadMore} 
            disabled={loadingMore}
            style={{ fontSize: '12px', padding: '6px 12px' }}
          >
            {loadingMore ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
      
    </div>
  )
}
