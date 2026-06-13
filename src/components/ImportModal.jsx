import { useState, useEffect } from 'react'
import * as xlsx from 'xlsx'
import { supabase } from '../lib/supabase'

export default function ImportModal({ file, activeProject, customColumns = [], onClose, onSuccess }) {
  const [loading, setLoading] = useState(true)
  const [parsedData, setParsedData] = useState([])
  const [mappedHeaders, setMappedHeaders] = useState([])
  const [error, setError] = useState(null)
  
  const dbCols = ['hospital_name', 'address', 'type', 'rating', 'phone', 'number_type', 'has_website', 'priority', 'fb_found', 'contacted', 'reply', 'notes', ...customColumns.map(c => c.column_name)]

  const matchHeader = (header) => {
    const norm = header.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
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
        const json = xlsx.utils.sheet_to_json(worksheet, { defval: '' })
        
        if (json.length === 0) {
          setError('No data found in the file.')
          setLoading(false)
          return
        }

        const rawHeaders = Object.keys(json[0])
        const headersMap = {}
        rawHeaders.forEach(h => {
          const match = matchHeader(h)
          if (match) headersMap[h] = match
        })
        
        const mappedData = json.map(row => {
          const newRow = {}
          for (const [rawH, dbH] of Object.entries(headersMap)) {
            newRow[dbH] = row[rawH]?.toString() || ''
          }
          return newRow
        })

        setMappedHeaders(Object.values(headersMap))
        setParsedData(mappedData)
        setLoading(false)
      } catch (err) {
        setError('Failed to parse file: ' + err.message)
        setLoading(false)
      }
    }
    reader.readAsArrayBuffer(file)
  }, [file])

  const handleConfirm = async () => {
    if (parsedData.length === 0 || !activeProject) return
    setLoading(true)
    
    const rowsToInsert = parsedData.map(r => ({ ...r, project_id: activeProject.id }))
    const { error } = await supabase.from('leads').insert(rowsToInsert)
    if (error) {
      alert('Error importing leads: ' + error.message)
      setLoading(false)
      return
    }
    onSuccess(parsedData.length)
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: '800px' }}>
        <div className="modal-header">
          <span style={{ fontSize: '13px', fontWeight: '500', color: '#ededed' }}>Review Import Data</span>
          <button onClick={onClose} disabled={loading} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>×</button>
        </div>
        
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', gridTemplateColumns: '1fr' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#a0a0a0', fontSize: '13px' }}>Parsing file...</div>
          ) : error ? (
            <div style={{ color: '#f87171', fontSize: '13px' }}>{error}</div>
          ) : (
            <>
              <div style={{ fontSize: '13px', color: '#ededed' }}>
                Detected <strong style={{ color: '#3ecf8e' }}>{parsedData.length}</strong> rows and mapped <strong style={{ color: '#3ecf8e' }}>{mappedHeaders.length}</strong> columns.
              </div>
              
              <div className="table-wrap" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      {mappedHeaders.map((h, i) => <th key={i} style={{ position: 'sticky', top: 0, zIndex: 10 }}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.slice(0, 5).map((row, i) => (
                      <tr key={i}>
                        {mappedHeaders.map((h, j) => (
                          <td key={j} style={{ whiteSpace: 'nowrap', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {row[h] || '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedData.length > 5 && (
                <div style={{ fontSize: '11px', color: '#555', textAlign: 'center' }}>Showing first 5 rows as preview</div>
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose} disabled={loading}>❌ Cancel</button>
          <button className="btn-primary" onClick={handleConfirm} disabled={loading || parsedData.length === 0 || !!error}>✅ Confirm Import</button>
        </div>
      </div>
    </div>
  )
}
