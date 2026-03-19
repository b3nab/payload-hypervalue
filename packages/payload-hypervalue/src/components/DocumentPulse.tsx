'use client'
import React, { useEffect, useState } from 'react'
import { useDocumentInfo } from '@payloadcms/ui'

interface DocumentPulseProps {
  trackedFields: string[]
  collection: string
}

interface FieldActivity {
  field: string
  count: number
}

export const DocumentPulse: React.FC<DocumentPulseProps> = ({ trackedFields, collection }) => {
  const { id } = useDocumentInfo()
  const [activities, setActivities] = useState<FieldActivity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id || trackedFields.length === 0) {
      setLoading(false)
      return
    }

    const fetchCounts = async () => {
      try {
        const results = await Promise.all(
          trackedFields.map(async (field) => {
            const res = await fetch(`/api/hypervalue/${collection}/${field}/count?id=${id}`)
            const json = await res.json()
            const count = typeof json === 'number' ? json : json?.count ?? json?.total ?? 0
            return { field, count }
          }),
        )
        setActivities(results)
      } catch {
        // silently ignore fetch errors
      } finally {
        setLoading(false)
      }
    }

    fetchCounts()
  }, [id, collection, trackedFields])

  if (!id || trackedFields.length === 0) return null
  if (loading) {
    return (
      <div
        style={{
          padding: '12px 0',
          fontSize: '10px',
          fontFamily: 'monospace',
          color: '#6B7280',
        }}
      >
        loading pulse...
      </div>
    )
  }
  if (activities.length === 0) return null

  const maxCount = Math.max(...activities.map((a) => a.count), 1)

  const getActivityLevel = (count: number): { label: string; opacity: number } => {
    if (count === 0) return { label: 'none', opacity: 0.05 }
    const ratio = count / maxCount
    if (ratio <= 0.33) return { label: 'low', opacity: 0.25 }
    if (ratio <= 0.66) return { label: 'medium', opacity: 0.55 }
    return { label: 'high', opacity: 1.0 }
  }

  return (
    <div
      style={{
        padding: '12px 0',
        marginBottom: '8px',
        borderBottom: '1px solid rgba(220, 38, 38, 0.1)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginBottom: '10px',
          fontSize: '10px',
          fontFamily: 'monospace',
          fontWeight: 600,
          color: '#DC2626',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        <span style={{ width: 3, height: 10, backgroundColor: '#DC2626' }} />
        field activity
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {activities.map(({ field, count }) => {
          const { opacity } = getActivityLevel(count)
          const barWidth = maxCount > 0 ? Math.max((count / maxCount) * 100, count > 0 ? 4 : 0) : 0

          return (
            <div
              key={field}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '10px',
                fontFamily: 'monospace',
              }}
            >
              <span
                style={{
                  width: '100px',
                  flexShrink: 0,
                  color: '#6B7280',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {field}
              </span>

              <div
                style={{
                  flex: 1,
                  height: '12px',
                  backgroundColor: 'rgba(220, 38, 38, 0.05)',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    width: `${barWidth}%`,
                    height: '100%',
                    backgroundColor: `rgba(220, 38, 38, ${opacity})`,
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>

              <span
                style={{
                  width: '32px',
                  flexShrink: 0,
                  textAlign: 'right',
                  color: count > 0 ? '#DC2626' : '#D1D5DB',
                  fontWeight: count > 0 ? 600 : 400,
                }}
              >
                {count}
              </span>
            </div>
          )
        })}
      </div>

      <div
        style={{
          display: 'flex',
          gap: '12px',
          marginTop: '8px',
          fontSize: '9px',
          fontFamily: 'monospace',
          color: '#9CA3AF',
        }}
      >
        {[
          { label: 'none', opacity: 0.05 },
          { label: 'low', opacity: 0.25 },
          { label: 'medium', opacity: 0.55 },
          { label: 'high', opacity: 1.0 },
        ].map(({ label, opacity }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                backgroundColor: `rgba(220, 38, 38, ${opacity})`,
              }}
            />
            {label}
          </div>
        ))}
      </div>
    </div>
  )
}
