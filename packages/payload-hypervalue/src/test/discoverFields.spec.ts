import type { CollectionConfig } from 'payload'
import { describe, expect, test } from 'vitest'

import { discoverHypervalueFields, inferSqlType } from '../types.js'

describe('discoverHypervalueFields — field-level (narrow tables)', () => {
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

    const { fields } = discoverHypervalueFields(collections)
    expect(fields).toHaveLength(1)
    expect(fields[0]).toMatchObject({
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

    const { fields } = discoverHypervalueFields(collections)
    expect(fields).toHaveLength(0)
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

    const { fields } = discoverHypervalueFields(collections)
    expect(fields).toHaveLength(0)
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

    const { fields } = discoverHypervalueFields(collections)
    expect(fields).toHaveLength(3)
    expect(fields.map((f) => f.tableName)).toEqual([
      'hv_books_price',
      'hv_books_status',
      'hv_products_active',
    ])
  })
})

describe('discoverHypervalueFields — collection-level (wide tables)', () => {
  test('discovers collection with custom.hypervalue', () => {
    const collections: CollectionConfig[] = [
      {
        slug: 'products',
        custom: { hypervalue: true },
        fields: [
          { name: 'name', type: 'text' },
          { name: 'price', type: 'number' },
          { name: 'active', type: 'checkbox' },
        ],
      },
    ]

    const { collections: discovered } = discoverHypervalueFields(collections)
    expect(discovered).toHaveLength(1)
    expect(discovered[0].collectionSlug).toBe('products')
    expect(discovered[0].tableName).toBe('hv_products')
    expect(discovered[0].fields).toHaveLength(3)
    expect(discovered[0].fields.map((f) => f.columnName)).toEqual(['name', 'price', 'active'])
    expect(discovered[0].fields.map((f) => f.fieldPath)).toEqual([['name'], ['price'], ['active']])
  })

  test('handles named group nesting', () => {
    const collections: CollectionConfig[] = [
      {
        slug: 'products',
        custom: { hypervalue: true },
        fields: [
          { name: 'title', type: 'text' },
          {
            name: 'metadata',
            type: 'group',
            fields: [
              { name: 'rating', type: 'number' },
              { name: 'category', type: 'text' },
            ],
          },
        ],
      },
    ]

    const { collections: discovered } = discoverHypervalueFields(collections)
    expect(discovered[0].fields).toHaveLength(3)
    expect(discovered[0].fields[1]).toMatchObject({
      fieldName: 'rating',
      columnName: 'metadata_rating',
      fieldPath: ['metadata', 'rating'],
      sqlValueType: 'numeric',
    })
    expect(discovered[0].fields[2]).toMatchObject({
      fieldName: 'category',
      columnName: 'metadata_category',
      fieldPath: ['metadata', 'category'],
    })
  })

  test('handles unnamed group (flat)', () => {
    const collections: CollectionConfig[] = [
      {
        slug: 'products',
        custom: { hypervalue: true },
        fields: [
          {
            type: 'group',
            fields: [
              { name: 'price', type: 'number' },
            ],
          } as any, // unnamed group
        ],
      },
    ]

    const { collections: discovered } = discoverHypervalueFields(collections)
    expect(discovered[0].fields).toHaveLength(1)
    expect(discovered[0].fields[0]).toMatchObject({
      columnName: 'price',
      fieldPath: ['price'],
    })
  })

  test('handles named tabs nesting', () => {
    const collections: CollectionConfig[] = [
      {
        slug: 'products',
        custom: { hypervalue: true },
        fields: [
          {
            type: 'tabs',
            tabs: [
              {
                name: 'details',
                fields: [
                  { name: 'weight', type: 'number' },
                ],
              },
              {
                label: 'Other',
                fields: [
                  { name: 'notes', type: 'text' },
                ],
              },
            ],
          } as any,
        ],
      },
    ]

    const { collections: discovered } = discoverHypervalueFields(collections)
    expect(discovered[0].fields).toHaveLength(2)
    expect(discovered[0].fields[0]).toMatchObject({
      columnName: 'details_weight',
      fieldPath: ['details', 'weight'],
    })
    expect(discovered[0].fields[1]).toMatchObject({
      columnName: 'notes',
      fieldPath: ['notes'],
    })
  })

  test('handles row and collapsible (flat recursion)', () => {
    const collections: CollectionConfig[] = [
      {
        slug: 'products',
        custom: { hypervalue: true },
        fields: [
          {
            type: 'row',
            fields: [
              { name: 'width', type: 'number' },
              { name: 'height', type: 'number' },
            ],
          } as any,
          {
            type: 'collapsible',
            label: 'Advanced',
            fields: [
              { name: 'sku', type: 'text' },
            ],
          } as any,
        ],
      },
    ]

    const { collections: discovered } = discoverHypervalueFields(collections)
    expect(discovered[0].fields).toHaveLength(3)
    expect(discovered[0].fields.map((f) => f.columnName)).toEqual(['width', 'height', 'sku'])
    expect(discovered[0].fields.map((f) => f.fieldPath)).toEqual([['width'], ['height'], ['sku']])
  })

  test('skips array and blocks fields', () => {
    const collections: CollectionConfig[] = [
      {
        slug: 'products',
        custom: { hypervalue: true },
        fields: [
          { name: 'title', type: 'text' },
          { name: 'tags', type: 'array', fields: [{ name: 'tag', type: 'text' }] },
          { name: 'content', type: 'blocks', blocks: [] },
        ],
      },
    ]

    const { collections: discovered } = discoverHypervalueFields(collections)
    expect(discovered[0].fields).toHaveLength(1)
    expect(discovered[0].fields[0].fieldName).toBe('title')
  })

  test('skips ui fields', () => {
    const collections: CollectionConfig[] = [
      {
        slug: 'products',
        custom: { hypervalue: true },
        fields: [
          { name: 'title', type: 'text' },
          { type: 'ui', name: 'divider', admin: { components: { Field: '' as any } } },
        ],
      },
    ]

    const { collections: discovered } = discoverHypervalueFields(collections)
    expect(discovered[0].fields).toHaveLength(1)
  })

  test('per-field opt-out with hypervalue: false', () => {
    const collections: CollectionConfig[] = [
      {
        slug: 'products',
        custom: { hypervalue: true },
        fields: [
          { name: 'title', type: 'text' },
          { name: 'internal_notes', type: 'text', custom: { hypervalue: false } },
        ],
      },
    ]

    const { collections: discovered } = discoverHypervalueFields(collections)
    expect(discovered[0].fields).toHaveLength(1)
    expect(discovered[0].fields[0].fieldName).toBe('title')
  })

  test('per-field override creates both wide and narrow entries', () => {
    const collections: CollectionConfig[] = [
      {
        slug: 'products',
        custom: { hypervalue: true },
        fields: [
          { name: 'title', type: 'text' },
          { name: 'price', type: 'number', custom: { hypervalue: { valueType: 'float' } } },
        ],
      },
    ]

    const { collections: discovered, fields } = discoverHypervalueFields(collections)

    // Wide table includes both fields
    expect(discovered[0].fields).toHaveLength(2)
    expect(discovered[0].fields[1].fieldName).toBe('price')

    // Narrow table also created for the explicitly-configured field
    expect(fields).toHaveLength(1)
    expect(fields[0]).toMatchObject({
      collectionSlug: 'products',
      fieldName: 'price',
      tableName: 'hv_products_price',
      sqlValueType: 'double precision',
    })
  })

  test('returns empty collections when no collection.custom.hypervalue', () => {
    const collections: CollectionConfig[] = [
      {
        slug: 'books',
        fields: [
          { name: 'price', type: 'number', custom: { hypervalue: true } },
        ],
      },
    ]

    const { collections: discovered, fields } = discoverHypervalueFields(collections)
    expect(discovered).toHaveLength(0)
    expect(fields).toHaveLength(1)
  })

  test('deeply nested: group inside named tab', () => {
    const collections: CollectionConfig[] = [
      {
        slug: 'products',
        custom: { hypervalue: true },
        fields: [
          {
            type: 'tabs',
            tabs: [
              {
                name: 'specs',
                fields: [
                  {
                    name: 'dimensions',
                    type: 'group',
                    fields: [
                      { name: 'width', type: 'number' },
                      { name: 'height', type: 'number' },
                    ],
                  },
                ],
              },
            ],
          } as any,
        ],
      },
    ]

    const { collections: discovered } = discoverHypervalueFields(collections)
    expect(discovered[0].fields).toHaveLength(2)
    expect(discovered[0].fields[0]).toMatchObject({
      columnName: 'specs_dimensions_width',
      fieldPath: ['specs', 'dimensions', 'width'],
    })
    expect(discovered[0].fields[1]).toMatchObject({
      columnName: 'specs_dimensions_height',
      fieldPath: ['specs', 'dimensions', 'height'],
    })
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
