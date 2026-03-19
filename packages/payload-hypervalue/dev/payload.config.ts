import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { payloadHypervalue } from '@b3nab/payload-hypervalue'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { testEmailAdapter } from './helpers/testEmailAdapter.js'
import { seed } from './seed.js'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

if (!process.env.ROOT_DIR) {
  process.env.ROOT_DIR = dirname
}

export default buildConfig({
  admin: {
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [
    {
      slug: 'books',
      fields: [
        {
          name: 'title',
          type: 'text',
        },
        {
          name: 'price',
          type: 'number',
          custom: { hypervalue: true },
        },
        {
          name: 'status',
          type: 'select',
          options: ['available', 'out_of_stock', 'discontinued'],
          custom: { hypervalue: true },
        },
      ],
    },
    {
      slug: 'products',
      custom: { hypervalue: true },
      fields: [
        { name: 'name', type: 'text' },
        { name: 'price', type: 'number' },
        { name: 'active', type: 'checkbox' },
        {
          name: 'metadata',
          type: 'group',
          fields: [
            { name: 'category', type: 'text' },
            { name: 'rating', type: 'number' },
          ],
        },
        { name: 'internal', type: 'text', custom: { hypervalue: false } },
      ],
    },
    {
      slug: 'vehicles',
      fields: [
        { name: 'name', type: 'text' },
        {
          name: 'location',
          type: 'point',
          custom: { hypervalue: true },
        },
      ],
    },
    {
      slug: 'media',
      fields: [],
      upload: {
        staticDir: path.resolve(dirname, 'media'),
      },
    },
  ],
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || 'postgresql://payload:payload@localhost:5433/payload',
    },
  }),
  editor: lexicalEditor(),
  email: testEmailAdapter,
  onInit: async (payload) => {
    await seed(payload)
  },
  plugins: [
    payloadHypervalue(),
  ],
  secret: process.env.PAYLOAD_SECRET || 'test-secret_key',
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
})
