import type { Payload } from 'payload'

import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { startTestDB, stopTestDB } from '../src/test/setupTestDB.js'

let payload: Payload

beforeAll(async () => {
  // Start Testcontainer
  const dbUrl = await startTestDB()
  process.env.DATABASE_URL = dbUrl

  // Dynamic import after setting DATABASE_URL
  const { getPayload } = await import('payload')
  const config = await import('@payload-config')
  payload = await getPayload({ config: config.default })
}, 120_000)

afterAll(async () => {
  // Force cleanup — don't wait for graceful shutdown
  const adapter = payload?.db as any
  if (adapter?.pool) {
    adapter.pool.end().catch(() => {})
  }
  // Don't await stopTestDB — let the process exit naturally
  stopTestDB().catch(() => {})
}, 5_000)

describe('Hypervalue plugin — field-level (narrow tables)', () => {
  let bookId: number | string

  test('creates a book and records initial price history', async () => {
    const book = await payload.create({
      collection: 'books',
      data: {
        title: 'Test Book',
        price: 9.99,
        status: 'available',
      },
    })

    bookId = book.id
    expect(book.price).toBe(9.99)

    // Query history — should have one entry
    const history = await payload.hypervalue.history({
      collection: 'books',
      id: bookId,
      field: 'price',
      overrideAccess: true,
    })

    expect(history.docs).toHaveLength(1)
    expect(Number(history.docs[0].value)).toBe(9.99)
  })

  test('records price change on update', async () => {
    await payload.update({
      collection: 'books',
      where: { id: { equals: bookId } },
      data: { price: 12.99 },
    })

    const history = await payload.hypervalue.history({
      collection: 'books',
      id: bookId,
      field: 'price',
      overrideAccess: true,
    })

    expect(history.docs).toHaveLength(2)
    expect(Number(history.docs[0].value)).toBe(12.99) // most recent first
    expect(Number(history.docs[1].value)).toBe(9.99)
  })

  test('skips recording when value unchanged', async () => {
    await payload.update({
      collection: 'books',
      where: { id: { equals: bookId } },
      data: { title: 'Updated Title' }, // price unchanged
    })

    const history = await payload.hypervalue.history({
      collection: 'books',
      id: bookId,
      field: 'price',
      overrideAccess: true,
    })

    expect(history.docs).toHaveLength(2) // still 2
  })

  test('point-in-time query returns correct value', async () => {
    // The second price (12.99) was the latest
    const history = await payload.hypervalue.history({
      collection: 'books',
      id: bookId,
      field: 'price',
      at: new Date(), // now — should return 12.99
      overrideAccess: true,
    })

    expect(history.docs).toHaveLength(1)
    expect(Number(history.docs[0].value)).toBe(12.99)
  })

  test('records status field changes', async () => {
    const history = await payload.hypervalue.history({
      collection: 'books',
      id: bookId,
      field: 'status',
      overrideAccess: true,
    })

    expect(history.docs).toHaveLength(1)
    expect(history.docs[0].value).toBe('available')

    await payload.update({
      collection: 'books',
      where: { id: { equals: bookId } },
      data: { status: 'out_of_stock' },
    })

    const updated = await payload.hypervalue.history({
      collection: 'books',
      id: bookId,
      field: 'status',
      overrideAccess: true,
    })

    expect(updated.docs).toHaveLength(2)
    expect(updated.docs[0].value).toBe('out_of_stock')
  })

  test('history is deleted when document is deleted (CASCADE)', async () => {
    await payload.delete({
      collection: 'books',
      where: { id: { equals: bookId } },
    })

    // Create a new book to verify we can still query
    const newBook = await payload.create({
      collection: 'books',
      data: { title: 'New Book', price: 5.99, status: 'available' },
    })

    const history = await payload.hypervalue.history({
      collection: 'books',
      id: newBook.id,
      field: 'price',
      overrideAccess: true,
    })

    expect(history.docs).toHaveLength(1)
  })

  test('throws for non-hypervalue field', async () => {
    const book = await payload.create({
      collection: 'books',
      data: { title: 'Another Book', price: 7.99, status: 'available' },
    })

    await expect(
      payload.hypervalue.history({
        collection: 'books',
        id: book.id,
        field: 'title', // not a hypervalue field (no custom.hypervalue)
        overrideAccess: true,
      }),
    ).rejects.toThrow('not a hypervalue field')
  })
})

describe('Hypervalue plugin — collection-level (wide tables)', () => {
  let productId: number | string

  test('creates a product and records full snapshot', async () => {
    const product = await payload.create({
      collection: 'products',
      data: {
        name: 'Widget',
        price: 19.99,
        active: true,
        metadata: { category: 'electronics', rating: 4.5 },
      },
    })

    productId = product.id

    // Query full snapshot — no field param
    const history = await payload.hypervalue.history({
      collection: 'products',
      id: productId,
      overrideAccess: true,
    })

    expect(history.docs).toHaveLength(1)
    const snapshot = history.docs[0] as Record<string, unknown>
    expect(snapshot.recorded_at).toBeDefined()
    expect(snapshot.name).toBe('Widget')
    expect(Number(snapshot.price)).toBe(19.99)
    expect(snapshot.active).toBe(true)
    expect(snapshot.metadata_category).toBe('electronics')
    expect(Number(snapshot.metadata_rating)).toBe(4.5)
  })

  test('records snapshot on update', async () => {
    await payload.update({
      collection: 'products',
      where: { id: { equals: productId } },
      data: { price: 24.99, active: false },
    })

    const history = await payload.hypervalue.history({
      collection: 'products',
      id: productId,
      overrideAccess: true,
    })

    expect(history.docs).toHaveLength(2)
    const latest = history.docs[0] as Record<string, unknown>
    expect(Number(latest.price)).toBe(24.99)
    expect(latest.active).toBe(false)
    // Unchanged fields still present in snapshot
    expect(latest.name).toBe('Widget')
  })

  test('query single field from wide table', async () => {
    const history = await payload.hypervalue.history({
      collection: 'products',
      id: productId,
      field: 'price',
      overrideAccess: true,
    })

    expect(history.docs).toHaveLength(2)
    // Returns { value, recorded_at } shape — same as narrow tables
    expect(Number(history.docs[0].value)).toBe(24.99)
    expect(Number(history.docs[1].value)).toBe(19.99)
  })

  test('point-in-time snapshot query', async () => {
    const history = await payload.hypervalue.history({
      collection: 'products',
      id: productId,
      at: new Date(),
      overrideAccess: true,
    })

    expect(history.docs).toHaveLength(1)
    const snapshot = history.docs[0] as Record<string, unknown>
    expect(Number(snapshot.price)).toBe(24.99)
  })

  test('opted-out field is not in wide table', async () => {
    // 'internal' field has hypervalue: false — should not appear in snapshot
    const history = await payload.hypervalue.history({
      collection: 'products',
      id: productId,
      overrideAccess: true,
    })

    const snapshot = history.docs[0] as Record<string, unknown>
    expect(snapshot).not.toHaveProperty('internal')
  })

  test('history is deleted when product is deleted (CASCADE)', async () => {
    await payload.delete({
      collection: 'products',
      where: { id: { equals: productId } },
    })

    const newProduct = await payload.create({
      collection: 'products',
      data: {
        name: 'Gadget',
        price: 9.99,
        active: true,
        metadata: { category: 'tools', rating: 3.0 },
      },
    })

    const history = await payload.hypervalue.history({
      collection: 'products',
      id: newProduct.id,
      overrideAccess: true,
    })

    expect(history.docs).toHaveLength(1)
  })

  test('throws when querying non-existent field from wide table', async () => {
    const product = await payload.create({
      collection: 'products',
      data: { name: 'Test', price: 1, active: true, metadata: { category: 'x', rating: 1 } },
    })

    await expect(
      payload.hypervalue.history({
        collection: 'products',
        id: product.id,
        field: 'nonexistent',
        overrideAccess: true,
      }),
    ).rejects.toThrow('not a hypervalue field')
  })
})
