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
    expect(Number(snapshot.price)).toBe(200)
    expect(snapshot.name).toBe('Widget')
    expect(snapshot.active).toBe(true) // still true at second snapshot
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
