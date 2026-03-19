'use client'
import React, { useCallback, useEffect, useState } from 'react'
import { useDocumentInfo } from '@payloadcms/ui'

interface HistoryRecord {
  value: number
  recorded_at: string
}

interface ValueTimelineProps {
  collection: string
  field: string
}

export const ValueTimeline: React.FC<ValueTimelineProps> = ({ collection, field }) => {
  const { id } = useDocumentInfo()
  const [expanded, setExpanded] = useState(false)
  const [data, setData] = useState<HistoryRecord[]>([])
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(() => {
    if (!id) return

    setLoading(true)
    fetch(`/api/hypervalue/${collection}/${field}/history?id=${id}&limit=20`)
      .then((res) => res.json())
      .then((json) => {
        if (Array.isArray(json)) {
          setData(json)
        } else if (json?.data && Array.isArray(json.data)) {
          setData(json.data)
        }
      })
      .catch(() => {
        // silently ignore fetch errors
      })
      .finally(() => {
        setLoading(false)
      })
  }, [id, collection, field])

  useEffect(() => {
    if (expanded && data.length === 0) {
      fetchData()
    }
  }, [expanded, data.length, fetchData])

  if (!id) return null

  const toggleExpanded = () => setExpanded((prev) => !prev)

  const formatTimestamp = (ts: string) => {
    const date = new Date(ts)
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div style={{ marginTop: '12px', border: '1px solid #E5E7EB', overflow: 'hidden' }}>
      {/* Header */}
      <button
        type="button"
        onClick={toggleExpanded}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '8px 10px',
          backgroundColor: '#F5F5F5',
          border: 'none',
          cursor: 'pointer',
          fontSize: '11px',
          fontFamily: 'monospace',
          color: '#374151',
        }}
      >
        <span style={{ fontWeight: 600 }}>
          History
          {data.length > 0 && (
            <span style={{ fontWeight: 400, color: '#9CA3AF', marginLeft: '6px' }}>
              ({data.length} records)
            </span>
          )}
        </span>
        <span
          style={{
            display: 'inline-block',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
            fontSize: '10px',
          }}
        >
          ▼
        </span>
      </button>

      {/* Expanded rows */}
      {expanded && (
        <div>
          {loading && (
            <div style={{ padding: '10px', fontSize: '11px', color: '#9CA3AF', textAlign: 'center' }}>
              Loading...
            </div>
          )}
          {!loading && data.length === 0 && (
            <div style={{ padding: '10px', fontSize: '11px', color: '#9CA3AF', textAlign: 'center' }}>
              No history yet.
            </div>
          )}
          {!loading &&
            data.map((record, index) => {
              // Delta vs next record (data is DESC, so next record is older)
              const older = data[index + 1]
              let deltaPercent: number | null = null
              let accentColor = '#D1D5DB' // gray for first/zero

              if (older && older.value !== 0) {
                deltaPercent = ((record.value - older.value) / Math.abs(older.value)) * 100
                accentColor = deltaPercent >= 0 ? '#22C55E' : '#DC2626'
              }

              const bgColor = index % 2 === 0 ? '#FAFAFA' : '#F9F9F9'

              return (
                <div
                  key={record.recorded_at + '-' + index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: bgColor,
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    borderTop: '1px solid #F0F0F0',
                  }}
                >
                  {/* Color accent bar */}
                  <div
                    style={{
                      width: '3px',
                      alignSelf: 'stretch',
                      backgroundColor: accentColor,
                      flexShrink: 0,
                    }}
                  />
                  {/* Value */}
                  <div
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      fontWeight: 600,
                      color: '#111827',
                    }}
                  >
                    {record.value}
                  </div>
                  {/* Delta */}
                  <div
                    style={{
                      width: '70px',
                      textAlign: 'right',
                      padding: '6px 0',
                      color: accentColor,
                      fontWeight: 500,
                    }}
                  >
                    {deltaPercent !== null
                      ? `${deltaPercent >= 0 ? '+' : ''}${deltaPercent.toFixed(1)}%`
                      : '—'}
                  </div>
                  {/* Timestamp */}
                  <div
                    style={{
                      width: '110px',
                      textAlign: 'right',
                      padding: '6px 10px',
                      color: '#9CA3AF',
                    }}
                  >
                    {formatTimestamp(record.recorded_at)}
                  </div>
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}
