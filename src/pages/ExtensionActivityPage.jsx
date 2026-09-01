import { useState, useEffect, useMemo } from 'react'
import { db } from '../lib/firebase'
import { collection, getDocs, query } from 'firebase/firestore'

export default function ExtensionActivityPage({ onBack }) {
  const [loading, setLoading] = useState(true)
  const [profiles, setProfiles] = useState([])
  const [outreachEvents, setOutreachEvents] = useState([])
  const [manualTouches, setManualTouches] = useState([])
  const [filterRep, setFilterRep] = useState('ALL')
  const [filterTimeframe, setFilterTimeframe] = useState('TODAY')

  const fetchAccountabilityData = async () => {
    try {
      // 1. Fetch team profiles
      const profSnap = await getDocs(collection(db, 'users'))
      const profs = profSnap.docs.map(d => ({ id: d.id, ...d.data(), full_name: d.data().displayName || d.data().email }))

      // 2. Fetch outreach events from extension
      let events = []
      try {
        const evSnap = await getDocs(collection(db, 'outreach_events'))
        events = evSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      } catch (e) {
        console.warn('outreach_events collection query:', e.message)
      }

      // 3. Fetch manual outreach touches
      let touches = []
      try {
        const touchSnap = await getDocs(collection(db, 'outreach_touches'))
        touches = touchSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      } catch (e) {
        console.warn('outreach_touches collection query:', e.message)
      }

      setProfiles(profs || [])
      setOutreachEvents(events || [])
      setManualTouches(touches || [])
    } catch (err) {
      console.error('Error fetching extension activity data from Firestore:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAccountabilityData()
  }, [])

  // Filter events and touches based on timeframe
  const { filteredEvents, filteredTouches } = useMemo(() => {
    const now = new Date()
    let startDate = new Date(0)

    if (filterTimeframe === 'TODAY') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    } else if (filterTimeframe === 'WEEK') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    }

    const events = outreachEvents.filter(e => {
      const matchTime = new Date(e.created_at) >= startDate
      const matchRep = filterRep === 'ALL' || e.user_id === filterRep
      return matchTime && matchRep
    })

    const touches = manualTouches.filter(t => {
      const matchTime = new Date(t.created_at) >= startDate
      const matchRep = filterRep === 'ALL' || t.user_id === filterRep
      return matchTime && matchRep
    })

    return { filteredEvents: events, filteredTouches: touches }
  }, [outreachEvents, manualTouches, filterTimeframe, filterRep])

  // Compute stats per rep
  const repStats = useMemo(() => {
    const map = {}

    profiles.forEach(p => {
      map[p.id] = {
        id: p.id,
        name: p.full_name || p.email,
        email: p.email,
        avatar: p.avatar_url,
        manualCount: 0,
        extensionCount: 0,
        matchedExtensionCount: 0,
        unmatchedExtensionCount: 0
      }
    })

    filteredTouches.forEach(t => {
      if (t.user_id && map[t.user_id]) {
        map[t.user_id].manualCount++
      }
    })

    filteredEvents.forEach(e => {
      if (e.user_id && map[e.user_id]) {
        map[e.user_id].extensionCount++
        if (e.lead_id) {
          map[e.user_id].matchedExtensionCount++
        } else {
          map[e.user_id].unmatchedExtensionCount++
        }
      }
    })

    return Object.values(map)
  }, [profiles, filteredTouches, filteredEvents])

  // Total summary metrics
  const totalExtensionEvents = filteredEvents.length
  const totalManualTouches = filteredTouches.length
  const totalMatchedEvents = filteredEvents.filter(e => e.lead_id).length
  const totalUnmatchedEvents = filteredEvents.filter(e => !e.lead_id).length

  return (
    <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto', color: '#f5f5f0' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          {onBack && (
            <button 
              onClick={onBack}
              style={{ background: 'none', border: 'none', color: '#8a8a85', cursor: 'pointer', fontSize: '13px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span>←</span> Back
            </button>
          )}
          <h1 className="font-headline" style={{ fontSize: '24px', fontWeight: '700', margin: 0, color: '#f5f5f0' }}>
            Extension Outreach Verification
          </h1>
          <p style={{ fontSize: '13px', color: '#8a8a85', marginTop: '4px', margin: 0 }}>
            Audit auto-captured extension events against rep manual touch logs for full accountability.
          </p>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <select
            className="input-base"
            value={filterTimeframe}
            onChange={e => setFilterTimeframe(e.target.value)}
            style={{ fontSize: '12px', padding: '6px 12px' }}
          >
            <option value="TODAY">Today</option>
            <option value="WEEK">Last 7 Days</option>
            <option value="ALL">All Time</option>
          </select>

          <select
            className="input-base"
            value={filterRep}
            onChange={e => setFilterRep(e.target.value)}
            style={{ fontSize: '12px', padding: '6px 12px' }}
          >
            <option value="ALL">All Sales Reps</option>
            {profiles.map(p => (
              <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '16px', background: '#161616', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}>
          <div style={{ fontSize: '11px', color: '#8a8a85', textTransform: 'uppercase', fontWeight: '600' }}>Extension Verified</div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#3ecf8e', marginTop: '6px' }}>{totalExtensionEvents}</div>
          <div style={{ fontSize: '11px', color: '#8a8a85', marginTop: '4px' }}>Auto-captured outreach</div>
        </div>

        <div className="card" style={{ padding: '16px', background: '#161616', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}>
          <div style={{ fontSize: '11px', color: '#8a8a85', textTransform: 'uppercase', fontWeight: '600' }}>Manual Touch Logs</div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#60a5fa', marginTop: '6px' }}>{totalManualTouches}</div>
          <div style={{ fontSize: '11px', color: '#8a8a85', marginTop: '4px' }}>Logged in CRM UI</div>
        </div>

        <div className="card" style={{ padding: '16px', background: '#161616', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}>
          <div style={{ fontSize: '11px', color: '#8a8a85', textTransform: 'uppercase', fontWeight: '600' }}>Matched to Leads</div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#facc15', marginTop: '6px' }}>{totalMatchedEvents}</div>
          <div style={{ fontSize: '11px', color: '#8a8a85', marginTop: '4px' }}>Linked to lead records</div>
        </div>

        <div className="card" style={{ padding: '16px', background: '#161616', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}>
          <div style={{ fontSize: '11px', color: '#8a8a85', textTransform: 'uppercase', fontWeight: '600' }}>Unmatched Outreach</div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#8a8a85', marginTop: '6px' }}>{totalUnmatchedEvents}</div>
          <div style={{ fontSize: '11px', color: '#8a8a85', marginTop: '4px' }}>Emails not in leads DB</div>
        </div>
      </div>

      {/* Rep Accountability Table */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#f5f5f0', marginBottom: '14px' }}>
          Rep Verification & Audit Comparison
        </h2>

        <div style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#1a1a1a', borderBottom: '1px solid rgba(255,255,255,0.08)', textTransform: 'uppercase', fontSize: '11px', color: '#8a8a85' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Sales Representative</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Manual Touch Logs</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Extension Verified</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Matched Leads</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Accountability Signal</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#8a8a85' }}>Loading accountability metrics...</td>
                </tr>
              ) : repStats.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#8a8a85' }}>No sales rep data found.</td>
                </tr>
              ) : (
                repStats.map(rep => {
                  const diff = rep.manualCount - rep.extensionCount
                  let signalBadge = { text: '🟢 Verified Alignment', bg: 'rgba(62,207,142,0.12)', color: '#3ecf8e' }

                  if (rep.manualCount > 0 && rep.extensionCount === 0) {
                    signalBadge = { text: '🔴 Unverified Manual Logs', bg: 'rgba(248,113,113,0.15)', color: '#f87171' }
                  } else if (diff > 3) {
                    signalBadge = { text: '🟡 Divergence Flag', bg: 'rgba(250,204,21,0.15)', color: '#facc15' }
                  }

                  return (
                    <tr key={rep.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#232323', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '600', overflow: 'hidden' }}>
                            {rep.avatar ? <img src={rep.avatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : rep.name.charAt(0)}
                          </div>
                          <div>
                            <div style={{ fontWeight: '600', color: '#f5f5f0' }}>{rep.name}</div>
                            <div style={{ fontSize: '11px', color: '#8a8a85' }}>{rep.email}</div>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#60a5fa' }}>
                        {rep.manualCount}
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#3ecf8e' }}>
                        {rep.extensionCount}
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'center', color: '#facc15' }}>
                        {rep.matchedExtensionCount} ({rep.unmatchedExtensionCount} unmatched)
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ background: signalBadge.bg, color: signalBadge.color, padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', display: 'inline-block' }}>
                          {signalBadge.text}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Extension Event Stream */}
      <section>
        <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#f5f5f0', marginBottom: '14px' }}>
          Auto-Captured Extension Activity Stream ({filteredEvents.length})
        </h2>

        <div style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px' }}>
          {filteredEvents.length === 0 ? (
            <div style={{ color: '#8a8a85', fontSize: '13px', padding: '16px 0', textAlign: 'center' }}>
              No extension outreach events captured for this timeframe yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredEvents.map(e => {
                const rep = profiles.find(p => p.id === e.user_id)
                const repNameStr = rep ? (rep.full_name || rep.email) : 'Sales Rep'
                const payload = e.payload || {}
                const isMatched = !payload.unmatched
                const dateStr = new Date(e.created_at).toLocaleString()

                return (
                  <div key={e.id} style={{ background: '#151518', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '20px' }}>📧</span>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#f5f5f0' }}>
                          Gmail Sent by <span style={{ color: '#3ecf8e' }}>{repNameStr}</span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#8a8a85', marginTop: '2px' }}>
                          To: <strong style={{ color: '#ededed' }}>{payload.recipient_email || 'Recipient'}</strong> • Subject: "{payload.subject_line || 'No Subject'}"
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '11px', background: isMatched ? 'rgba(62,207,142,0.12)' : 'rgba(250,204,21,0.12)', color: isMatched ? '#3ecf8e' : '#facc15', padding: '2px 8px', borderRadius: '4px', fontWeight: '600' }}>
                        {isMatched ? '✓ Matched Lead' : '⚠️ Unmatched'}
                      </span>
                      <div style={{ fontSize: '10px', color: '#8a8a85', marginTop: '4px' }}>{dateStr}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

    </div>
  )
}
