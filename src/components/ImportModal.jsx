import { useState, useEffect } from 'react'
import * as xlsx from 'xlsx'
import { supabase } from '../lib/supabase'

export default function ImportModal({ file, activeProject, customColumns = [], onClose, onSuccess }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [step, setStep] = useState(1)

  // Step 1 state
  const [rawRows, setRawRows] = useState([])
  const [headerRowIdx, setHeaderRowIdx] = useState(0)

  // Step 2 state
  const [mappedHeaders, setMappedHeaders] = useState([])
  const [dataRows, setDataRows] = useState([])
  const [selectedRows, setSelectedRows] = useState(new Set())
  const [selectedCols, setSelectedCols] = useState(new Set())

  const dbCols = ['hospital_name', 'address', 'type', 'rating', 'phone', 'number_type', 'has_website', 'priority', 'fb_found', 'contacted', 'reply', 'notes', ...customColumns.map(c => c.column_name)]

  // Column names that should NEVER be mapped — these are row IDs / serial numbers from Excel
  const blocklist = ['id', 'no', 'sr', 'sr_no', 'sno', 's_no', 'serial', 'serial_no', 'row', 'row_no', 'index', 'sl', 'sl_no', 'project_id', '#']

  const matchHeader = (header) => {
    if (!header) return null
    const trimmed = header.toString().trim()
    // Block # column immediately
    if (trimmed === '#') return null
    const norm = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
    if (blocklist.includes(norm)) return null

    // Explicit aliases — maps common Excel column names to DB fields
    const aliases = {
      'business_name': 'hospital_name',
      'clinic_name': 'hospital_name',
      'hospital': 'hospital_name',
      'name': 'hospital_name',
      'facility_name': 'hospital_name',
      'lead_name': 'hospital_name',
      'organization': 'hospital_name',
      'company': 'hospital_name',
      'company_name': 'hospital_name',
      'place_name': 'hospital_name',
      'website': 'has_website',
      'has_web': 'has_website',
      'web': 'has_website',
      'facebook': 'fb_found',
      'fb': 'fb_found',
      'facebook_link': 'fb_found',
      'fb_link': 'fb_found',
      'fb_page': 'fb_found',
      'contact': 'contacted',
      'mob': 'phone',
      'mobile': 'phone',
      'mobile_no': 'phone',
      'phone_no': 'phone',
      'contact_no': 'phone',
      'cell': 'phone',
      'num': 'number_type',
      'number': 'number_type',
      'note': 'notes',
      'remark': 'notes',
      'remarks': 'notes',
      'stars': 'rating',
      'google_rating': 'rating',
      'addr': 'address',
      'location': 'address',
    }

    if (aliases[norm]) return aliases[norm]
    if (dbCols.includes(norm)) return norm
    const found = dbCols.find(c => c.includes(norm) || norm.includes(c))
    return found || null
  }

  useEffect(() => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = xlsx.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const json = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '' })
        
        if (json.length === 0) {
          setError('No data found in the file.')
          setLoading(false)
          return
        }

        setRawRows(json)
        const guessIdx = json.findIndex(row => row.filter(cell => typeof cell === 'string' && cell.trim() !== '').length > 1)
        setHeaderRowIdx(guessIdx >= 0 ? guessIdx : 0)
        setLoading(false)
      } catch (err) {
        setError('Failed to parse file: ' + err.message)
        setLoading(false)
      }
    }
    reader.readAsArrayBuffer(file)
  }, [file])

  const handleNext = () => {
    const headers = rawRows[headerRowIdx] || []
    const data = rawRows.slice(headerRowIdx + 1).filter(r => r.length > 0 && r.some(c => c !== ''))

    const mapped = headers.map(h => ({
      original: h?.toString() || 'Unknown',
      mapped: matchHeader(h?.toString() || '')
    }))

    setMappedHeaders(mapped)
    setDataRows(data)

    const allRows = new Set(data.map((_, i) => i))
    const allCols = new Set(mapped.map((_, i) => i).filter(i => mapped[i].mapped))
    setSelectedRows(allRows)
    setSelectedCols(allCols)

    setStep(2)
  }

  const toggleRow = (idx) => {
    const newSet = new Set(selectedRows)
    if (newSet.has(idx)) newSet.delete(idx)
    else newSet.add(idx)
    setSelectedRows(newSet)
  }

  const toggleCol = (idx) => {
    const newSet = new Set(selectedCols)
    if (newSet.has(idx)) newSet.delete(idx)
    else newSet.add(idx)
    setSelectedCols(newSet)
  }

  const handleConfirm = async () => {
    if (selectedRows.size === 0 || selectedCols.size === 0 || !activeProject) return
    setLoading(true)
    
    // SAFE LIST of allowed DB columns — only these can ever be inserted
    const allowedColumns = new Set([
      'hospital_name', 'address', 'type', 'rating', 'phone', 'number_type',
      'has_website', 'priority', 'fb_found', 'contacted', 'reply', 'notes',
      'project_id',
      ...customColumns.map(c => c.column_name)
    ])

    const rawInsertRows = []
    dataRows.forEach((row, rowIdx) => {
      if (!selectedRows.has(rowIdx)) return
      
      const newRow = {}
      mappedHeaders.forEach((h, colIdx) => {
        if (!selectedCols.has(colIdx)) return
        // Only insert if mapped AND in the allowed list — never insert 'id'
        if (h.mapped && allowedColumns.has(h.mapped)) {
          const val = row[colIdx]?.toString().trim()
          newRow[h.mapped] = !val || val === '' ? null : val
        }
      })

      // Always set project_id from activeProject — never from Excel
      newRow.project_id = activeProject.id

      // Final safety — delete id no matter what
      delete newRow.id

      if (Object.keys(newRow).length > 1) {
        rawInsertRows.push(newRow)
      }
    })

    if (rawInsertRows.length === 0) {
      alert('No valid data to import based on selections.')
      setLoading(false)
      return
    }

    // We have removed all deduplication so every single valid row is imported.
    const rowsToInsert = []
    let skipped = 0

    for (const row of rawInsertRows) {
      const n = row.hospital_name?.trim().toLowerCase()
      
      // Since hospital_name is still required (not-null constraint), skip rows that are completely missing it
      if (!n) {
        skipped++
        continue
      }
      
      rowsToInsert.push(row)
    }

    if (rowsToInsert.length === 0) {
      onSuccess(0, skipped)
      return
    }

    // Log sample to verify no id field
    console.log('Sample row before insert (should have NO id field):', JSON.stringify(rowsToInsert[0]))
    console.log('Keys in row:', Object.keys(rowsToInsert[0]))

    const { error } = await supabase.from('leads').insert(rowsToInsert)
    if (error) {
      alert('Error importing leads: ' + error.message)
      setLoading(false)
      return
    }
    onSuccess(rowsToInsert.length, skipped)
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: '90vw', width: '1000px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <span style={{ fontSize: '13px', fontWeight: '500', color: '#ededed' }}>
            {step === 1 ? 'Step 1: Select Header Row' : 'Step 2: Select Data to Import'}
          </span>
          <button onClick={onClose} disabled={loading} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>×</button>
        </div>
        
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#a0a0a0', fontSize: '13px' }}>Parsing file...</div>
          ) : error ? (
            <div style={{ color: '#f87171', fontSize: '13px' }}>{error}</div>
          ) : step === 1 ? (
            <>
              <div style={{ fontSize: '13px', color: '#a0a0a0' }}>Select the row that contains your column names.</div>
              <div className="table-wrap" style={{ flex: 1, overflow: 'auto' }}>
                <table>
                  <tbody>
                    {rawRows.map((row, i) => (
                      <tr key={i} style={{ background: i === headerRowIdx ? 'rgba(62,207,142,0.1)' : 'transparent' }}>
                        <td style={{ width: '40px', textAlign: 'center' }}>
                          <input type="radio" checked={i === headerRowIdx} onChange={() => setHeaderRowIdx(i)} style={{ accentColor: '#3ecf8e', cursor: 'pointer' }} />
                        </td>
                        <td style={{ color: '#555', fontSize: '11px', width: '40px' }}>{i + 1}</td>
                        {row.map((cell, j) => (
                          <td key={j} style={{ whiteSpace: 'nowrap', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', color: i === headerRowIdx ? '#3ecf8e' : '#ededed' }}>
                            {cell?.toString() || ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn-ghost" onClick={() => setSelectedRows(new Set(dataRows.map((_, i) => i)))}>Select All Rows</button>
                  <button className="btn-ghost" onClick={() => setSelectedRows(new Set())}>Deselect All Rows</button>
                  <div style={{ width: '1px', background: '#333', margin: '0 5px' }} />
                  <button className="btn-ghost" onClick={() => setSelectedCols(new Set(mappedHeaders.map((_, i) => i)))}>Select All Columns</button>
                  <button className="btn-ghost" onClick={() => setSelectedCols(new Set())}>Deselect All Columns</button>
                </div>
                <div style={{ fontSize: '13px', color: '#ededed' }}>
                  Importing <strong style={{ color: '#3ecf8e' }}>{selectedRows.size}</strong> rows and <strong style={{ color: '#3ecf8e' }}>{selectedCols.size}</strong> columns
                </div>
              </div>

              <div className="table-wrap" style={{ flex: 1, overflow: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '40px', position: 'sticky', top: 0, zIndex: 10, background: '#1a1a1a' }}></th>
                      <th style={{ width: '40px', position: 'sticky', top: 0, zIndex: 10, background: '#1a1a1a' }}>#</th>
                      {mappedHeaders.map((h, i) => (
                        <th key={i} style={{ position: 'sticky', top: 0, zIndex: 10, background: '#1a1a1a' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', opacity: selectedCols.has(i) ? 1 : 0.5 }}>
                            <input type="checkbox" checked={selectedCols.has(i)} onChange={() => toggleCol(i)} style={{ accentColor: '#3ecf8e' }} />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span>{h.original}</span>
                              {h.mapped ? (
                                <span style={{ fontSize: '10px', color: '#3ecf8e', fontWeight: 'normal' }}>→ {h.mapped}</span>
                              ) : (
                                <span style={{ fontSize: '10px', color: '#f87171', fontWeight: 'normal' }}>Unmapped</span>
                              )}
                            </div>
                          </label>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dataRows.map((row, i) => (
                      <tr key={i} style={{ opacity: selectedRows.has(i) ? 1 : 0.4 }}>
                        <td style={{ textAlign: 'center' }}>
                          <input type="checkbox" checked={selectedRows.has(i)} onChange={() => toggleRow(i)} style={{ accentColor: '#3ecf8e', cursor: 'pointer' }} />
                        </td>
                        <td style={{ color: '#555', fontSize: '11px' }}>{i + 1}</td>
                        {mappedHeaders.map((h, j) => (
                          <td key={j} style={{ whiteSpace: 'nowrap', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', color: selectedCols.has(j) ? '#ededed' : '#555' }}>
                            {row[j]?.toString() || ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="modal-footer" style={{ justifyContent: step === 1 ? 'flex-end' : 'space-between' }}>
          {step === 1 ? (
            <>
              <button className="btn-ghost" onClick={onClose} disabled={loading}>❌ Cancel</button>
              <button className="btn-primary" onClick={handleNext} disabled={loading || rawRows.length === 0}>Next →</button>
            </>
          ) : (
            <>
              <button className="btn-ghost" onClick={() => setStep(1)} disabled={loading}>← Back</button>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn-ghost" onClick={onClose} disabled={loading}>❌ Cancel</button>
                <button className="btn-primary" onClick={handleConfirm} disabled={loading || selectedRows.size === 0 || selectedCols.size === 0}>✅ Confirm Import</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}