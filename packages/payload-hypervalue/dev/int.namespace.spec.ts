import type { Payload } from 'payload'

import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { startTestDB, stopTestDB } from '../src/test/setupTestDB.js'

let payload: Payload

beforeAll(async () => {
  const dbUrl = await startTestDB()
  process.env.DATABASE_URL = dbUrl

  const { getPayload } = await import('payload')
  const config = await import('@payload-config')
  payload = await getPayload({ config: config.default })
}, 120_000)

afterAll(async () => {
  const adapter = payload?.db as any
  if (adapter?.pool) {
    adapter.pool.end().catch(() => {})
  }
  stopTestDB().catch(() => {})
}, 5_000)

describe('Hypervalue namespace — first, last, count, valueAt (narrow tables)', () => {
  let bookId: number | string

  test('setup: create book with price changes', async () => {
    const book = await payload.create({
      collection: 'books',
      data: { title: 'Query Test Book', price: 10, status: 'available' },
    })
    bookId = book.id

    // Small delay to ensure different recorded_at timestamps
    await new Promise((r) => setTimeout(r, 50))

    await payload.update({
      collection: 'books',
      where: { id: { equals: bookId } },
      data: { price: 20 },
    })

    await new Promise((r) => setTimeout(r, 50))

    await payload.update({
      collection: 'books',
      where: { id: { equals: bookId } },
      data: { price: 30 },
    })
  })

  test('first() returns the earliest value', async () => {
    const result = await payload.hypervalue.first({
      collection: 'books',
      field: 'price',
      id: bookId,
      overrideAccess: true,
    })

    expect(result.doc).not.toBeNull()
    expect(Number(result.doc!.value)).toBe(10)
    expect(result.doc!.recorded_at).toBeDefined()
  })

  test('last() returns the most recent value', async () => {
    const result = await payload.hypervalue.last({
      collection: 'books',
      field: 'price',
      id: bookId,
      overrideAccess: true,
    })

    expect(result.doc).not.toBeNull()
    expect(Number(result.doc!.value)).toBe(30)
    expect(result.doc!.recorded_at).toBeDefined()
  })

  test('count() returns correct count', async () => {
    const result = await payload.hypervalue.count({
      collection: 'books',
      field: 'price',
      id: bookId,
      overrideAccess: true,
    })

    expect(result.totalDocs).toBe(3)
  })

  test('valueAt() returns the value at a given point in time', async () => {
    // Get all history to find timestamps
    const history = await payload.hypervalue.history({
      collection: 'books',
      id: bookId,
      field: 'price',
      overrideAccess: true,
    })

    // history is DESC, so docs[2] is the earliest, docs[0] is latest
    const secondTimestamp = history.docs[1].recorded_at

    // Query at the second value's timestamp — should return 20
    const result = await payload.hypervalue.valueAt({
      collection: 'books',
      field: 'price',
      id: bookId,
      at: new Date(secondTimestamp),
      overrideAccess: true,
    })

    expect(result.doc).not.toBeNull()
    expect(Number(result.doc!.value)).toBe(20)
  })

  test('valueAt() returns null when no data exists before given time', async () => {
    const result = await payload.hypervalue.valueAt({
      collection: 'books',
      field: 'price',
      id: bookId,
      at: new Date('2000-01-01T00:00:00Z'),
      overrideAccess: true,
    })

    expect(result.doc).toBeNull()
  })

  test('first() throws for non-hypervalue field', async () => {
    await expect(
      payload.hypervalue.first({
        collection: 'books',
        field: 'title',
        id: bookId,
        overrideAccess: true,
      }),
    ).rejects.toThrow('not a hypervalue field')
  })
})

describe('Hypervalue namespace — aggregation methods', () => {
  let bookId: number | string

  test('setup: create book with price changes for aggregation', async () => {
    const book = await payload.create({
      collection: 'books',
      data: { title: 'Aggregation Test Book', price: 10, status: 'available' },
    })
    bookId = book.id

    await new Promise((r) => setTimeout(r, 50))

    await payload.update({
      collection: 'books',
      where: { id: { equals: bookId } },
      data: { price: 20 },
    })

    await new Promise((r) => setTimeout(r, 50))

    await payload.update({
      collection: 'books',
      where: { id: { equals: bookId } },
      data: { price: 30 },
    })
  })

  test('aggregate() with interval returns bucketed averages', async () => {
    const result = await payload.hypervalue.aggregate({
      collection: 'books',
      field: 'price',
      id: bookId,
      interval: '1 day',
      metric: 'avg',
      overrideAccess: true,
    })
    expect((result as any).docs).toBeInstanceOf(Array)
    expect((result as any).docs[0]).toHaveProperty('bucket')
    expect((result as any).docs[0]).toHaveProperty('value')
  })

  test('aggregate() without interval returns single value', async () => {
    const result = await payload.hypervalue.aggregate({
      collection: 'books',
      field: 'price',
      id: bookId,
      metric: 'avg',
      overrideAccess: true,
    })
    expect((result as any).doc).toHaveProperty('value')
    expect((result as any).doc.value).toBe(20) // avg of 10, 20, 30
  })

  test('aggregate() count works on any field type', async () => {
    const result = await payload.hypervalue.aggregate({
      collection: 'books',
      field: 'price',
      id: bookId,
      metric: 'count',
      overrideAccess: true,
    })
    expect((result as any).doc.value).toBe(3)
  })

  test('aggregate() rejects non-numeric field for avg', async () => {
    await expect(
      payload.hypervalue.aggregate({
        collection: 'books',
        field: 'status',
        id: bookId,
        metric: 'avg',
        overrideAccess: true,
      }),
    ).rejects.toThrow(/numeric/)
  })

  test('stats() returns statistical summary', async () => {
    const result = await payload.hypervalue.stats({
      collection: 'books',
      field: 'price',
      id: bookId,
      overrideAccess: true,
    })
    expect(result.doc).toHaveProperty('mean')
    expect(result.doc).toHaveProperty('stddev')
    expect(result.doc).toHaveProperty('variance')
    expect(result.doc).toHaveProperty('min')
    expect(result.doc).toHaveProperty('max')
    expect(result.doc).toHaveProperty('count')
    expect(result.doc.count).toBe(3)
    expect(result.doc.mean).toBe(20) // avg of 10, 20, 30
    expect(result.doc.min).toBe(10)
    expect(result.doc.max).toBe(30)
  })

  test('stats() rejects non-numeric field', async () => {
    await expect(
      payload.hypervalue.stats({
        collection: 'books',
        field: 'status',
        id: bookId,
        overrideAccess: true,
      }),
    ).rejects.toThrow(/numeric/)
  })

  test('percentile() returns percentile values', async () => {
    const result = await payload.hypervalue.percentile({
      collection: 'books',
      field: 'price',
      id: bookId,
      percentiles: [0.5],
      overrideAccess: true,
    })
    expect(result.doc).toHaveProperty('0.5')
    expect(result.doc['0.5']).toBeGreaterThanOrEqual(10)
    expect(result.doc['0.5']).toBeLessThanOrEqual(30)
  })

  test('percentile() with multiple percentiles', async () => {
    const result = await payload.hypervalue.percentile({
      collection: 'books',
      field: 'price',
      id: bookId,
      percentiles: [0.25, 0.5, 0.75],
      overrideAccess: true,
    })
    expect(result.doc).toHaveProperty('0.25')
    expect(result.doc).toHaveProperty('0.5')
    expect(result.doc).toHaveProperty('0.75')
  })

  test('percentile() rejects non-numeric field', async () => {
    await expect(
      payload.hypervalue.percentile({
        collection: 'books',
        field: 'status',
        id: bookId,
        percentiles: [0.5],
        overrideAccess: true,
      }),
    ).rejects.toThrow(/numeric/)
  })
})

describe('Hypervalue namespace — first, last, count, valueAt (wide tables)', () => {
  let productId: number | string

  test('setup: create product with updates', async () => {
    const product = await payload.create({
      collection: 'products',
      data: {
        name: 'Widget',
        price: 100,
        active: true,
        metadata: { category: 'electronics', rating: 4.0 },
      },
    })
    productId = product.id

    await new Promise((r) => setTimeout(r, 50))

    await payload.update({
      collection: 'products',
      where: { id: { equals: productId } },
      data: { price: 200 },
    })

    await new Promise((r) => setTimeout(r, 50))

    await payload.update({
      collection: 'products',
      where: { id: { equals: productId } },
      data: { price: 300, active: false },
    })
  })

  test('first() returns earliest value from wide table field', async () => {
    const result = await payload.hypervalue.first({
      collection: 'products',
      field: 'price',
      id: productId,
      overrideAccess: true,
    })

    expect(result.doc).not.toBeNull()
    expect(Number(result.doc!.value)).toBe(100)
  })

  test('last() returns most recent value from wide table field', async () => {
    const result = await payload.hypervalue.last({
      collection: 'products',
      field: 'price',
      id: productId,
      overrideAccess: true,
    })

    expect(result.doc).not.toBeNull()
    expect(Number(result.doc!.value)).toBe(300)
  })

  test('count() with field on wide table', async () => {
    const result = await payload.hypervalue.count({
      collection: 'products',
      field: 'price',
      id: productId,
      overrideAccess: true,
    })

    expect(result.totalDocs).toBe(3)
  })

  test('count() without field on wide table', async () => {
    const result = await payload.hypervalue.count({
      collection: 'products',
      id: productId,
      overrideAccess: true,
    })

    expect(result.totalDocs).toBe(3)
  })

  test('valueAt() without field returns full snapshot from wide table', async () => {
    const history = await payload.hypervalue.history({
      collection: 'products',
      id: productId,
      overrideAccess: true,
    })

    // Get the second snapshot's timestamp
    const secondTimestamp = history.docs[1].recorded_at

    const result = await payload.hypervalue.valueAt({
      collection: 'products',
      id: productId,
      at: new Date(secondTimestamp),
      overrideAccess: true,
    })

    expect(result.doc).not.toBeNull()
    const snapshot = result.doc as Record<string, unknown>
    // Sparse rows: only changed fields have values, unchanged fields are NULL
    expect(Number(snapshot.price)).toBe(200)
    // name and active were not changed in this update, so they're NULL in this row
    expect(snapshot.name).toBeNull()
    expect(snapshot.active).toBeNull()
  })

  test('valueAt() with field on wide table', async () => {
    const result = await payload.hypervalue.valueAt({
      collection: 'products',
      field: 'price',
      id: productId,
      at: new Date(),
      overrideAccess: true,
    })

    expect(result.doc).not.toBeNull()
    expect(Number(result.doc!.value)).toBe(300)
  })
})

describe('Hypervalue namespace — analysis methods', () => {
  let bookId: number | string

  test('setup: create book with price and status changes', async () => {
    const book = await payload.create({
      collection: 'books',
      data: { title: 'Analysis Test Book', price: 10, status: 'available' },
    })
    bookId = book.id

    await new Promise((r) => setTimeout(r, 50))

    await payload.update({
      collection: 'books',
      where: { id: { equals: bookId } },
      data: { price: 20, status: 'out_of_stock' },
    })

    await new Promise((r) => setTimeout(r, 50))

    await payload.update({
      collection: 'books',
      where: { id: { equals: bookId } },
      data: { price: 35 },
    })
  })

  test('delta() returns per-record deltas', async () => {
    // First verify how many price records exist
    const count = await payload.hypervalue.count({
      collection: 'books',
      field: 'price',
      id: bookId,
      overrideAccess: true,
    })

    const result = await payload.hypervalue.delta({
      collection: 'books',
      field: 'price',
      id: bookId,
      overrideAccess: true,
    })
    expect(result.docs).toBeInstanceOf(Array)
    // deltas = count - 1 (first record has no previous to compare)
    expect(result.docs.length).toBe(count.totalDocs - 1)
    expect(result.docs.length).toBeGreaterThanOrEqual(1)
    const first = result.docs[0] as any
    expect(first).toHaveProperty('delta')
    expect(first).toHaveProperty('rate')
    expect(first).toHaveProperty('recorded_at')
    expect(typeof first.delta).toBe('number')
  })

  test('delta() with interval returns bucketed deltas', async () => {
    const result = await payload.hypervalue.delta({
      collection: 'books',
      field: 'price',
      id: bookId,
      interval: '1 day',
      overrideAccess: true,
    })
    expect(result.docs).toBeInstanceOf(Array)
    expect(result.docs.length).toBeGreaterThanOrEqual(1)
    const first = result.docs[0] as any
    expect(first).toHaveProperty('bucket')
    expect(first).toHaveProperty('delta')
  })

  test('delta() rejects non-numeric field', async () => {
    await expect(
      payload.hypervalue.delta({
        collection: 'books',
        field: 'status',
        id: bookId,
        overrideAccess: true,
      }),
    ).rejects.toThrow(/numeric/)
  })

  test('timeInState() returns state durations', async () => {
    const result = await payload.hypervalue.timeInState({
      collection: 'books',
      field: 'status',
      id: bookId,
      overrideAccess: true,
    })
    expect(result.docs).toBeInstanceOf(Array)
    expect(result.docs.length).toBeGreaterThan(0)
    expect(result.docs[0]).toHaveProperty('state')
    expect(result.docs[0]).toHaveProperty('duration')
    expect(result.docs[0]).toHaveProperty('unit')
    expect(result.docs[0].unit).toBe('seconds')
  })

  test('gapfill() fills missing buckets', async () => {
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const result = await payload.hypervalue.gapfill({
      collection: 'books',
      field: 'price',
      id: bookId,
      interval: '1 day',
      from: weekAgo,
      to: now,
      overrideAccess: true,
    })
    expect(result.docs).toBeInstanceOf(Array)
    // Should have ~7-8 buckets (one per day)
    expect(result.docs.length).toBeGreaterThanOrEqual(7)
    expect(result.docs[0]).toHaveProperty('bucket')
    expect(result.docs[0]).toHaveProperty('value')
  })

  test('gapfill() throws when from/to missing', async () => {
    await expect(
      payload.hypervalue.gapfill({
        collection: 'books',
        field: 'price',
        id: bookId,
        interval: '1 day',
        overrideAccess: true,
      } as any),
    ).rejects.toThrow()
  })
})

describe('Hypervalue namespace — topN and candlestick', () => {
  let bookId: number | string

  test('setup: create book with price changes for topN/candlestick', async () => {
    const book = await payload.create({
      collection: 'books',
      data: { title: 'TopN Candlestick Test Book', price: 10, status: 'available' },
    })
    bookId = book.id

    await new Promise((r) => setTimeout(r, 50))

    await payload.update({
      collection: 'books',
      where: { id: { equals: bookId } },
      data: { price: 20 },
    })

    await new Promise((r) => setTimeout(r, 50))

    await payload.update({
      collection: 'books',
      where: { id: { equals: bookId } },
      data: { price: 35 },
    })
  })

  test('topN() returns N highest values', async () => {
    const result = await payload.hypervalue.topN({
      collection: 'books',
      field: 'price',
      id: bookId,
      n: 2,
      direction: 'desc',
      overrideAccess: true,
    })
    expect(result.docs).toBeInstanceOf(Array)
    expect(result.docs.length).toBeLessThanOrEqual(2)
    if (result.docs.length === 2) {
      expect(Number(result.docs[0].value)).toBeGreaterThanOrEqual(Number(result.docs[1].value))
    }
  })

  test('topN() returns N lowest values', async () => {
    const result = await payload.hypervalue.topN({
      collection: 'books',
      field: 'price',
      id: bookId,
      n: 1,
      direction: 'asc',
      overrideAccess: true,
    })
    expect(result.docs).toHaveLength(1)
  })

  test('candlestick() returns OHLCV buckets', async () => {
    const result = await payload.hypervalue.candlestick({
      collection: 'books',
      field: 'price',
      id: bookId,
      interval: '1 day',
      overrideAccess: true,
    })
    expect(result.docs).toBeInstanceOf(Array)
    expect(result.docs.length).toBeGreaterThan(0)
    const candle = result.docs[0]
    expect(candle).toHaveProperty('bucket')
    expect(candle).toHaveProperty('open')
    expect(candle).toHaveProperty('high')
    expect(candle).toHaveProperty('low')
    expect(candle).toHaveProperty('close')
    expect(candle).toHaveProperty('volume')
  })

  test('candlestick() rejects non-numeric field', async () => {
    await expect(
      payload.hypervalue.candlestick({
        collection: 'books',
        field: 'status',
        id: bookId,
        interval: '1 day',
        overrideAccess: true,
      }),
    ).rejects.toThrow(/numeric/)
  })
})
