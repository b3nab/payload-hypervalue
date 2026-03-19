'use client'
import React from 'react'

export const EmptyState: React.FC = () => {
  return (
    <div style={{ marginTop: '8px' }}>
      <svg
        width="100%"
        height="24"
        viewBox="0 0 100 24"
        preserveAspectRatio="none"
        style={{ display: 'block' }}
      >
        <line
          x1="0"
          y1="12"
          x2="100"
          y2="12"
          stroke="#D1D5DB"
          strokeWidth="1"
          strokeDasharray="4 3"
        />
      </svg>
      <div
        style={{
          marginTop: '6px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '6px',
          padding: '6px 8px',
          backgroundColor: '#F5F5F5',
          fontSize: '11px',
          color: '#6B7280',
          lineHeight: '1.4',
        }}
      >
        <span style={{ flexShrink: 0, fontSize: '13px' }}>{'\u24D8'}</span>
        <span>Tracking started. History will appear here after the next change.</span>
      </div>
    </div>
  )
}
