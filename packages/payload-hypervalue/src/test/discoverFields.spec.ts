import type { CollectionConfig } from 'payload'
import { describe, expect, test } from 'vitest'

import { discoverHypervalueFields, inferSqlType } from '../types.js'

describe('discoverHypervalueFields', () => {
  test('discovers fields marked with custom.hypervalue', () => {
    const collections: CollectionConfig[] = [
      {
        slug: 'books',
        fields: [
          { name: 'title', type: 'text' },
          { name: 'price', type: 'number', custom: { hypervalue: true } },
        ],
      },
    ]

    const discovered = discoverHypervalueFields(collections)
    expect(discovered).toHaveLength(1)
    expect(discovered[0]).toMatchObject({
      collectionSlug: 'books',
      fieldName: 'price',
      fieldType: 'number',
      tableName: 'hv_books_price',
      sqlValueType: 'numeric',
    })
  })

  test('skips fields without hypervalue marker', () => {
    const collections: CollectionConfig[] = [
      {
        slug: 'books',
        fields: [
          { name: 'title', type: 'text' },
          { name: 'author', type: 'text' },
        ],
      },
    ]

    const discovered = discoverHypervalueFields(collections)
    expect(discovered).toHaveLength(0)
  })

  test('skips unsupported field types', () => {
    const collections: CollectionConfig[] = [
      {
        slug: 'books',
        fields: [
          { name: 'content', type: 'richText', custom: { hypervalue: true } },
        ],
      },
    ]

    const discovered = discoverHypervalueFields(collections)
    expect(discovered).toHaveLength(0)
  })

  test('discovers multiple fields across collections', () => {
    const collections: CollectionConfig[] = [
      {
        slug: 'books',
        fields: [
          { name: 'price', type: 'number', custom: { hypervalue: true } },
          { name: 'status', type: 'select', options: ['a', 'b'], custom: { hypervalue: true } },
        ],
      },
      {
        slug: 'products',
        fields: [
          { name: 'active', type: 'checkbox', custom: { hypervalue: true } },
        ],
      },
    ]

    const discovered = discoverHypervalueFields(collections)
    expect(discovered).toHaveLength(3)
    expect(discovered.map((f) => f.tableName)).toEqual([
      'hv_books_price',
      'hv_books_status',
      'hv_products_active',
    ])
  })
})

describe('inferSqlType', () => {
  test('number defaults to numeric', () => {
    expect(inferSqlType({ fieldType: 'number', hypervalueConfig: true })).toBe('numeric')
  })

  test('number with float valueType', () => {
    expect(inferSqlType({ fieldType: 'number', hypervalueConfig: { valueType: 'float' } })).toBe('double precision')
  })

  test('number with integer valueType', () => {
    expect(inferSqlType({ fieldType: 'number', hypervalueConfig: { valueType: 'integer' } })).toBe('bigint')
  })

  test('text maps to text', () => {
    expect(inferSqlType({ fieldType: 'text', hypervalueConfig: true })).toBe('text')
  })

  test('checkbox maps to boolean', () => {
    expect(inferSqlType({ fieldType: 'checkbox', hypervalueConfig: true })).toBe('boolean')
  })

  test('date maps to timestamptz', () => {
    expect(inferSqlType({ fieldType: 'date', hypervalueConfig: true })).toBe('timestamp with time zone')
  })

  test('json maps to jsonb', () => {
    expect(inferSqlType({ fieldType: 'json', hypervalueConfig: true })).toBe('jsonb')
  })

  test('relationship maps to uuid', () => {
    expect(inferSqlType({ fieldType: 'relationship', hypervalueConfig: true })).toBe('uuid')
  })
})
