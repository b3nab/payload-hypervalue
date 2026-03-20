import configPromise from '@payload-config'
import { getPayload } from 'payload'

export const GET = async (request: Request) => {
  const payload = await getPayload({
    config: configPromise,
  })

  const book = await payload.find({
    collection: "books",
    limit: 1
  })

  if(!book.docs[0]) return
  const bookID = book.docs[0].id

  const counter = await payload.hypervalue.count({
    //   ^?
    collection: "books",
    field: "price"
  })
  const {docs, totalDocs} = await payload.hypervalue.history({
    //     ^?
    collection: "books",
    id: bookID
  })

  return Response.json({
    message: 'This is an example of a custom route.',
  })
}
44