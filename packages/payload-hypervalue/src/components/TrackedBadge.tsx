'use client'
import React from 'react'

export const TrackedBadge: React.FC = () => {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 6px',
        backgroundColor: 'rgba(220, 38, 38, 0.07)',
        fontSize: '9px',
        fontFamily: 'monospace',
        fontWeight: 500,
        color: '#DC2626',
        marginLeft: '8px',
      }}
    >
      <span style={{ width: 3, height: 10, backgroundColor: '#DC2626' }} />
      tracked
    </span>
  )
}
