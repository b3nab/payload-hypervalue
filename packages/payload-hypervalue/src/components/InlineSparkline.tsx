'use client'
import React, { useEffect, useState } from 'react'
import { useDocumentInfo } from '@payloadcms/ui'

interface HistoryRecord {
  value: number
  recorded_at: string
}

interface InlineSparklineProps {
  collection: string
  field: string
}

export const InlineSparkline: React.FC<InlineSparklineProps> = ({ collection, field }) => {
  const { id } = useDocumentInfo()
  const [data, setData] = useState<HistoryRecord[]>([])

  useEffect(() => {
    if (!id) return

    fetch(`/api/hypervalue/${collection}/${field}/history?id=${id}&limit=30`)
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
  }, [id, collection, field])

  if (!id || data.length === 0) return null

  // Data comes in DESC order (newest first)
  const current = data[0]
  const previous = data[1]

  // Build sparkline from oldest to newest
  const reversed = [...data].reverse()
  const values = reversed.map((d) => d.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const points = values.map((v, i) => {
    const x = values.length === 1 ? 50 : (i / (values.length - 1)) * 100
    const y = 24 - ((v - min) / range) * 20 - 2
    return { x, y }
  })

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const areaPath = `${linePath} L${points[points.length - 1].x},24 L${points[0].x},24 Z`

  // Delta calculation
  let deltaPercent: number | null = null
  let deltaColor = '#6B7280'
  if (previous && previous.value !== 0) {
    deltaPercent = ((current.value - previous.value) / Math.abs(previous.value)) * 100
    deltaColor = deltaPercent >= 0 ? '#22C55E' : '#DC2626'
  }

  return (
    <div style={{ marginTop: '8px' }}>
      <svg
        width="100%"
        height="24"
        viewBox="0 0 100 24"
        preserveAspectRatio="none"
        style={{ display: 'block' }}
      >
        <path d={areaPath} fill="rgba(220, 38, 38, 0.06)" />
        <path d={linePath} fill="none" stroke="#DC2626" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '4px',
          fontSize: '10px',
          fontFamily: 'monospace',
          color: '#6B7280',
        }}
      >
        <span>
          {deltaPercent !== null && (
            <span style={{ color: deltaColor, fontWeight: 600 }}>
              {deltaPercent >= 0 ? '+' : ''}
              {deltaPercent.toFixed(1)}%
            </span>
          )}
        </span>
        {previous && (
          <span>
            prev: {previous.value}
          </span>
        )}
      </div>
    </div>
  )
}
