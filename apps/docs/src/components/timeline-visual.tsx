import { cn } from '@/lib/cn'

type TimelineEntry = {
  time: string
  value: string
  highlight?: boolean
}

const defaultEntries: TimelineEntry[] = [
  { time: '09:41', value: '$42.99' },
  { time: '14:22', value: '$39.99' },
  { time: '18:05', value: '$44.99', highlight: true },
]

export function TimelineVisual({
  entries = defaultEntries,
  className,
}: {
  entries?: TimelineEntry[]
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-4 font-mono text-sm', className)}>
      {entries.map((entry, i) => (
        <div key={entry.time} className="flex items-center gap-3">
          <span className="text-muted-foreground min-w-[50px]">
            {entry.time}
          </span>
          <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_var(--color-primary)]" />
          <div className="w-12 h-px bg-gradient-to-r from-primary/50 to-transparent" />
          <span
            className={cn(
              'tabular-nums',
              entry.highlight
                ? 'text-primary font-semibold'
                : i === 0
                  ? 'text-primary/70'
                  : 'text-primary/85',
            )}
          >
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  )
}
