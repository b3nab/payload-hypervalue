'use client'
import React, { useEffect, useState } from 'react'

type Props = {
  collection: string
  field: string
  cellData: unknown
  rowData: Record<string, unknown>
}

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMinutes < 1) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes} min ago`
  if (diffHours < 24) return `${diffHours} hr ago`
  if (diffDays === 1) return '1 day ago'
  return `${diffDays} days ago`
}

function getDotColor(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = diffMs / (1000 * 60 * 60)
  const diffDays = diffHours / 24

  if (diffHours < 1) return '#22C55E'
  if (diffDays < 7) return '#F59E0B'
  return '#DC2626'
}

function isStale(date: Date): boolean {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  return diffDays > 30
}

export const FreshnessCell: React.FC<Props> = ({ collection, field, cellData, rowData }) => {
  const [lastDate, setLastDate] = useState<Date | null>(null)
  const docId = rowData?.id

  useEffect(() => {
    if (!docId) return

    fetch(`/api/hypervalue/${collection}/${field}/last?id=${docId}`)
      .then((res) => res.json())
      .then((json) => {
        const ts = json?.recorded_at ?? json?.timestamp ?? json?.date
        if (ts) {
          setLastDate(new Date(ts))
        }
      })
      .catch(() => {
        // silently ignore
      })
  }, [docId, collection, field])

  if (!docId || !lastDate) {
    return <span>{String(cellData ?? '')}</span>
  }

  const dotColor = getDotColor(lastDate)
  const stale = isStale(lastDate)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: dotColor,
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: '12px', color: '#374151' }}>
        {formatRelativeTime(lastDate)}
      </span>
      {stale && (
        <span
          style={{
            fontSize: '9px',
            fontWeight: 600,
            color: '#DC2626',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          stale
        </span>
      )}
    </div>
  )
}
