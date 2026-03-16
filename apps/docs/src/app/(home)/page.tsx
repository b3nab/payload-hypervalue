import type { Metadata } from 'next'
import Link from 'next/link'
import { HistoryGraph } from '@/components/history-graph'
import { StackedPanels } from '@/components/stacked-panels'
import { TimelineVisual } from '@/components/timeline-visual'

export const metadata: Metadata = {
  title: 'Payload Hypervalue — The history layer for Payload CMS',
  description:
    'Time-series history for Payload CMS fields. Track every change with TimescaleDB hypertables. Query the full history, a point in time, or a range.',
  openGraph: {
    images: '/og/home',
  },
}

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Hero — split layout */}
      <section className="relative px-4 pt-24 pb-20 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-primary/12 via-transparent to-transparent" />
        </div>

        <div className="relative mx-auto max-w-6xl flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          {/* Left — text */}
          <div className="flex-1 text-center lg:text-left">
            <div className="mb-5 inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-card text-xs font-mono text-muted-foreground">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              @b3nab/payload-hypervalue
            </div>

            <h1 className="mb-6 text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              The history layer{' '}
              <span className="text-primary">for Payload CMS</span>
            </h1>

            <p className="max-w-xl mb-10 text-lg text-muted-foreground leading-relaxed">
              Add{' '}
              <code className="text-xs px-1.5 py-0.5 rounded bg-card border border-border font-mono">
                custom: {'{'} hypervalue: true {'}'}
              </code>{' '}
              to a field or collection, every change gets stored in a
              TimescaleDB hypertable. Query full history, a point in time, or a
              range.
            </p>

            <div className="flex justify-center lg:justify-start gap-3">
              <Link
                href="/docs"
                className="inline-flex items-center px-6 py-2.5 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Get Started
              </Link>
              <Link
                href="https://github.com/b3nab/payload-hypervalue"
                className="inline-flex items-center px-6 py-2.5 text-sm font-medium rounded-lg border border-border hover:bg-accent transition-colors"
              >
                GitHub
              </Link>
            </div>
          </div>

          {/* Right — stacked panels (collection view) */}
          <div className="flex-shrink-0">
            <StackedPanels
              collection="products"
              entries={[
                {
                  timestamp: '2025-06-15',
                  fields: [
                    { name: 'price', type: 'number', value: '$45.50' },
                    { name: 'title', type: 'text', value: 'Widget Pro' },
                    { name: 'status', type: 'select', value: 'published' },
                  ],
                },
                {
                  timestamp: '2025-06-14',
                  fields: [
                    { name: 'price', type: 'number', value: '$44.99' },
                    { name: 'title', type: 'text', value: 'Widget Pro' },
                    { name: 'status', type: 'select', value: 'draft' },
                  ],
                },
                {
                  timestamp: '2025-06-13',
                  fields: [
                    { name: 'price', type: 'number', value: '$39.99' },
                    { name: 'title', type: 'text', value: 'Widget' },
                    { name: 'status', type: 'select', value: 'draft' },
                  ],
                },
                {
                  timestamp: '2025-06-12',
                  fields: [
                    { name: 'price', type: 'number', value: '$42.99' },
                    { name: 'title', type: 'text', value: 'Widget' },
                    { name: 'status', type: 'select', value: 'draft' },
                  ],
                },
                {
                  timestamp: '2025-06-11',
                  fields: [
                    { name: 'price', type: 'number', value: '$41.00' },
                    { name: 'title', type: 'text', value: 'Widget' },
                    { name: 'status', type: 'select', value: 'draft' },
                  ],
                },
              ]}
            />
          </div>
        </div>
      </section>

      {/* Timeline + Graph side by side */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-3 text-2xl font-bold text-center">
            Full history, not just the latest value
          </h2>
          <p className="mb-10 text-sm text-muted-foreground text-center max-w-lg mx-auto">
            Your fields and collections still behave like normal Payload. The
            ones you track with hypervalue also record every change with a
            timestamp. Query their history by point-in-time, range, or get the
            full timeline.
          </p>
          <div className="flex flex-col md:flex-row gap-6 items-center justify-center">
            {/* Timeline list */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="mb-3 text-xs font-mono text-muted-foreground">
                products.price
              </div>
              <TimelineVisual
                entries={[
                  { time: 'Jun 12', value: '$42.99' },
                  { time: 'Jun 13', value: '$39.99' },
                  { time: 'Jun 14', value: '$44.99' },
                  { time: 'Jun 15', value: '$45.50', highlight: true },
                ]}
              />
            </div>
            {/* Graph */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex-1 max-w-2xl">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs font-mono text-muted-foreground">
                  products.price
                </span>
                <span className="text-xs font-mono text-primary">
                  Jun 12–15
                </span>
              </div>
              <HistoryGraph
                data={[
                  { time: 'Jun 12', value: 42.99, label: '$42.99' },
                  { time: 'Jun 13', value: 39.99, label: '$39.99' },
                  { time: 'Jun 14', value: 44.99, label: '$44.99' },
                  { time: 'Jun 15', value: 45.5, label: '$45.50' },
                ]}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-1 gap-px md:grid-cols-3 rounded-xl border border-border overflow-hidden bg-border">
            {[
              {
                title: 'Hypertables',
                desc: 'Each tracked field gets its own TimescaleDB hypertable. Configurable chunk intervals, compression, and retention.',
              },
              {
                title: 'Access control',
                desc: "Queries respect Payload's collection-level access control. Override with overrideAccess when you need to.",
              },
              {
                title: 'Cascade deletes',
                desc: 'Delete a document and its history goes with it. Foreign key constraints handle the cleanup.',
              },
              {
                title: 'Draft awareness',
                desc: 'Optionally track draft saves. Off by default so only published changes are recorded.',
              },
              {
                title: 'Type-safe queries',
                desc: 'payload.hypervalue() is fully typed. Module augmentation adds it to the Payload instance automatically.',
              },
              {
                title: 'All-in-one DB image',
                desc: 'PostgreSQL 17 + PostGIS + pgvector + TimescaleDB. One docker pull, zero extension fiddling.',
              },
            ].map((f) => (
              <div key={f.title} className="p-6 bg-card">
                <h3 className="mb-2 text-sm font-semibold">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Query examples */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-3 text-2xl font-bold text-center">
            Query history from anywhere
          </h2>
          <p className="mb-12 text-sm text-muted-foreground text-center max-w-lg mx-auto">
            Get the full timeline, look up a value at a specific moment, or pull
            a range. Works over REST with the same access control your
            collections already have, or server-side with a typed API.
          </p>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <QueryCard
              title="REST API"
              lines={[
                {
                  label: 'Full history',
                  code: 'GET /api/hypervalue/products/:id/price',
                },
                {
                  label: 'Point in time',
                  code: 'GET ...?at=2025-06-01T00:00:00Z',
                },
                {
                  label: 'Range',
                  code: 'GET ...?from=2025-01-01&to=2025-06-01',
                },
              ]}
            />
            <QueryCard
              title="Local API"
              lines={[
                {
                  label: 'Server-side',
                  code: `const history = await payload.hypervalue({
  collection: 'products',
  id: doc.id,
  field: 'price',
  from: new Date('2025-01-01'),
  to: new Date('2025-06-01'),
})`,
                },
              ]}
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="max-w-xl mx-auto text-center">
          <pre className="mb-8 inline-block px-5 py-3 rounded-lg bg-card border border-border text-sm font-mono text-left">
            <code>
              <span className="text-muted-foreground select-none">$ </span>
              <span className="text-foreground">
                pnpm add @b3nab/payload-hypervalue
              </span>
            </code>
          </pre>
          <div className="flex justify-center gap-3">
            <Link
              href="/docs"
              className="inline-flex items-center px-6 py-2.5 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Read the Docs
            </Link>
            <Link
              href="https://github.com/b3nab/payload-hypervalue"
              className="inline-flex items-center px-6 py-2.5 text-sm font-medium rounded-lg border border-border hover:bg-accent transition-colors"
            >
              View Source
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

function QueryCard({
  title,
  lines,
}: {
  title: string
  lines: { label: string; code: string }[]
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-2.5 text-xs font-medium border-b border-border bg-card/80">
        {title}
      </div>
      <div className="p-4 space-y-4">
        {lines.map((line) => (
          <div key={line.label}>
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              {line.label}
            </span>
            <pre className="mt-1 text-xs font-mono text-primary whitespace-pre-wrap break-all">
              {line.code}
            </pre>
          </div>
        ))}
      </div>
    </div>
  )
}
