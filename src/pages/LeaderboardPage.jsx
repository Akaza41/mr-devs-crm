import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

function getAvatarInitial(fullName, email) {
  if (fullName && fullName.trim()) return fullName.trim().charAt(0).toUpperCase()
  if (email && email.includes('@')) return email.split('@')[0].charAt(0).toUpperCase()
  if (email) return email.charAt(0).toUpperCase()
  return '?'
}

export default function LeaderboardPage({ onlineUserIds = new Set(), onBack }) {
  const [leaderboard, setLeaderboard] = useState([])
  const [timeframe, setTimeframe] = useState('all') // 'week' | 'month' | 'all'
  const [sortBy, setSortBy] = useState('conversion_rate') // 'conversion_rate' | 'avg_research_score' | 'leads_contacted'
  const [loading, setLoading] = useState(true)

  const fetchLeaderboard = async () => {
    const { data, error } = await supabase.rpc('get_team_metrics')

    if (!error && data) {
      setLeaderboard(data)
    } else {
      // Fallback query if RPC returns empty or building
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, role')
        .eq('status', 'active')

      if (profiles) {
        setLeaderboard(profiles.map(p => ({
          user_id: p.id,
          full_name: p.full_name,
          email: p.email,
          avatar_url: p.avatar_url,
          role: p.role,
          leads_assigned: 0,
          leads_contacted: 0,
          leads_converted: 0,
          conversion_rate: 0,
          avg_research_score: 0,
          total_actions: 0
        })))
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchLeaderboard()
  }, [])

  // Determine if there is any real sales activity logged
  const hasRealActivity = leaderboard.some(
    r => Number(r.leads_contacted || 0) > 0 || Number(r.leads_converted || 0) > 0 || Number(r.total_actions || 0) > 0
  )

  // Sort leaderboard dynamically
  const sortedLeaderboard = useMemo(() => {
    if (!hasRealActivity) return []
    return [...leaderboard].sort((a, b) => {
      if (sortBy === 'conversion_rate') {
        if (b.conversion_rate !== a.conversion_rate) return b.conversion_rate - a.conversion_rate
        return b.leads_converted - a.leads_converted
      }
      if (sortBy === 'avg_research_score') return b.avg_research_score - a.avg_research_score
      if (sortBy === 'leads_contacted') return b.leads_contacted - a.leads_contacted
      return 0
    })
  }, [leaderboard, sortBy, hasRealActivity])

  // Compute overall team totals
  const teamTotals = useMemo(() => {
    const totalContacted = leaderboard.reduce((sum, r) => sum + Number(r.leads_contacted || 0), 0)
    const totalConverted = leaderboard.reduce((sum, r) => sum + Number(r.leads_converted || 0), 0)
    const avgRate = totalContacted > 0 ? ((totalConverted / totalContacted) * 100).toFixed(1) : '0.0'
    const activeScored = leaderboard.filter(r => Number(r.avg_research_score || 0) > 0)
    const avgScore = activeScored.length > 0 
      ? (activeScored.reduce((sum, r) => sum + Number(r.avg_research_score || 0), 0) / activeScored.length).toFixed(1) 
      : '0.0'

    return { totalContacted, totalConverted, avgRate, avgScore }
  }, [leaderboard])

  const topThree = sortedLeaderboard.slice(0, 3)

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '28px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {onBack && (
            <button onClick={onBack} style={{ background: '#242428', border: '1px solid rgba(255,255,255,0.08)', color: '#8a8a85', cursor: 'pointer', fontSize: '14px', padding: '6px 12px', borderRadius: '8px' }}>
              ← Back
            </button>
          )}
          <div>
            <h1 className="font-headline" style={{ fontSize: '22px', fontWeight: '800', color: '#f5f5f0', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>🏆</span> SALES LEADERBOARD
            </h1>
            <p style={{ fontSize: '13px', color: '#8a8a85', margin: '4px 0 0 0' }}>
              Performance ranking based on live conversion rates, research scores, and deal activity.
            </p>
          </div>
        </div>

        {/* Timeframe & Sort Filters */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ background: '#1c1c20', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '4px', display: 'flex', gap: '2px' }}>
            <button
              onClick={() => setTimeframe('all')}
              style={{
                background: timeframe === 'all' ? '#242428' : 'transparent',
                border: 'none',
                color: timeframe === 'all' ? '#3ecf8e' : '#8a8a85',
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer',
                fontWeight: timeframe === 'all' ? '600' : '400'
              }}
            >
              All Time
            </button>
            <button
              onClick={() => setTimeframe('month')}
              style={{
                background: timeframe === 'month' ? '#242428' : 'transparent',
                border: 'none',
                color: timeframe === 'month' ? '#3ecf8e' : '#8a8a85',
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer',
                fontWeight: timeframe === 'month' ? '600' : '400'
              }}
            >
              This Month
            </button>
          </div>

          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="input-base"
            style={{ width: 'auto', fontSize: '12px', padding: '7px 12px' }}
          >
            <option value="conversion_rate">Sort by Conversion Rate</option>
            <option value="avg_research_score">Sort by Avg Research Score</option>
            <option value="leads_contacted">Sort by Contacted Leads</option>
          </select>
        </div>
      </div>

      {/* ── TEAM SUMMARY STAT CARDS (Increased Padding & Spacious Layout) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="card" style={{ padding: '20px 24px' }}>
          <div style={{ fontSize: '11px', color: '#8a8a85', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', fontWeight: '600' }}>Team Contacted</div>
          <div className="font-headline tabular-nums" style={{ fontSize: '28px', fontWeight: '800', color: '#f5f5f0' }}>{teamTotals.totalContacted}</div>
        </div>

        <div className="card" style={{ padding: '20px 24px' }}>
          <div style={{ fontSize: '11px', color: '#8a8a85', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', fontWeight: '600' }}>Team Converted</div>
          <div className="font-headline tabular-nums" style={{ fontSize: '28px', fontWeight: '800', color: '#3ecf8e' }}>{teamTotals.totalConverted}</div>
        </div>

        <div className="card" style={{ padding: '20px 24px' }}>
          <div style={{ fontSize: '11px', color: '#8a8a85', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', fontWeight: '600' }}>Avg Conversion Rate</div>
          <div className="font-headline tabular-nums" style={{ fontSize: '28px', fontWeight: '800', color: '#f2b84b' }}>{teamTotals.avgRate}%</div>
        </div>

        <div className="card" style={{ padding: '20px 24px' }}>
          <div style={{ fontSize: '11px', color: '#8a8a85', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', fontWeight: '600' }}>Avg Research Score</div>
          <div className="font-headline tabular-nums" style={{ fontSize: '28px', fontWeight: '800', color: '#60a5fa' }}>{teamTotals.avgScore}/100</div>
        </div>
      </div>

      {/* ── TOP 3 PODIUM CARDS (Gold/Amber Accent Motif & Real Data Only) ── */}
      {!loading && hasRealActivity && topThree.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px', marginTop: '4px' }}>
          {topThree.map((rep, idx) => {
            const badges = ['🥇 1ST PLACE', '🥈 2ND PLACE', '🥉 3RD PLACE']
            const borderColors = ['#f2b84b', '#cbd5e1', '#e08a4e'] // Gold / Silver / Bronze
            const badgeBgs = ['rgba(242,184,75,0.15)', 'rgba(203,213,225,0.15)', 'rgba(224,138,78,0.15)']
            const avatarChar = getAvatarInitial(rep.full_name, rep.email)

            return (
              <div
                key={rep.user_id}
                style={{
                  background: '#1c1c20',
                  border: `1.5px solid ${borderColors[idx]}`,
                  borderRadius: '14px',
                  padding: '24px',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: `0 10px 30px -5px ${borderColors[idx]}25, 0 0 0 1px rgba(255,255,255,0.05)`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: borderColors[idx], background: badgeBgs[idx], padding: '4px 12px', borderRadius: '12px', letterSpacing: '0.04em' }}>
                    {badges[idx]}
                  </span>
                  <span style={{ fontSize: '11px', color: '#8a8a85', textTransform: 'capitalize', fontWeight: '500' }}>{rep.role}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
                  <div style={{ position: 'relative', width: '48px', height: '48px', borderRadius: '50%', background: '#242428', border: `1px solid ${borderColors[idx]}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '700', color: '#f5f5f0' }}>
                    {rep.avatar_url ? (
                      <img src={rep.avatar_url} alt={rep.full_name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      avatarChar
                    )}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '0px',
                        right: '0px',
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        background: (onlineUserIds.has(rep.user_id) || (rep.last_active && (new Date() - new Date(rep.last_active)) < 15 * 60 * 1000)) ? '#3ecf8e' : '#555',
                        border: '1.5px solid #1c1c20'
                      }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: '#f5f5f0' }}>{rep.full_name || rep.email}</div>
                    <div style={{ fontSize: '12px', color: '#8a8a85' }}>{rep.email}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#151518', borderRadius: '10px', padding: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div>
                    <div style={{ fontSize: '10px', color: '#8a8a85', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Conversion Rate</div>
                    <div className="font-headline tabular-nums" style={{ fontSize: '20px', fontWeight: '800', color: '#3ecf8e', marginTop: '2px' }}>
                      {rep.conversion_rate}%
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '10px', color: '#8a8a85', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Avg Research</div>
                    <div className="font-headline tabular-nums" style={{ fontSize: '20px', fontWeight: '800', color: '#60a5fa', marginTop: '2px' }}>
                      {rep.avg_research_score}/100
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── LEADERBOARD TABLE / HONEST EMPTY STATE ── */}
      <div className="table-wrap">
        <table style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: '70px', textAlign: 'center' }}>Rank</th>
              <th>Sales Rep</th>
              <th>Leads Contacted</th>
              <th>Leads Converted</th>
              <th>Conversion Rate</th>
              <th>Avg Research Score</th>
              <th>Total Activity</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '48px', color: '#8a8a85' }}>Loading leaderboard standings...</td>
              </tr>
            ) : !hasRealActivity ? (
              /* HONEST EMPTY STATE — Replaces hardcoded/mock placeholder rows */
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '56px 24px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '32px' }}>📊</span>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#f5f5f0' }}>No sales activity yet</div>
                    <div style={{ fontSize: '13px', color: '#8a8a85', maxWidth: '420px', lineHeight: '1.5' }}>
                      Leaderboard will populate as your team logs calls and converts leads.
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              sortedLeaderboard.map((rep, idx) => {
                const rankIcons = ['🥇', '🥈', '🥉']
                const rankIcon = rankIcons[idx] || `#${idx + 1}`
                const avatarChar = getAvatarInitial(rep.full_name, rep.email)
                const isGold = idx === 0

                return (
                  <tr key={rep.user_id}>
                    <td style={{ textAlign: 'center', fontWeight: '700', fontSize: '14px', color: isGold ? '#f2b84b' : idx < 3 ? '#3ecf8e' : '#8a8a85' }}>
                      {rankIcon}
                    </td>

                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ position: 'relative', width: '34px', height: '34px', borderRadius: '50%', background: '#242428', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '700', color: '#f5f5f0' }}>
                          {rep.avatar_url ? (
                            <img src={rep.avatar_url} alt={rep.full_name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                          ) : (
                            avatarChar
                          )}
                          <div
                            style={{
                              position: 'absolute',
                              bottom: '-1px',
                              right: '-1px',
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: (onlineUserIds.has(rep.user_id) || (rep.last_active && (new Date() - new Date(rep.last_active)) < 15 * 60 * 1000)) ? '#3ecf8e' : '#555',
                              border: '1.5px solid #151518'
                            }}
                          />
                        </div>
                        <div>
                          <div style={{ fontWeight: '600', color: '#f5f5f0', fontSize: '13px' }}>{rep.full_name || rep.email}</div>
                          <div style={{ fontSize: '11px', color: '#8a8a85', textTransform: 'capitalize' }}>{rep.role}</div>
                        </div>
                      </div>
                    </td>

                    <td className="font-headline tabular-nums" style={{ fontWeight: '600' }}>
                      {rep.leads_contacted}
                    </td>

                    <td className="font-headline tabular-nums" style={{ fontWeight: '600', color: '#3ecf8e' }}>
                      {rep.leads_converted}
                    </td>

                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '70px', height: '6px', background: '#242428', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.min(rep.conversion_rate, 100)}%`, background: '#3ecf8e', borderRadius: '3px' }} />
                        </div>
                        <span className="font-headline tabular-nums" style={{ fontWeight: '700', color: '#3ecf8e', fontSize: '13px' }}>
                          {rep.conversion_rate}%
                        </span>
                      </div>
                    </td>

                    <td>
                      <span
                        style={{
                          background: rep.avg_research_score >= 75 ? 'rgba(62,207,142,0.15)' : 'rgba(255,255,255,0.06)',
                          color: rep.avg_research_score >= 75 ? '#3ecf8e' : '#f5f5f0',
                          padding: '3px 9px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}
                        className="font-headline tabular-nums"
                      >
                        {rep.avg_research_score}/100
                      </span>
                    </td>

                    <td className="font-headline tabular-nums" style={{ color: '#8a8a85' }}>
                      {rep.total_actions}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  )
}
