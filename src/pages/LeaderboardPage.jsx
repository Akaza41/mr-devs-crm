import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function LeaderboardPage({ onBack }) {
  const [leaderboard, setLeaderboard] = useState([])
  const [timeframe, setTimeframe] = useState('all') // 'week' | 'month' | 'all'
  const [sortBy, setSortBy] = useState('conversion_rate') // 'conversion_rate' | 'avg_research_score' | 'leads_contacted'
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLeaderboard()
  }, [])

  const fetchLeaderboard = async () => {
    setLoading(true)
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

  // Sort leaderboard dynamically
  const sortedLeaderboard = React.useMemo(() => {
    return [...leaderboard].sort((a, b) => {
      if (sortBy === 'conversion_rate') {
        if (b.conversion_rate !== a.conversion_rate) return b.conversion_rate - a.conversion_rate
        return b.leads_converted - a.leads_converted
      }
      if (sortBy === 'avg_research_score') return b.avg_research_score - a.avg_research_score
      if (sortBy === 'leads_contacted') return b.leads_contacted - a.leads_contacted
      return 0
    })
  }, [leaderboard, sortBy])

  // Compute overall team totals
  const teamTotals = React.useMemo(() => {
    const totalContacted = leaderboard.reduce((sum, r) => sum + Number(r.leads_contacted || 0), 0)
    const totalConverted = leaderboard.reduce((sum, r) => sum + Number(r.leads_converted || 0), 0)
    const avgRate = totalContacted > 0 ? ((totalConverted / totalContacted) * 100).toFixed(1) : 0
    const avgScore = leaderboard.length > 0 ? (leaderboard.reduce((sum, r) => sum + Number(r.avg_research_score || 0), 0) / leaderboard.length).toFixed(1) : 0

    return { totalContacted, totalConverted, avgRate, avgScore }
  }, [leaderboard])

  const topThree = sortedLeaderboard.slice(0, 3)

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '12px 0', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {onBack && (
            <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#8a8a85', cursor: 'pointer', fontSize: '14px' }}>
              ←
            </button>
          )}
          <div>
            <h1 className="font-headline" style={{ fontSize: '22px', fontWeight: '800', color: '#f5f5f0', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🏆</span> SALES LEADERBOARD
            </h1>
            <p style={{ fontSize: '13px', color: '#8a8a85', margin: '4px 0 0 0' }}>
              Performance ranking based on conversion rate, research score, and deal momentum.
            </p>
          </div>
        </div>

        {/* Timeframe & Sort Filters */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ background: '#161616', border: '0.5px solid #232323', borderRadius: '8px', padding: '3px', display: 'flex', gap: '2px' }}>
            <button
              onClick={() => setTimeframe('all')}
              style={{
                background: timeframe === 'all' ? '#232323' : 'transparent',
                border: 'none',
                color: timeframe === 'all' ? '#3ecf8e' : '#8a8a85',
                padding: '4px 10px',
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
                background: timeframe === 'month' ? '#232323' : 'transparent',
                border: 'none',
                color: timeframe === 'month' ? '#3ecf8e' : '#8a8a85',
                padding: '4px 10px',
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
            style={{ width: 'auto', fontSize: '12px', padding: '6px 12px' }}
          >
            <option value="conversion_rate">Sort by Conversion Rate</option>
            <option value="avg_research_score">Sort by Avg Research Score</option>
            <option value="leads_contacted">Sort by Contacted Leads</option>
          </select>
        </div>
      </div>

      {/* ── TEAM SUMMARY CARDS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: '11px', color: '#8a8a85', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Team Contacted</div>
          <div className="font-headline tabular-nums" style={{ fontSize: '24px', fontWeight: '700', color: '#f5f5f0' }}>{teamTotals.totalContacted}</div>
        </div>

        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: '11px', color: '#8a8a85', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Team Converted</div>
          <div className="font-headline tabular-nums" style={{ fontSize: '24px', fontWeight: '700', color: '#3ecf8e' }}>{teamTotals.totalConverted}</div>
        </div>

        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: '11px', color: '#8a8a85', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Avg Conversion Rate</div>
          <div className="font-headline tabular-nums" style={{ fontSize: '24px', fontWeight: '700', color: '#facc15' }}>{teamTotals.avgRate}%</div>
        </div>

        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: '11px', color: '#8a8a85', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Avg Research Score</div>
          <div className="font-headline tabular-nums" style={{ fontSize: '24px', fontWeight: '700', color: '#60a5fa' }}>{teamTotals.avgScore}/100</div>
        </div>
      </div>

      {/* ── TOP 3 PODIUM CARDS ── */}
      {!loading && topThree.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginTop: '8px' }}>
          {topThree.map((rep, idx) => {
            const badges = ['🥇 1ST PLACE', '🥈 2ND PLACE', '🥉 3RD PLACE']
            const borderColors = ['#facc15', '#cbd5e1', '#f97316']
            const badgeBgs = ['rgba(250,204,21,0.15)', 'rgba(203,213,225,0.15)', 'rgba(249,115,22,0.15)']

            return (
              <div
                key={rep.user_id}
                style={{
                  background: '#161616',
                  border: `1.5px solid ${borderColors[idx] || '#232323'}`,
                  borderRadius: '12px',
                  padding: '20px',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: `0 4px 20px ${borderColors[idx]}20`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: borderColors[idx], background: badgeBgs[idx], padding: '3px 10px', borderRadius: '12px' }}>
                    {badges[idx]}
                  </span>
                  <span style={{ fontSize: '11px', color: '#8a8a85', textTransform: 'capitalize' }}>{rep.role}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#232323', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '700', color: '#f5f5f0' }}>
                    {rep.avatar_url ? (
                      <img src={rep.avatar_url} alt={rep.full_name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      (rep.full_name || rep.email || 'U').charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: '#f5f5f0' }}>{rep.full_name || rep.email}</div>
                    <div style={{ fontSize: '12px', color: '#8a8a85' }}>{rep.email}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: '#121212', borderRadius: '8px', padding: '12px' }}>
                  <div>
                    <div style={{ fontSize: '10px', color: '#8a8a85', textTransform: 'uppercase' }}>Conversion Rate</div>
                    <div className="font-headline tabular-nums" style={{ fontSize: '18px', fontWeight: '700', color: '#3ecf8e' }}>
                      {rep.conversion_rate}%
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '10px', color: '#8a8a85', textTransform: 'uppercase' }}>Avg Research</div>
                    <div className="font-headline tabular-nums" style={{ fontSize: '18px', fontWeight: '700', color: '#60a5fa' }}>
                      {rep.avg_research_score}/100
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── LEADERBOARD TABLE ── */}
      <div className="table-wrap" style={{ background: '#161616', border: '0.5px solid #232323', borderRadius: '12px' }}>
        <table style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: '60px' }}>Rank</th>
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
                <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#8a8a85' }}>Loading leaderboard standings...</td>
              </tr>
            ) : sortedLeaderboard.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#8a8a85' }}>No active team performance records found</td>
              </tr>
            ) : (
              sortedLeaderboard.map((rep, idx) => {
                const rankIcons = ['🥇', '🥈', '🥉']
                const rankIcon = rankIcons[idx] || `#${idx + 1}`

                return (
                  <tr key={rep.user_id}>
                    <td style={{ textAlign: 'center', fontWeight: '700', fontSize: '14px', color: idx < 3 ? '#3ecf8e' : '#8a8a85' }}>
                      {rankIcon}
                    </td>

                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#232323', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '600', color: '#f5f5f0' }}>
                          {rep.avatar_url ? (
                            <img src={rep.avatar_url} alt={rep.full_name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                          ) : (
                            (rep.full_name || rep.email || 'U').charAt(0).toUpperCase()
                          )}
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
                        <div style={{ width: '60px', height: '6px', background: '#232323', borderRadius: '3px', overflow: 'hidden' }}>
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
                          padding: '2px 8px',
                          borderRadius: '4px',
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
