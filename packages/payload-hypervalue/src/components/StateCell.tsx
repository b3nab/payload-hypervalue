'use client'
import React, { useEffect, useState } from 'react'

type Props = {
  collection: string
  field: string
  cellData: unknown
  rowData: Record<string, unknown>
}

interface StateEntry {
  state: string
  duration: number
}

const POSITIVE_STATES = ['active', 'published', 'approved', 'enabled', 'open', 'completed', 'done', 'live']
const NEGATIVE_STATES = ['inactive', 'draft', 'rejected', 'disabled', 'closed', 'failed', 'blocked', 'archived']

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`

  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) {
    const remainingHours = hours % 24
    return `${days}d ${remainingHours}h`
  }

  if (hours > 0) {
    const remainingMinutes = minutes % 60
    return `${hours}h ${remainingMinutes}m`
  }

  return `${minutes}m`
}

function getBadgeColor(state: string): { bg: string; text: string } {
  const lower = state.toLowerCase()
  if (POSITIVE_STATES.includes(lower)) {
    return { bg: 'rgba(34, 197, 94, 0.1)', text: '#16A34A' }
  }
  if (NEGATIVE_STATES.includes(lower)) {
    return { bg: 'rgba(220, 38, 38, 0.1)', text: '#DC2626' }
  }
  return { bg: 'rgba(107, 114, 128, 0.1)', text: '#6B7280' }
}

export const StateCell: React.FC<Props> = ({ collection, field, cellData, rowData }) => {
  const [duration, setDuration] = useState<number | null>(null)
  const docId = rowData?.id
  const currentState = String(cellData ?? '')

  useEffect(() => {
    if (!docId || !currentState) return

    fetch(`/api/hypervalue/${collection}/${field}/timeInState?id=${docId}`)
      .then((res) => res.json())
      .then((json) => {
        const states: StateEntry[] = Array.isArray(json) ? json : json?.data ?? []
        const match = states.find((s) => s.state === currentState)
        if (match) {
          setDuration(match.duration)
        }
      })
      .catch(() => {
        // silently ignore
      })
  }, [docId, collection, field, currentState])

  if (!currentState) {
    return <span>{String(cellData ?? '')}</span>
  }

  const colors = getBadgeColor(currentState)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span
        style={{
          display: 'inline-block',
          padding: '2px 8px',
          backgroundColor: colors.bg,
          color: colors.text,
          fontSize: '11px',
          fontWeight: 600,
          borderRadius: '3px',
        }}
      >
        {currentState}
      </span>
      {duration !== null && (
        <span style={{ fontSize: '10px', color: '#9CA3AF', fontFamily: 'monospace' }}>
          {formatDuration(duration)}
        </span>
      )}
    </div>
  )
}
