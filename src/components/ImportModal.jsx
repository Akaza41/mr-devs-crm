import { useState, useEffect } from 'react'
import * as xlsx from 'xlsx'
import { supabase } from '../lib/supabase'

export default function ImportModal({ file, activeProject, customColumns = [], onRefreshCustomColumns, onClose, onSuccess }) {
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

  const dbCols = ['hospital_name', 'address', 'type', 'rating', 'reviews', 'phone', 'number_type', 'has_website', 'priority', 'fb_found', 'contacted', 'reply', 'notes', ...customColumns.map(c => c.column_name)]

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
    const allCols = new Set(mapped.map((_, i) => i))
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

  const handleMapChange = (colIdx, value) => {
    const newVal = value || null
    const updated = [...mappedHeaders]
    updated[colIdx] = { ...updated[colIdx], mapped: newVal }
    setMappedHeaders(updated)

    const newSelectedCols = new Set(selectedCols)
    if (newVal) {
      newSelectedCols.add(colIdx)
    } else {
      newSelectedCols.delete(colIdx)
    }
    setSelectedCols(newSelectedCols)
  }

  const handleCreateCustomColumn = async () => {
    const colName = prompt('Enter a name for the new custom column:')
    if (!colName || !colName.trim()) return

    const key = colName.toLowerCase().replace(/[^a-z0-9]/g, '_')
    const allDbCols = ['hospital_name', 'address', 'type', 'rating', 'phone', 'number_type', 'has_website', 'priority', 'fb_found', 'contacted', 'reply', 'notes', ...customColumns.map(c => c.column_name)]
    if (allDbCols.includes(key)) {
      alert('A column with this name already exists.')
      return
    }

    const colType = prompt('Enter column type (text, number, date, boolean) [default: text]:', 'text')
    const finalType = colType?.trim().toLowerCase() || 'text'
    
    let pgType = 'text'
    let mappedType = 'Text'
    if (finalType === 'number' || finalType === 'numeric') {
      pgType = 'numeric'
      mappedType = 'Number'
    } else if (finalType === 'date') {
      pgType = 'date'
      mappedType = 'Date'
    } else if (finalType === 'boolean' || finalType === 'yes/no') {
      pgType = 'text'
      mappedType = 'Yes/No'
    }

    setLoading(true)
    try {
      const { error: rpcError } = await supabase.rpc('add_custom_column', {
        col_name: key,
        col_type: pgType
      })
      if (rpcError) {
        alert('Error adding column to database: ' + rpcError.message)
        setLoading(false)
        return
      }

      const newCol = {
        column_name: key,
        display_name: colName.trim(),
        data_type: mappedType
      }
      
      const { data, error } = await supabase.from('custom_columns').insert([newCol]).select().single()
      if (error) {
        alert('Error saving custom column metadata: ' + error.message)
      } else if (data && onRefreshCustomColumns) {
        await onRefreshCustomColumns()
      }
    } catch (err) {
      alert('An unexpected error occurred: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (selectedRows.size === 0 || selectedCols.size === 0 || !activeProject) return
    setLoading(true)
    
    // Check if there are any checked columns that are unmapped
    const unmappedCheckedCols = []
    mappedHeaders.forEach((h, idx) => {
      if (selectedCols.has(idx) && !h.mapped) {
        unmappedCheckedCols.push(h.original)
      }
    })

    if (unmappedCheckedCols.length > 0) {
      alert(`The following columns are selected for import but remain Unmapped:\n\n` + 
            unmappedCheckedCols.map(c => `• ${c}`).join('\n') + 
            `\n\nPlease choose a database column mapping for them, or uncheck them before continuing.`)
      setLoading(false)
      return
    }

    // SAFE LIST of allowed DB columns — only these can ever be inserted
    const allowedColumns = new Set([
      'hospital_name', 'address', 'type', 'rating', 'reviews', 'phone', 'number_type',
      'has_website', 'priority', 'fb_found', 'contacted', 'reply', 'notes',
      'project_id',
      ...customColumns.map(c => c.column_name)
    ])

    // ── NORMALIZATION: Convert boolean-like Excel values to canonical "Yes" / "No"
    // Ensures values like "TRUE", "1", "yes", "y" are standardized for the UI badges
    const normalizeYesNo = (val) => {
      if (!val) return 'No'
      const v = val.toString().trim().toLowerCase()
      if (['yes', 'true', '1', 'y'].includes(v)) return 'Yes'
      return 'No'
    }

    // ── NORMALIZATION: Extract clean numeric value for rating
    // Prevents DB coercion errors if Excel has "4.2 stars" or "4/5" instead of just 4.2
    const parseRating = (val) => {
      if (!val) return null
      const match = val.toString().match(/[0-9.]+/)
      if (match) {
        const num = parseFloat(match[0])
        return isNaN(num) ? null : num
      }
      return null
    }

    const rawInsertRows = []
    dataRows.forEach((row, rowIdx) => {
      if (!selectedRows.has(rowIdx)) return
      
      const newRow = {}
      mappedHeaders.forEach((h, colIdx) => {
        if (!selectedCols.has(colIdx)) return
        // Only insert if mapped AND in the allowed list — never insert 'id'
        if (h.mapped && allowedColumns.has(h.mapped)) {
          let val = row[colIdx]?.toString().trim()
          
          if (val) {
            if (h.mapped === 'has_website' || h.mapped === 'fb_found') {
              val = normalizeYesNo(val)
            } else if (h.mapped === 'rating') {
              val = parseRating(val)
            }
          }

          newRow[h.mapped] = val === null || val === undefined || val === '' ? null : val
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

    // ── DUPLICATE DETECTION: prefetch existing leads for this project ──────────
    // Fetch only hospital_name and phone — the two fields used to fingerprint a lead.
    // Scoped to activeProject.id so leads in other projects are never treated as duplicates.
    const { data: existingLeads, error: fetchError } = await supabase
      .from('leads')
      .select('hospital_name, phone')
      .eq('project_id', activeProject.id)

    if (fetchError) {
      // If the prefetch fails we bail out rather than silently inserting without checking.
      alert('Error checking for duplicates: ' + fetchError.message)
      setLoading(false)
      return
    }

    // existingFingerprints: Set of "name||phone" strings for leads that HAVE a phone.
    // Used when the incoming row also has a phone — matches the exact name+phone pair.
    const existingFingerprints = new Set()

    // existingNames: Set of just the name for every existing lead, regardless of phone.
    // Used as a fallback when the incoming row has NO phone — matches by name alone,
    // because a phoneless row with a matching name is almost certainly the same lead.
    const existingNames = new Set()

    for (const lead of existingLeads) {
      const name = lead.hospital_name?.trim().toLowerCase() || ''
      const phone = lead.phone?.trim().toLowerCase() || ''
      if (name) {
        // Always add to the name-only set — covers the no-phone fallback for incoming rows.
        existingNames.add(name)
        // Add the full fingerprint only for leads that have a phone.
        if (phone) existingFingerprints.add(`${name}||${phone}`)
      }
    }
    // ── END DUPLICATE DETECTION SETUP ──────────────────────────────────────────

    const rowsToInsert = []
    // skipped: rows dropped because hospital_name is blank (original behavior, unchanged).
    let skipped = 0
    // duplicates: rows dropped because they already exist in this project (new behavior).
    let duplicates = 0

    for (const row of rawInsertRows) {
      const n = row.hospital_name?.trim().toLowerCase()

      // Since hospital_name is still required (not-null constraint), skip rows that are completely missing it.
      if (!n) {
        skipped++
        continue
      }

      // ── DUPLICATE CHECK ────────────────────────────────────────────────────
      // Normalize the incoming phone so comparisons are case/space insensitive.
      const incomingPhone = row.phone?.trim().toLowerCase() || ''

      let isDuplicate
      if (incomingPhone) {
        // Incoming row HAS a phone: check the combined name+phone fingerprint.
        // Two leads with the same name but different phone numbers are NOT duplicates.
        isDuplicate = existingFingerprints.has(`${n}||${incomingPhone}`)
      } else {
        // Incoming row has NO phone: fall back to name-only check.
        // A phoneless row with a matching name is treated as the same lead.
        isDuplicate = existingNames.has(n)
      }

      if (isDuplicate) {
        // Count it and skip — we report the total to the user at the end.
        duplicates++
        continue
      }
      // ── END DUPLICATE CHECK ────────────────────────────────────────────────

      rowsToInsert.push(row)
    }

    if (rowsToInsert.length === 0) {
      // Nothing to insert — report both skip counts so the user sees what happened.
      onSuccess(0, skipped, duplicates)
      return
    }

    // Log sample to verify no id field (unchanged from original).
    console.log('Sample row before insert (should have NO id field):', JSON.stringify(rowsToInsert[0]))
    console.log('Keys in row:', Object.keys(rowsToInsert[0]))

    // ── CHUNKING: Split the insert into smaller batches to avoid Supabase limits ──
    // Inserting thousands of rows in a single request can exceed payload size limits.
    // We break the rows into chunks of 200 and insert them sequentially.
    const CHUNK_SIZE = 200
    let insertedCount = 0

    for (let i = 0; i < rowsToInsert.length; i += CHUNK_SIZE) {
      const chunk = rowsToInsert.slice(i, i + CHUNK_SIZE)
      const { error } = await supabase.from('leads').insert(chunk)
      
      if (error) {
        alert(`Error importing leads (stopped at row ${insertedCount}): ${error.message}`)
        setLoading(false)
        // If some chunks succeeded before this failure, we still report what we managed to insert
        if (insertedCount > 0) {
          onSuccess(insertedCount, skipped, duplicates)
        }
        return
      }
      insertedCount += chunk.length
    }

    // Pass both skip counts to the success handler so the toast can show each reason.
    onSuccess(insertedCount, skipped, duplicates)
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
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button className="btn-ghost" onClick={() => setSelectedRows(new Set(dataRows.map((_, i) => i)))}>Select All Rows</button>
                  <button className="btn-ghost" onClick={() => setSelectedRows(new Set())}>Deselect All Rows</button>
                  <div style={{ width: '1px', background: '#333', margin: '0 5px', alignSelf: 'stretch' }} />
                  <button className="btn-ghost" onClick={() => setSelectedCols(new Set(mappedHeaders.map((_, i) => i)))}>Select All Columns</button>
                  <button className="btn-ghost" onClick={() => setSelectedCols(new Set())}>Deselect All Columns</button>
                  <div style={{ width: '1px', background: '#333', margin: '0 5px', alignSelf: 'stretch' }} />
                  <button className="btn-ghost" onClick={handleCreateCustomColumn} style={{ color: '#3ecf8e' }}>➕ Add Custom Column</button>
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
                        <th key={i} style={{ position: 'sticky', top: 0, zIndex: 10, background: '#1a1a1a', minWidth: '150px' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', opacity: selectedCols.has(i) ? 1 : 0.5 }}>
                            <input 
                              type="checkbox" 
                              checked={selectedCols.has(i)} 
                              onChange={() => toggleCol(i)} 
                              style={{ accentColor: '#3ecf8e', cursor: 'pointer', marginTop: '4px' }} 
                            />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start', width: '100%' }}>
                              <span style={{ fontSize: '12px', fontWeight: '500', color: '#ededed', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }} title={h.original}>
                                {h.original}
                              </span>
                              <select
                                value={h.mapped || ''}
                                onChange={(e) => handleMapChange(i, e.target.value)}
                                style={{
                                  fontSize: '11px',
                                  background: '#141414',
                                  border: '0.5px solid #333',
                                  borderRadius: '4px',
                                  color: h.mapped ? '#3ecf8e' : '#f87171',
                                  padding: '4px 6px',
                                  cursor: 'pointer',
                                  outline: 'none',
                                  width: '100%',
                                  maxWidth: '130px'
                                }}
                              >
                                <option value="" style={{ color: '#f87171' }}>⚠️ Unmapped</option>
                                {dbCols.map(col => {
                                  const custom = customColumns.find(c => c.column_name === col);
                                  const label = custom ? `${custom.display_name} (Custom)` : col.replace(/_/g, ' ');
                                  return (
                                    <option key={col} value={col} style={{ color: '#ededed' }}>
                                      {label}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                          </div>
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