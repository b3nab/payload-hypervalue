import type { Payload } from 'payload'

export const seed = async (payload: Payload): Promise<void> => {
  // Create dev user
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
  }
}
