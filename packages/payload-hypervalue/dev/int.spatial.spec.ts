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

describe('Hypervalue namespace — spatial methods', () => {
  let vehicleId: number | string

  // Known locations (lng, lat)
  const newYork: [number, number] = [-73.9857, 40.7484]
  const timesSquare: [number, number] = [-73.9855, 40.758]
  const brooklyn: [number, number] = [-73.9442, 40.6782]
  const losAngeles: [number, number] = [-118.2437, 34.0522]

  test('setup: create vehicle and record location changes', async () => {
    const vehicle = await payload.create({
      collection: 'vehicles',
      data: {
        name: 'Test Truck',
        location: newYork,
      },
    })
    vehicleId = vehicle.id

    await new Promise((r) => setTimeout(r, 50))

    await payload.update({
      collection: 'vehicles',
      id: vehicleId,
      data: { location: timesSquare },
    })

    await new Promise((r) => setTimeout(r, 50))

    await payload.update({
      collection: 'vehicles',
      id: vehicleId,
      data: { location: brooklyn },
    })
  })

  test('history() works for point fields', async () => {
    const result = await payload.hypervalue.history({
      collection: 'vehicles',
      id: vehicleId,
      field: 'location',
      overrideAccess: true,
    })

    expect(result.docs).toHaveLength(3)
  })

  test('nearby() finds vehicle within radius', async () => {
    // Search near New York — should find the vehicle
    const result = await payload.hypervalue.nearby({
      collection: 'vehicles',
      point: newYork,
      maxDistance: 50000, // 50km — should cover all NYC points
      overrideAccess: true,
    })

    expect(result.docs.length).toBeGreaterThan(0)
    // All results should have distance field
    for (const doc of result.docs) {
      expect(doc).toHaveProperty('distance')
      expect(doc).toHaveProperty('value')
      expect(doc).toHaveProperty('documentId')
      expect(doc).toHaveProperty('recorded_at')
      expect(doc.distance).toBeLessThanOrEqual(50000)
    }
  })

  test('nearby() respects maxDistance', async () => {
    // Search with very small radius — should not find Brooklyn or LA
    const result = await payload.hypervalue.nearby({
      collection: 'vehicles',
      point: newYork,
      maxDistance: 100, // 100 meters
      overrideAccess: true,
    })

    // Only the exact New York point (or very close ones) should appear
    for (const doc of result.docs) {
      expect(doc.distance).toBeLessThanOrEqual(100)
    }
  })

  test('nearby() without maxDistance returns all sorted by distance', async () => {
    const result = await payload.hypervalue.nearby({
      collection: 'vehicles',
      point: newYork,
      overrideAccess: true,
    })

    expect(result.docs.length).toBe(3)
    // Should be sorted by distance ascending
    for (let i = 1; i < result.docs.length; i++) {
      expect(result.docs[i].distance).toBeGreaterThanOrEqual(result.docs[i - 1].distance)
    }
  })

  test('nearby() auto-detects point field', async () => {
    // Don't pass field — should auto-detect "location"
    const result = await payload.hypervalue.nearby({
      collection: 'vehicles',
      point: newYork,
      overrideAccess: true,
    })

    expect(result.docs.length).toBeGreaterThan(0)
  })

  test('within() finds points inside polygon', async () => {
    // Create a polygon around NYC (covers Manhattan and Brooklyn)
    const nycPolygon = {
      type: 'Polygon',
      coordinates: [[
        [-74.1, 40.6],
        [-73.8, 40.6],
        [-73.8, 40.9],
        [-74.1, 40.9],
        [-74.1, 40.6],
      ]],
    }

    const result = await payload.hypervalue.within({
      collection: 'vehicles',
      geometry: nycPolygon,
      overrideAccess: true,
    })

    expect(result.docs.length).toBe(3) // All 3 NYC points
    for (const doc of result.docs) {
      expect(doc).toHaveProperty('value')
      expect(doc).toHaveProperty('documentId')
      expect(doc).toHaveProperty('recorded_at')
    }
  })

  test('within() excludes points outside polygon', async () => {
    // Create a polygon only around Manhattan (should miss Brooklyn)
    const manhattanPolygon = {
      type: 'Polygon',
      coordinates: [[
        [-74.02, 40.7],
        [-73.95, 40.7],
        [-73.95, 40.8],
        [-74.02, 40.8],
        [-74.02, 40.7],
      ]],
    }

    const result = await payload.hypervalue.within({
      collection: 'vehicles',
      geometry: manhattanPolygon,
      overrideAccess: true,
    })

    // Should find New York and Times Square but not Brooklyn
    expect(result.docs.length).toBe(2)
  })

  test('trajectory() returns path for vehicle', async () => {
    const result = await payload.hypervalue.trajectory({
      collection: 'vehicles',
      id: vehicleId,
      overrideAccess: true,
    })

    expect(result.doc).toBeDefined()
    expect(result.doc.points).toHaveLength(3)

    // Points should be in chronological order
    for (let i = 1; i < result.doc.points.length; i++) {
      expect(new Date(result.doc.points[i].recorded_at).getTime())
        .toBeGreaterThanOrEqual(new Date(result.doc.points[i - 1].recorded_at).getTime())
    }

    // Each point should have coordinates
    for (const p of result.doc.points) {
      expect(p.coordinates).toHaveLength(2)
      expect(typeof p.coordinates[0]).toBe('number')
      expect(typeof p.coordinates[1]).toBe('number')
    }

    // Should have a LineString GeoJSON
    expect(result.doc.lineString).toBeDefined()
    expect(result.doc.lineString).toHaveProperty('type', 'LineString')
    expect((result.doc.lineString as any).coordinates).toHaveLength(3)
  })

  test('trajectory() requires id', async () => {
    await expect(
      payload.hypervalue.trajectory({
        collection: 'vehicles',
        id: undefined as any,
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })

  test('trajectory() returns empty for non-existent document', async () => {
    const result = await payload.hypervalue.trajectory({
      collection: 'vehicles',
      id: 99999,
      overrideAccess: true,
    })

    expect(result.doc.points).toHaveLength(0)
    expect(result.doc.lineString).toBeNull()
  })

  test('nearby() with second vehicle', async () => {
    // Create a vehicle in LA
    await payload.create({
      collection: 'vehicles',
      data: {
        name: 'LA Van',
        location: losAngeles,
      },
    })

    // Search near LA — should find the LA vehicle
    const result = await payload.hypervalue.nearby({
      collection: 'vehicles',
      point: losAngeles,
      maxDistance: 1000, // 1km
      overrideAccess: true,
    })

    expect(result.docs.length).toBe(1)
    expect(result.docs[0].value[0]).toBeCloseTo(losAngeles[0], 3)
    expect(result.docs[0].value[1]).toBeCloseTo(losAngeles[1], 3)
  })
})
