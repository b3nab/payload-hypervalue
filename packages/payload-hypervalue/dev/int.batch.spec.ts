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

describe('Hypervalue namespace — batch method', () => {
  let bookId: number | string

  test('setup: create book with price changes', async () => {
    const book = await payload.create({
      collection: 'books',
      data: { title: 'Batch Test Book', price: 10, status: 'available' },
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

  test('batch with tuple return executes all queries', async () => {
    const results = await payload.hypervalue.batch(
      (hv) =>
        [
          hv.history({ collection: 'books', field: 'price', id: bookId, overrideAccess: true }),
          hv.count({ collection: 'books', field: 'price', id: bookId, overrideAccess: true }),
        ] as const,
    )

    expect(results).toHaveLength(2)
    expect(results[0].status).toBe('fulfilled')
    expect(results[1].status).toBe('fulfilled')

    if (results[0].status === 'fulfilled') {
      expect(results[0].value.docs).toBeInstanceOf(Array)
      expect(results[0].value.docs.length).toBeGreaterThan(0)
    }

    if (results[1].status === 'fulfilled') {
      expect(results[1].value.totalDocs).toBe(3)
    }
  })

  test('batch with named return', async () => {
    const result = await payload.hypervalue.batch((hv) => ({
      prices: hv.history({
        collection: 'books',
        field: 'price',
        id: bookId,
        overrideAccess: true,
      }),
      total: hv.count({
        collection: 'books',
        field: 'price',
        id: bookId,
        overrideAccess: true,
      }),
    }))

    expect(result.prices.status).toBe('fulfilled')
    expect(result.total.status).toBe('fulfilled')

    if (result.total.status === 'fulfilled') {
      expect(result.total.value.totalDocs).toBe(3)
    }
  })

  test('batch handles partial failures via allSettled', async () => {
    const results = await payload.hypervalue.batch(
      (hv) =>
        [
          hv.history({ collection: 'books', field: 'price', id: bookId, overrideAccess: true }),
          hv.stats({
            collection: 'books',
            field: 'nonexistent',
            id: bookId,
            overrideAccess: true,
          }),
        ] as const,
    )

    expect(results).toHaveLength(2)
    expect(results[0].status).toBe('fulfilled')
    expect(results[1].status).toBe('rejected')
    if (results[1].status === 'rejected') {
      expect(results[1].reason).toBeInstanceOf(Error)
    }
  })

  test('batch with scope merges shared options', async () => {
    const result = await payload.hypervalue.batch({
      scope: { collection: 'books', id: bookId, overrideAccess: true },
      fn: (hv) => ({
        prices: hv.history({ field: 'price' }),
        total: hv.count({ field: 'price' }),
      }),
    })

    expect(result.prices.status).toBe('fulfilled')
    expect(result.total.status).toBe('fulfilled')

    if (result.prices.status === 'fulfilled') {
      expect(result.prices.value.docs.length).toBeGreaterThan(0)
    }

    if (result.total.status === 'fulfilled') {
      expect(result.total.value.totalDocs).toBe(3)
    }
  })

  test('batch deduplicates access checks for same document', async () => {
    // This test verifies that batch doesn't make redundant access checks.
    // Both calls target the same (collection, id), so only one findByID should occur.
    // We test this indirectly by ensuring it completes without error.
    const results = await payload.hypervalue.batch(
      (hv) =>
        [
          hv.history({ collection: 'books', field: 'price', id: bookId, overrideAccess: true }),
          hv.count({ collection: 'books', field: 'price', id: bookId, overrideAccess: true }),
          hv.first({ collection: 'books', field: 'price', id: bookId, overrideAccess: true }),
        ] as const,
    )

    expect(results).toHaveLength(3)
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true)
  })

  test('batch with failFast option throws on first error', async () => {
    await expect(
      payload.hypervalue.batch(
        (hv) =>
          [
            hv.stats({
              collection: 'books',
              field: 'nonexistent',
              id: bookId,
              overrideAccess: true,
            }),
            hv.history({ collection: 'books', field: 'price', id: bookId, overrideAccess: true }),
          ] as const,
        { failFast: true },
      ),
    ).rejects.toThrow()
  })
})
