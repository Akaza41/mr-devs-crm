import React from 'react'

export default function SkeletonTable({ rows = 6 }) {
  return (
    <div className="table-wrap" style={{ background: '#161616', border: '0.5px solid #232323', borderRadius: '8px' }}>
      <table style={{ width: '100%' }}>
        <thead>
          <tr>
            {['#', 'Hospital Name', 'Type', 'Rating', 'Phone', 'Priority', 'Stage', 'Contacted', 'Reply'].map((h, i) => (
              <th key={i} style={{ padding: '12px 16px', color: '#8a8a85', fontSize: '11px' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rIdx) => (
            <tr key={rIdx}>
              <td style={{ width: '40px' }}><div className="skeleton-pulse" style={{ height: '14px', width: '20px' }} /></td>
              <td>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div className="skeleton-pulse" style={{ height: '14px', width: '140px' }} />
                  <div className="skeleton-pulse" style={{ height: '10px', width: '90px' }} />
                </div>
              </td>
              <td><div className="skeleton-pulse" style={{ height: '14px', width: '70px' }} /></td>
              <td><div className="skeleton-pulse" style={{ height: '14px', width: '40px' }} /></td>
              <td><div className="skeleton-pulse" style={{ height: '14px', width: '100px' }} /></td>
              <td><div className="skeleton-pulse" style={{ height: '20px', width: '60px', borderRadius: '4px' }} /></td>
              <td><div className="skeleton-pulse" style={{ height: '20px', width: '70px', borderRadius: '4px' }} /></td>
              <td><div className="skeleton-pulse" style={{ height: '20px', width: '50px', borderRadius: '4px' }} /></td>
              <td><div className="skeleton-pulse" style={{ height: '20px', width: '50px', borderRadius: '4px' }} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
