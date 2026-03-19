'use client'
import React, { useEffect, useState } from 'react'
import { useDocumentInfo } from '@payloadcms/ui'
import { EmptyState } from './EmptyState.js'
import { InlineSparkline } from './InlineSparkline.js'
import { ValueTimeline } from './ValueTimeline.js'

interface HypervalueFieldWrapperProps {
  collection: string
  field: string
}

export const HypervalueFieldWrapper: React.FC<HypervalueFieldWrapperProps> = ({
  collection,
  field,
}) => {
  const { id } = useDocumentInfo()
  const [count, setCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) {
      setLoading(false)
      return
    }

    setLoading(true)
    fetch(`/api/hypervalue/${collection}/${field}/count?id=${id}`)
      .then((res) => res.json())
      .then((json) => {
        const c = typeof json === 'number' ? json : json?.count ?? 0
        setCount(c)
      })
      .catch(() => {
        setCount(0)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [id, collection, field])

  if (!id) return null

  if (loading) {
    return (
      <div
        style={{
          marginTop: '8px',
          height: '24px',
          backgroundColor: '#F5F5F5',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}
      />
    )
  }

  if (count === 0) {
    return <EmptyState />
  }

  return (
    <div>
      <InlineSparkline collection={collection} field={field} />
      <ValueTimeline collection={collection} field={field} />
    </div>
  )
}
