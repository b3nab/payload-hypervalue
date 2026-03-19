'use client'
import React, { useEffect, useState } from 'react'

type Props = {
  collection: string
  field: string
  cellData: unknown
  rowData: Record<string, unknown>
}

interface HistoryRecord {
  value: number
  recorded_at: string
}

export const TrendCell: React.FC<Props> = ({ collection, field, cellData, rowData }) => {
  const [history, setHistory] = useState<HistoryRecord[]>([])
  const docId = rowData?.id

  useEffect(() => {
    if (!docId) return

    fetch(`/api/hypervalue/${collection}/${field}/history?id=${docId}&limit=10`)
      .then((res) => res.json())
      .then((json) => {
        if (Array.isArray(json)) {
          setHistory(json)
        } else if (json?.data && Array.isArray(json.data)) {
          setHistory(json.data)
        }
      })
      .catch(() => {
        // silently ignore
      })
  }, [docId, collection, field])

  if (!docId || history.length === 0) {
    return <span>{String(cellData ?? '')}</span>
  }

  // Data comes in DESC order — reverse for sparkline (oldest to newest)
  const reversed = [...history].reverse()
  const values = reversed.map((d) => d.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const points = values.map((v, i) => {
    const x = values.length === 1 ? 30 : (i / (values.length - 1)) * 60
    const y = 14 - ((v - min) / range) * 12 - 1
    return { x, y }
  })

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')

  // Delta calculation
  const current = history[0]
  const previous = history[1]
  let deltaPercent: number | null = null
  let deltaColor = '#6B7280'
  let arrow = ''

  if (previous && previous.value !== 0) {
    deltaPercent = ((current.value - previous.value) / Math.abs(previous.value)) * 100
    deltaColor = deltaPercent >= 0 ? '#22C55E' : '#DC2626'
    arrow = deltaPercent >= 0 ? '\u25B2' : '\u25BC'
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ fontWeight: 600, fontSize: '12px' }}>{String(cellData ?? '')}</span>
      <svg width="60" height="16" viewBox="0 0 60 16" style={{ flexShrink: 0 }}>
        <path
          d={linePath}
          fill="none"
          stroke={deltaPercent !== null && deltaPercent >= 0 ? '#22C55E' : '#DC2626'}
          strokeWidth="1.5"
        />
      </svg>
      {deltaPercent !== null && (
        <span style={{ fontSize: '10px', color: deltaColor, fontWeight: 600, whiteSpace: 'nowrap' }}>
          {arrow} {Math.abs(deltaPercent).toFixed(1)}%
        </span>
      )}
    </div>
  )
}
