import React, { useState, useEffect } from 'react'
import { db } from '../../lib/firebase'
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore'
import { formatActivityDetails } from '../../lib/activityFormatter'

// ── EMPLOYEE ACTIVITY FEED ──
// Renders a timeline of the user's actions by fetching from activity_logs in Firestore.
export default function EmployeeActivityFeed({ userId }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
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

    try {
      const qLogs = query(
        collection(db, 'activity_logs'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(BATCH_SIZE)
      )
      const snapshot = await getDocs(qLogs)
      const data = snapshot.docs.map(doc => {
        const d = doc.data()
        return {
          id: doc.id,
          created_at: d.createdAt ? new Date(d.createdAt.seconds * 1000).toISOString() : new Date().toISOString(),
          action: d.action || 'unknown',
          entity_type: d.entityType || 'system',
          entity_id: d.entityId || null,
          metadata: d.metadata || {}
        }
      })
      setLogs(data)
    } catch (fetchError) {
      console.warn('[EmployeeActivityFeed] Firestore query fallback (without index):', fetchError.message)
      // Fallback query without orderBy if index is still building
      try {
        const qFallback = query(
          collection(db, 'activity_logs'),
          where('userId', '==', userId),
          limit(BATCH_SIZE)
        )
        const snapshot = await getDocs(qFallback)
        const data = snapshot.docs.map(doc => {
          const d = doc.data()
          return {
            id: doc.id,
            created_at: d.createdAt ? new Date(d.createdAt.seconds * 1000).toISOString() : new Date().toISOString(),
            action: d.action || 'unknown',
            entity_type: d.entityType || 'system',
            entity_id: d.entityId || null,
            metadata: d.metadata || {}
          }
        })
        setLogs(data)
      } catch (err) {
        setError('Failed to load activity logs.')
      }
    } finally {
      setLoading(false)
    }
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
      
    </div>
  )
}
