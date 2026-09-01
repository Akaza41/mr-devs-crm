import { useState, useEffect } from 'react'
import * as xlsx from 'xlsx'
import { db } from '../lib/firebase'
import {
  collection,
  doc,
  getDocs,
  addDoc,
  writeBatch,
  query,
  where,
  serverTimestamp
} from 'firebase/firestore'
import { logActivity } from '../lib/activityLogger'
import { ACTIONS } from '../lib/activityActions'

export default function ImportModal({ file, activeProject, customColumns = [], currentUserProfile, onRefreshCustomColumns, onClose, onSuccess }) {
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

  const dbCols = [
    'hospital_name', 'lead_name', 'address', 'type', 'rating', 'reviews', 'phone', 
    'number_type', 'has_website', 'priority', 'stage', 'fb_found', 'contacted', 
    'reply', 'notes', 'pain_point', 'current_solution', 'decision_maker', 'next_followup_due',
    ...customColumns.map(c => c.column_name)
  ]

  const blocklist = ['id', 'no', 'sr', 'sr_no', 'sno', 's_no', 'serial', 'serial_no', 'row', 'row_no', 'index', 'sl', 'sl_no', 'project_id', '#']

  const matchHeader = (header) => {
    if (!header) return null
    const trimmed = header.toString().trim()
    if (trimmed === '#') return null
    const norm = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
    if (blocklist.includes(norm)) return null

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
      'client_name': 'hospital_name',
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
      'pain': 'pain_point',
      'pain_point': 'pain_point',
      'problem': 'pain_point',
      'challenge': 'pain_point',
      'solution': 'current_solution',
      'current_solution': 'current_solution',
      'existing_solution': 'current_solution',
      'current_tool': 'current_solution',
      'decision_maker': 'decision_maker',
      'contact_person': 'decision_maker',
      'owner': 'decision_maker',
      'ceo': 'decision_maker',
      'manager_name': 'decision_maker',
      'followup_date': 'next_followup_due',
      'follow_up_date': 'next_followup_due',
      'next_followup': 'next_followup_due',
      'next_followup_due': 'next_followup_due',
      'due_date': 'next_followup_due',
    }

    if (aliases[norm]) return aliases[norm]
    if (dbCols.includes(norm)) return norm
    const found = dbCols.find(c => c.includes(norm) || norm.includes(c))
    return found || null
  }

  useEffect(() => {
    if (!file) return
    setLoading(true)
    setError(null)

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = xlsx.read(data, { type: 'array' })
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]
        
        const json = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '' })
        
        if (!json || json.length === 0) {
          setError('The selected file appears to be empty.')
          setLoading(false)
          return
        }

        setRawRows(json)

        let bestHeaderIdx = 0
        let maxFilledCount = 0
        json.slice(0, 10).forEach((row, idx) => {
          const filled = row.filter(cell => cell && cell.toString().trim() !== '').length
          if (filled > maxFilledCount) {
            maxFilledCount = filled
            bestHeaderIdx = idx
          }
        })
        setHeaderRowIdx(bestHeaderIdx)
        setLoading(false)
      } catch (err) {
        setError('Failed to parse file: ' + err.message)
        setLoading(false)
      }
    }
    reader.readAsArrayBuffer(file)
  }, [file])

  const handleNextToMapping = () => {
    if (!rawRows || rawRows.length <= headerRowIdx) return

    const rawHeaders = rawRows[headerRowIdx] || []
    const mapped = rawHeaders.map(h => ({
      original: h ? h.toString().trim() : '',
      mapped: matchHeader(h)
    }))

    const rows = rawRows.slice(headerRowIdx + 1).filter(r => r.some(c => c && c.toString().trim() !== ''))

    setMappedHeaders(mapped)
    setDataRows(rows)

    setSelectedRows(new Set(rows.map((_, i) => i)))
    setSelectedCols(new Set(mapped.map((_, i) => i)))

    setStep(2)
  }

  const handleHeaderMappingChange = (index, newMappedValue) => {
    const updated = [...mappedHeaders]
    updated[index].mapped = newMappedValue === 'unmapped' ? null : newMappedValue
    setMappedHeaders(updated)
  }

  const handleCreateCustomColumn = async (colName, type) => {
    if (!colName.trim()) return
    const key = colName.trim().toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')

    let mappedType = 'Text'
    if (type === 'number') mappedType = 'Number'
    else if (type === 'date') mappedType = 'Date'
    else if (type === 'boolean' || type === 'yes/no') mappedType = 'Yes/No'

    setLoading(true)
    try {
      const newCol = {
        columnName: key,
        displayName: colName.trim(),
        dataType: mappedType,
        createdAt: serverTimestamp()
      }
      
      await addDoc(collection(db, 'custom_columns'), newCol)
      if (onRefreshCustomColumns) await onRefreshCustomColumns()
    } catch (err) {
      alert('An unexpected error occurred: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (selectedRows.size === 0 || selectedCols.size === 0 || !activeProject) return
    setLoading(true)
    
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

    const normalizeYesNo = (val) => {
      if (!val) return 'No'
      const v = val.toString().trim().toLowerCase()
      if (['yes', 'true', '1', 'y'].includes(v)) return 'Yes'
      return 'No'
    }

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
        if (h.mapped) {
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

      newRow.projectId = activeProject.id
      if (currentUserProfile?.id) newRow.createdBy = currentUserProfile.id

      if (newRow.hospital_name && !newRow.lead_name) {
        newRow.lead_name = newRow.hospital_name
      } else if (newRow.lead_name && !newRow.hospital_name) {
        newRow.hospital_name = newRow.lead_name
      }

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

    // ── DUPLICATE DETECTION PREFETCH ──
    try {
      const qExisting = query(
        collection(db, 'leads'),
        where('projectId', '==', activeProject.id)
      )
      const existingSnap = await getDocs(qExisting)

      const existingFingerprints = new Set()
      const existingNames = new Set()

      existingSnap.docs.forEach(docSnap => {
        const d = docSnap.data()
        const name = (d.hospitalName || d.leadName || '').trim().toLowerCase()
        const phone = (d.phone || '').trim().toLowerCase()
        if (name) {
          existingNames.add(name)
          if (phone) existingFingerprints.add(`${name}||${phone}`)
        }
      })

      const rowsToInsert = []
      let skipped = 0
      let duplicates = 0

      for (const row of rawInsertRows) {
        const name = (row.hospital_name || row.lead_name || '').trim().toLowerCase()
        if (!name) {
          skipped++
          continue
        }

        const phone = (row.phone || '').trim().toLowerCase()
        const isDuplicate = phone ? existingFingerprints.has(`${name}||${phone}`) : existingNames.has(name)

        if (isDuplicate) {
          duplicates++
          continue
        }

        rowsToInsert.push(row)
      }

      if (rowsToInsert.length === 0) {
        onSuccess(0, skipped, duplicates)
        return
      }

      // ── BATCH INSERT TO FIRESTORE ──
      const CHUNK_SIZE = 400
      let insertedCount = 0

      for (let i = 0; i < rowsToInsert.length; i += CHUNK_SIZE) {
        const chunk = rowsToInsert.slice(i, i + CHUNK_SIZE)
        const batch = writeBatch(db)

        for (const item of chunk) {
          const docRef = doc(collection(db, 'leads'))
          batch.set(docRef, {
            projectId: activeProject.id,
            hospitalName: item.hospital_name || item.lead_name || 'Unnamed Lead',
            leadName: item.lead_name || item.hospital_name || 'Unnamed Lead',
            address: item.address || '',
            type: item.type || '',
            rating: item.rating ? Number(item.rating) : null,
            reviews: item.reviews ? Number(item.reviews) : 0,
            phone: item.phone || '',
            numberType: item.number_type || 'No Number',
            hasWebsite: item.has_website || 'No',
            priority: item.priority || 'Medium',
            stage: item.stage || 'New',
            fbFound: item.fb_found || 'No',
            contacted: item.contacted || 'No',
            reply: item.reply || '—',
            notes: item.notes || '',
            createdBy: currentUserProfile?.id || null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          })
        }

        await batch.commit()
        insertedCount += chunk.length
      }

      logActivity({
        action: ACTIONS.LEAD_IMPORTED,
        entityType: 'lead',
        projectId: activeProject.id,
        metadata: { count: insertedCount, fileName: file.name }
      })

      onSuccess(insertedCount, skipped, duplicates)

    } catch (err) {
      console.error('Import error:', err)
      alert('Error importing leads: ' + err.message)
      setLoading(false)
    }
  }

  const toggleSelectAllRows = () => {
    if (selectedRows.size === dataRows.length) {
      setSelectedRows(new Set())
    } else {
      setSelectedRows(new Set(dataRows.map((_, i) => i)))
    }
  }

  const toggleSelectAllCols = () => {
    if (selectedCols.size === mappedHeaders.length) {
      setSelectedCols(new Set())
    } else {
      setSelectedCols(new Set(mappedHeaders.map((_, i) => i)))
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#161616', border: '0.5px solid #2a2a2a', borderRadius: '12px', width: '100%', maxWidth: step === 1 ? '640px' : '1000px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.8)' }}>
        
        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '0.5px solid #2a2a2a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#ededed', margin: 0 }}>
              Import Leads from File — {step === 1 ? 'Step 1: Select Header Row' : 'Step 2: Map & Preview Data'}
            </h2>
            <p style={{ fontSize: '12px', color: '#777', margin: '4px 0 0 0' }}>
              File: <span style={{ color: '#3ecf8e' }}>{file?.name}</span> | Project: <span style={{ color: '#ededed' }}>{activeProject?.name}</span>
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#777', fontSize: '20px', cursor: 'pointer' }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#888' }}>
              <div className="spinner" style={{ margin: '0 auto 16px auto' }} />
              Processing data...
            </div>
          ) : error ? (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '0.5px solid rgba(239, 68, 68, 0.3)', padding: '16px', borderRadius: '8px', color: '#f87171' }}>
              {error}
            </div>
          ) : step === 1 ? (
            <div>
              <p style={{ fontSize: '13px', color: '#aaa', marginBottom: '16px' }}>
                Select which row in your file contains the column headers:
              </p>

              <div style={{ overflowX: 'auto', border: '0.5px solid #2a2a2a', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textIndent: 'left' }}>
                  <tbody>
                    {rawRows.slice(0, 10).map((row, idx) => (
                      <tr 
                        key={idx}
                        onClick={() => setHeaderRowIdx(idx)}
                        style={{ 
                          background: headerRowIdx === idx ? 'rgba(62, 207, 142, 0.15)' : 'transparent',
                          borderBottom: '0.5px solid #222',
                          cursor: 'pointer'
                        }}
                      >
                        <td style={{ width: '40px', padding: '8px', textAlign: 'center', color: headerRowIdx === idx ? '#3ecf8e' : '#555', fontWeight: 'bold' }}>
                          {headerRowIdx === idx ? '➜' : idx + 1}
                        </td>
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} style={{ padding: '8px', color: '#ccc', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {cell?.toString() || ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div>
              {/* Mapping Controls */}
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '14px', color: '#ddd', marginBottom: '12px' }}>Column Mappings</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                  {mappedHeaders.map((h, idx) => (
                    <div key={idx} style={{ background: '#111', border: '0.5px solid #2a2a2a', padding: '10px 12px', borderRadius: '8px' }}>
                      <div style={{ fontSize: '11px', color: '#777', marginBottom: '4px' }}>Original: <strong style={{ color: '#fff' }}>{h.original || '(Empty)'}</strong></div>
                      <select 
                        className="input-base"
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                        value={h.mapped || 'unmapped'}
                        onChange={(e) => handleHeaderMappingChange(idx, e.target.value)}
                      >
                        <option value="unmapped">-- Ignore Column --</option>
                        <optgroup label="Standard Fields">
                          <option value="hospital_name">Hospital / Lead Name</option>
                          <option value="phone">Phone Number</option>
                          <option value="address">Address</option>
                          <option value="type">Type / Category</option>
                          <option value="rating">Rating</option>
                          <option value="reviews">Reviews Count</option>
                          <option value="has_website">Has Website (Yes/No)</option>
                          <option value="fb_found">FB Found (Yes/No)</option>
                          <option value="priority">Priority</option>
                          <option value="stage">Pipeline Stage</option>
                          <option value="notes">Notes</option>
                        </optgroup>
                        {customColumns.length > 0 && (
                          <optgroup label="Custom Columns">
                            {customColumns.map(c => (
                              <option key={c.id} value={c.column_name}>{c.display_name}</option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Data Table Preview */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ fontSize: '12px', color: '#aaa' }}>
                  Ready to import <strong style={{ color: '#3ecf8e' }}>{selectedRows.size}</strong> of {dataRows.length} rows.
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={toggleSelectAllRows} style={{ background: 'none', border: 'none', color: '#3ecf8e', fontSize: '12px', cursor: 'pointer' }}>Toggle Rows</button>
                  <button onClick={toggleSelectAllCols} style={{ background: 'none', border: 'none', color: '#3ecf8e', fontSize: '12px', cursor: 'pointer' }}>Toggle Cols</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '0.5px solid #2a2a2a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111' }}>
          {step === 1 ? (
            <>
              <button onClick={onClose} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '12px' }}>Cancel</button>
              <button onClick={handleNextToMapping} className="btn-primary" style={{ padding: '8px 16px', fontSize: '12px' }}>Next: Map Headers ➜</button>
            </>
          ) : (
            <>
              <button onClick={() => setStep(1)} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '12px' }}>← Back to Step 1</button>
              <button onClick={handleConfirm} className="btn-primary" style={{ padding: '8px 24px', fontSize: '12px' }}>Confirm & Import Leads</button>
            </>
          )}
        </div>

      </div>
    </div>
  )
}