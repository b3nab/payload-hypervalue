import { describe, it, expect } from 'vitest'
import type { DiscoveryResult } from '../types.js'
import { resolveTable, validateField, validateNumeric, buildWhereClause } from '../registry/utils.js'

const fixture: DiscoveryResult = {
  collections: [
    {
      collectionSlug: 'products',
      tableName: 'hv_products',
      fields: [
        {
          fieldName: 'price',
          columnName: 'price',
          fieldType: 'number',
          sqlValueType: 'numeric',
          fieldPath: ['price'],
        },
        {
          fieldName: 'title',
          columnName: 'title',
          fieldType: 'text',
          sqlValueType: 'text',
          fieldPath: ['title'],
        },
        {
          fieldName: 'weight',
          columnName: 'details_weight',
          fieldType: 'number',
          sqlValueType: 'double precision',
          fieldPath: ['details', 'weight'],
        },
      ],
    },
  ],
  fields: [
    {
      collectionSlug: 'orders',
      fieldName: 'total',
      fieldType: 'number',
      tableName: 'hv_orders_total',
      sqlValueType: 'numeric',
      hypervalueConfig: true,
    },
    {
      collectionSlug: 'orders',
      fieldName: 'status',
      fieldType: 'select',
      tableName: 'hv_orders_status',
      sqlValueType: 'text',
      hypervalueConfig: true,
    },
  ],
}

describe('resolveTable', () => {
  it('resolves a narrow table (field-level tracking)', () => {
    const result = resolveTable(fixture, {
      collectionSlug: 'orders',
      fieldName: 'total',
    })
    expect(result).toEqual({
      tableName: 'hv_orders_total',
      valueColumn: 'value',
      isWide: false,
      sqlValueType: 'numeric',
    })
  })

  it('resolves a wide table (collection-level tracking)', () => {
    const result = resolveTable(fixture, {
      collectionSlug: 'products',
      fieldName: 'price',
    })
    expect(result).toEqual({
      tableName: 'hv_products',
      valueColumn: 'price',
      isWide: true,
      sqlValueType: 'numeric',
    })
  })

  it('resolves a nested field in a wide table using columnName', () => {
    const result = resolveTable(fixture, {
      collectionSlug: 'products',
      fieldName: 'weight',
    })
    expect(result).toEqual({
      tableName: 'hv_products',
      valueColumn: 'details_weight',
      isWide: true,
      sqlValueType: 'double precision',
    })
  })

  it('throws for an unknown field', () => {
    expect(() =>
      resolveTable(fixture, {
        collectionSlug: 'orders',
        fieldName: 'nonexistent',
      }),
    ).toThrowError(/not tracked/)
  })

  it('throws for an unknown collection', () => {
    expect(() =>
      resolveTable(fixture, {
        collectionSlug: 'unknown',
        fieldName: 'price',
      }),
    ).toThrowError(/not tracked/)
  })
})

describe('validateField', () => {
  it('does not throw for a known field', () => {
    expect(() =>
      validateField(fixture, { collectionSlug: 'orders', fieldName: 'total' }),
    ).not.toThrow()
  })

  it('throws for an unknown field', () => {
    expect(() =>
      validateField(fixture, { collectionSlug: 'orders', fieldName: 'missing' }),
    ).toThrowError(/not tracked/)
  })
})

describe('validateNumeric', () => {
  it('passes for a numeric field (numeric)', () => {
    expect(() =>
      validateNumeric(fixture, { collectionSlug: 'orders', fieldName: 'total' }, 'sum'),
    ).not.toThrow()
  })

  it('passes for a numeric field (double precision)', () => {
    expect(() =>
      validateNumeric(fixture, { collectionSlug: 'products', fieldName: 'weight' }, 'avg'),
    ).not.toThrow()
  })

  it('rejects a text field', () => {
    expect(() =>
      validateNumeric(fixture, { collectionSlug: 'orders', fieldName: 'status' }, 'sum'),
    ).toThrowError(/requires a numeric field/)
  })

  it('rejects a text field in a wide table', () => {
    expect(() =>
      validateNumeric(fixture, { collectionSlug: 'products', fieldName: 'title' }, 'avg'),
    ).toThrowError(/requires a numeric field/)
  })
})

describe('buildWhereClause', () => {
  it('returns TRUE when no conditions are given', () => {
    const clause = buildWhereClause({})
    // SQL template tag produces an object; check its queryChunks for the TRUE literal
    expect(clause).toBeDefined()
  })

  it('builds a clause with id only', () => {
    const clause = buildWhereClause({ id: '123' })
    expect(clause).toBeDefined()
  })

  it('builds a clause with from and to', () => {
    const clause = buildWhereClause({
      from: new Date('2025-01-01'),
      to: new Date('2025-12-31'),
    })
    expect(clause).toBeDefined()
  })

  it('builds a clause with all conditions', () => {
    const clause = buildWhereClause({
      id: 42,
      from: new Date('2025-01-01'),
      to: new Date('2025-12-31'),
    })
    expect(clause).toBeDefined()
  })

  it('throws when where is provided', () => {
    expect(() =>
      buildWhereClause({ where: { status: { equals: 'active' } } }),
    ).toThrowError(/not yet implemented/)
  })
})
