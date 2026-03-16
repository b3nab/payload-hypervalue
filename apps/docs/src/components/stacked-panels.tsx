'use client'

import { cn } from '@/lib/cn'

type HistoryEntry = {
  timestamp: string
  fields: { name: string; type: string; value: string }[]
}

export function StackedPanels({
  collection,
  entries,
  className,
}: {
  collection: string
  entries: HistoryEntry[]
  className?: string
}) {
  return (
    <div
      className={cn('flex items-center justify-center', className)}
      style={{ perspective: '1200px' }}
    >
      <div
        className="relative"
        style={{
          transformStyle: 'preserve-3d',
          transform: 'rotateX(8deg) rotateY(28deg)',
        }}
      >
        {entries.map((entry, i) => (
          <div
            key={entry.timestamp}
            className={cn(
              'w-[300px] sm:w-[360px] rounded-lg border border-border bg-card',
              i === 0 ? 'relative shadow-xl' : 'absolute inset-0',
            )}
            style={{
              transform: `translateZ(${-i * 80}px) translateY(${i * 8}px)`,
              opacity: Math.max(0.06, 1 - i * 0.25),
              zIndex: entries.length - i,
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-border text-[10px] font-mono text-muted-foreground">
              <span>{collection}</span>
              <span className="tabular-nums">{entry.timestamp}</span>
            </div>
            {/* Fields */}
            <div className="px-4 py-2.5 space-y-1.5">
              {entry.fields.map((field) => (
                <div
                  key={field.name}
                  className="flex items-baseline justify-between gap-4"
                >
                  <span className="text-[11px] font-mono text-muted-foreground truncate">
                    {field.name}
                    <span className="text-muted-foreground/50 ml-1">
                      {field.type}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'font-mono tabular-nums text-sm shrink-0',
                      i === 0 ? 'text-primary font-medium' : 'text-foreground',
                    )}
                  >
                    {field.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
