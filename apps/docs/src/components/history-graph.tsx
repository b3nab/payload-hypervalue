'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'

type DataPoint = {
  time: string
  value: number
  label?: string
}

const defaultData: DataPoint[] = [
  { time: '09:00', value: 42.99, label: '$42.99' },
  { time: '10:15', value: 41.5 },
  { time: '11:30', value: 43.2 },
  { time: '12:45', value: 39.99, label: '$39.99' },
  { time: '14:00', value: 40.75 },
  { time: '15:15', value: 42.1 },
  { time: '16:30', value: 44.99, label: '$44.99' },
  { time: '17:45', value: 43.8 },
  { time: '18:05', value: 45.5, label: '$45.50' },
]

export function HistoryGraph({
  data = defaultData,
  className,
}: {
  data?: DataPoint[]
  className?: string
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setAnimated(true)
          observer.disconnect()
        }
      },
      { threshold: 0.3 },
    )
    if (svgRef.current) observer.observe(svgRef.current)
    return () => observer.disconnect()
  }, [])

  const width = 600
  const height = 200
  const padding = { top: 30, right: 50, bottom: 35, left: 15 }

  const minVal = Math.min(...data.map((d) => d.value)) - 2
  const maxVal = Math.max(...data.map((d) => d.value)) + 2

  const xScale = (i: number) =>
    padding.left +
    (i / (data.length - 1)) * (width - padding.left - padding.right)
  const yScale = (v: number) =>
    height -
    padding.bottom -
    ((v - minVal) / (maxVal - minVal)) * (height - padding.top - padding.bottom)

  const points = data.map((d, i) => ({
    x: xScale(i),
    y: yScale(d.value),
    ...d,
  }))

  // Smooth curve path
  const linePath = points
    .map((p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`
      const prev = points[i - 1]
      const cpx = (prev.x + p.x) / 2
      return `C ${cpx} ${prev.y}, ${cpx} ${p.y}, ${p.x} ${p.y}`
    })
    .join(' ')

  // Area fill path
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding.bottom} L ${points[0].x} ${height - padding.bottom} Z`

  return (
    <div className={cn('relative', className)}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        role="img"
        aria-label="Time-series history graph showing field value changes over time"
      >
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--color-primary)"
              stopOpacity="0.2"
            />
            <stop
              offset="100%"
              stopColor="var(--color-primary)"
              stopOpacity="0"
            />
          </linearGradient>
          <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
            <stop
              offset="0%"
              stopColor="var(--color-primary)"
              stopOpacity="0.6"
            />
            <stop
              offset="50%"
              stopColor="var(--color-primary)"
              stopOpacity="1"
            />
            <stop
              offset="100%"
              stopColor="var(--color-primary)"
              stopOpacity="0.8"
            />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((frac) => {
          const y = padding.top + frac * (height - padding.top - padding.bottom)
          return (
            <line
              key={frac}
              x1={padding.left}
              y1={y}
              x2={width - padding.right}
              y2={y}
              stroke="var(--color-border)"
              strokeWidth="0.5"
              strokeDasharray="4 4"
            />
          )
        })}

        {/* Area fill */}
        <path
          d={areaPath}
          fill="url(#areaGradient)"
          className={cn(
            'transition-opacity duration-1000',
            animated ? 'opacity-100' : 'opacity-0',
          )}
        />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke="url(#lineGradient)"
          strokeWidth="2"
          strokeLinecap="round"
          className={cn(
            'transition-all duration-1000',
            animated ? 'opacity-100' : 'opacity-0',
          )}
          style={{
            strokeDasharray: animated ? 'none' : '1000',
            strokeDashoffset: animated ? '0' : '1000',
          }}
        />

        {/* Data points and labels */}
        {points.map((p, i) => (
          <g
            key={p.time}
            className={cn(
              'transition-all duration-500',
              animated ? 'opacity-100' : 'opacity-0',
            )}
            style={{ transitionDelay: `${i * 80}ms` }}
          >
            {/* Point */}
            <circle
              cx={p.x}
              cy={p.y}
              r={p.label ? 4 : 2.5}
              fill="var(--color-primary)"
              filter={p.label ? 'url(#glow)' : undefined}
            />

            {/* Label */}
            {p.label && (
              <text
                x={p.x}
                y={p.y - 12}
                textAnchor="middle"
                className="fill-primary text-[11px] font-mono font-medium"
              >
                {p.label}
              </text>
            )}

            {/* Time axis */}
            {(i === 0 || i === points.length - 1 || p.label) && (
              <text
                x={p.x}
                y={height - padding.bottom + 16}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px] font-mono"
              >
                {p.time}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  )
}
