import type { Payload } from 'payload'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const seed = async (payload: Payload): Promise<void> => {
  let seeded = false

  // --- Users ---
  const existingUsers = await payload.find({
    collection: 'users',
    limit: 1,
  })

  if (existingUsers.totalDocs === 0) {
    await payload.create({
      collection: 'users',
      data: {
        email: 'dev@payloadcms.com',
        password: 'test',
      },
    })
    seeded = true
  }

  // --- Books ---
  const booksSeedData = [
    {
      title: 'The Great Gatsby',
      price: 12.99,
      status: 'available' as const,
      updates: [
        { price: 14.99 },
        { status: 'out_of_stock' as const },
      ],
    },
    {
      title: '1984',
      price: 9.99,
      status: 'available' as const,
      updates: [
        { price: 11.99 },
      ],
    },
    {
      title: 'Dune',
      price: 15.99,
      status: 'available' as const,
      updates: [],
    },
  ]

  for (const book of booksSeedData) {
    const existing = await payload.find({
      collection: 'books',
      where: { title: { equals: book.title } },
      limit: 1,
    })

    if (existing.totalDocs === 0) {
      const created = await payload.create({
        collection: 'books',
        data: {
          title: book.title,
          price: book.price,
          status: book.status,
        },
      })

      for (const update of book.updates) {
        await delay(100)
        await payload.update({
          collection: 'books',
          id: created.id,
          data: update,
        })
      }

      seeded = true
    }
  }

  // --- Products ---
  const productsSeedData = [
    {
      name: 'Wireless Headphones',
      price: 79.99,
      active: true,
      metadata: { category: 'electronics', rating: 4.5 },
      updates: [
        { price: 69.99 },
      ],
    },
    {
      name: 'Standing Desk',
      price: 499.99,
      active: true,
      metadata: { category: 'furniture', rating: 4.8 },
      updates: [],
    },
  ]

  for (const product of productsSeedData) {
    const existing = await payload.find({
      collection: 'products',
      where: { name: { equals: product.name } },
      limit: 1,
    })

    if (existing.totalDocs === 0) {
      const created = await payload.create({
        collection: 'products',
        data: {
          name: product.name,
          price: product.price,
          active: product.active,
          metadata: product.metadata,
        },
      })

      for (const update of product.updates) {
        await delay(100)
        await payload.update({
          collection: 'products',
          id: created.id,
          data: update,
        })
      }

      seeded = true
    }
  }

  // --- Vehicles ---
  const vehiclesSeedData = [
    {
      name: 'Delivery Van A',
      location: [-73.9857, 40.7484] as [number, number],
      updates: [
        { location: [-73.9712, 40.7831] as [number, number] },
        { location: [-74.006, 40.7128] as [number, number] },
      ],
    },
    {
      name: 'Delivery Van B',
      location: [-73.9632, 40.7794] as [number, number],
      updates: [],
    },
  ]

  for (const vehicle of vehiclesSeedData) {
    const existing = await payload.find({
      collection: 'vehicles',
      where: { name: { equals: vehicle.name } },
      limit: 1,
    })

    if (existing.totalDocs === 0) {
      const created = await payload.create({
        collection: 'vehicles',
        data: {
          name: vehicle.name,
          location: vehicle.location,
        },
      })

      for (const update of vehicle.updates) {
        await delay(100)
        await payload.update({
          collection: 'vehicles',
          id: created.id,
          data: update,
        })
      }

      seeded = true
    }
  }

  if (seeded) {
    console.log('[seed] Dev data seeded successfully.')
  }
}
