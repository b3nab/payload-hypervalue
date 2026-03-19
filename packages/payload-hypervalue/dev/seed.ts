import type { Payload } from 'payload'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Idempotent dev seed — creates sample data with deep hypervalue history
 * for testing admin UI components (charts, sparklines, timelines).
 *
 * Safe to run multiple times; checks for existing data before inserting.
 */
export const seed = async (payload: Payload): Promise<void> => {
  let seeded = false

  // --- Users ---
  const existingUsers = await payload.find({ collection: 'users', limit: 1 })
  if (existingUsers.totalDocs === 0) {
    await payload.create({
      collection: 'users',
      data: { email: 'dev@payloadcms.com', password: 'test' },
    })
    seeded = true
  }

  // --- Books (deep price history for sparklines/charts) ---
  seeded = (await seedBooks(payload)) || seeded

  // --- Products (deep snapshot history for wide table testing) ---
  seeded = (await seedProducts(payload)) || seeded

  // --- Vehicles (deep location history for trajectory/spatial) ---
  seeded = (await seedVehicles(payload)) || seeded

  if (seeded) {
    console.log('[seed] Dev data seeded successfully.')
  }
}

// ---------------------------------------------------------------------------
// Books — field-level tracking with many price fluctuations
// ---------------------------------------------------------------------------

async function seedBooks(payload: Payload): Promise<boolean> {
  const existing = await payload.find({
    collection: 'books',
    where: { title: { equals: 'The Great Gatsby' } },
    limit: 1,
  })
  if (existing.totalDocs > 0) return false

  // Book 1: The Great Gatsby — 60 price changes over "90 days"
  // Simulates a book going through promotions, price increases, clearance
  const gatsby = await payload.create({
    collection: 'books',
    data: { title: 'The Great Gatsby', price: 12.99, status: 'available' },
  })
  const gatsbyPrices = generatePriceSeries(12.99, 60, { min: 6.99, max: 24.99, volatility: 0.08 })
  const gatsbyStatuses: Array<'available' | 'out_of_stock' | 'discontinued'> = [
    ...Array(20).fill('available'),
    ...Array(5).fill('out_of_stock'),
    ...Array(15).fill('available'),
    ...Array(3).fill('out_of_stock'),
    ...Array(12).fill('available'),
    ...Array(5).fill('discontinued'),
  ]
  for (let i = 0; i < gatsbyPrices.length; i++) {
    await delay(50)
    const data: Record<string, unknown> = { price: gatsbyPrices[i] }
    if (gatsbyStatuses[i] !== gatsbyStatuses[i - 1]) {
      data.status = gatsbyStatuses[i]
    }
    await payload.update({ collection: 'books', id: gatsby.id, data })
  }

  // Book 2: 1984 — 40 price changes, steady upward trend
  const book1984 = await payload.create({
    collection: 'books',
    data: { title: '1984', price: 9.99, status: 'available' },
  })
  const prices1984 = generatePriceSeries(9.99, 40, { min: 8.99, max: 18.99, volatility: 0.04, trend: 0.02 })
  for (const price of prices1984) {
    await delay(50)
    await payload.update({ collection: 'books', id: book1984.id, data: { price } })
  }

  // Book 3: Dune — 30 price changes, high volatility
  const dune = await payload.create({
    collection: 'books',
    data: { title: 'Dune', price: 15.99, status: 'available' },
  })
  const dunePrices = generatePriceSeries(15.99, 30, { min: 9.99, max: 29.99, volatility: 0.15 })
  for (const price of dunePrices) {
    await delay(50)
    await payload.update({ collection: 'books', id: dune.id, data: { price } })
  }

  // Book 4: Brave New World — 25 changes, mostly stable
  const bnw = await payload.create({
    collection: 'books',
    data: { title: 'Brave New World', price: 11.99, status: 'available' },
  })
  const bnwPrices = generatePriceSeries(11.99, 25, { min: 10.99, max: 13.99, volatility: 0.02 })
  for (const price of bnwPrices) {
    await delay(50)
    await payload.update({ collection: 'books', id: bnw.id, data: { price } })
  }

  // Book 5: Fahrenheit 451 — 50 changes, downward trend (clearance)
  const f451 = await payload.create({
    collection: 'books',
    data: { title: 'Fahrenheit 451', price: 19.99, status: 'available' },
  })
  const f451Prices = generatePriceSeries(19.99, 50, { min: 3.99, max: 19.99, volatility: 0.06, trend: -0.03 })
  for (let i = 0; i < f451Prices.length; i++) {
    await delay(50)
    const data: Record<string, unknown> = { price: f451Prices[i] }
    if (i === 35) data.status = 'out_of_stock'
    if (i === 45) data.status = 'discontinued'
    await payload.update({ collection: 'books', id: f451.id, data })
  }

  return true
}

// ---------------------------------------------------------------------------
// Products — collection-level (wide table) with rich snapshot history
// ---------------------------------------------------------------------------

async function seedProducts(payload: Payload): Promise<boolean> {
  const existing = await payload.find({
    collection: 'products',
    where: { name: { equals: 'Wireless Headphones' } },
    limit: 1,
  })
  if (existing.totalDocs > 0) return false

  // Product 1: Wireless Headphones — 40 updates (price, rating, active status)
  const headphones = await payload.create({
    collection: 'products',
    data: {
      name: 'Wireless Headphones',
      price: 79.99,
      active: true,
      metadata: { category: 'electronics', rating: 4.5 },
    },
  })
  const hpPrices = generatePriceSeries(79.99, 40, { min: 49.99, max: 99.99, volatility: 0.05 })
  const hpRatings = generatePriceSeries(4.5, 40, { min: 3.5, max: 5.0, volatility: 0.03 })
  for (let i = 0; i < hpPrices.length; i++) {
    await delay(50)
    await payload.update({
      collection: 'products',
      id: headphones.id,
      data: {
        price: hpPrices[i],
        active: i < 30 || i > 35, // briefly deactivated
        metadata: { category: 'electronics', rating: round(hpRatings[i], 1) },
      },
    })
  }

  // Product 2: Standing Desk — 30 updates
  const desk = await payload.create({
    collection: 'products',
    data: {
      name: 'Standing Desk',
      price: 499.99,
      active: true,
      metadata: { category: 'furniture', rating: 4.8 },
    },
  })
  const deskPrices = generatePriceSeries(499.99, 30, { min: 399.99, max: 599.99, volatility: 0.03 })
  for (const price of deskPrices) {
    await delay(50)
    await payload.update({
      collection: 'products',
      id: desk.id,
      data: { price: round(price, 2) },
    })
  }

  // Product 3: Mechanical Keyboard — 35 updates with category changes
  const keyboard = await payload.create({
    collection: 'products',
    data: {
      name: 'Mechanical Keyboard',
      price: 149.99,
      active: true,
      metadata: { category: 'electronics', rating: 4.7 },
    },
  })
  const kbPrices = generatePriceSeries(149.99, 35, { min: 99.99, max: 179.99, volatility: 0.06 })
  for (let i = 0; i < kbPrices.length; i++) {
    await delay(50)
    const cat = i < 15 ? 'electronics' : i < 25 ? 'gaming' : 'peripherals'
    await payload.update({
      collection: 'products',
      id: keyboard.id,
      data: {
        price: round(kbPrices[i], 2),
        metadata: { category: cat, rating: round(4.7 + (Math.random() - 0.5) * 0.4, 1) },
      },
    })
  }

  return true
}

// ---------------------------------------------------------------------------
// Vehicles — deep location history for trajectory visualization
// ---------------------------------------------------------------------------

async function seedVehicles(payload: Payload): Promise<boolean> {
  const existing = await payload.find({
    collection: 'vehicles',
    where: { name: { equals: 'Delivery Van A' } },
    limit: 1,
  })
  if (existing.totalDocs > 0) return false

  // Vehicle 1: Delivery Van A — 50 locations tracing a route through Manhattan
  const vanA = await payload.create({
    collection: 'vehicles',
    data: { name: 'Delivery Van A', location: [-73.9857, 40.7484] },
  })
  const routeA = generateRoute(
    [-73.9857, 40.7484], // Start: Empire State Building
    [-74.0060, 40.7128], // End: Wall Street
    50,
    0.002, // wander factor
  )
  for (const point of routeA) {
    await delay(50)
    await payload.update({
      collection: 'vehicles',
      id: vanA.id,
      data: { location: point },
    })
  }

  // Vehicle 2: Delivery Van B — 40 locations, Upper East Side loop
  const vanB = await payload.create({
    collection: 'vehicles',
    data: { name: 'Delivery Van B', location: [-73.9632, 40.7794] },
  })
  const routeB = generateRoute(
    [-73.9632, 40.7794], // Start: Upper East Side
    [-73.9632, 40.7794], // End: back to start (loop)
    40,
    0.003,
  )
  for (const point of routeB) {
    await delay(50)
    await payload.update({
      collection: 'vehicles',
      id: vanB.id,
      data: { location: point },
    })
  }

  // Vehicle 3: Courier Bike — 30 locations, fast erratic movement
  const bike = await payload.create({
    collection: 'vehicles',
    data: { name: 'Courier Bike', location: [-73.9712, 40.7831] },
  })
  const routeBike = generateRoute(
    [-73.9712, 40.7831], // Start: Central Park
    [-73.9855, 40.7580], // End: Times Square
    30,
    0.005, // high wander
  )
  for (const point of routeBike) {
    await delay(50)
    await payload.update({
      collection: 'vehicles',
      id: bike.id,
      data: { location: point },
    })
  }

  return true
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/**
 * Generate a realistic price series with random walk.
 * Returns an array of prices, each rounded to 2 decimals.
 */
function generatePriceSeries(
  startPrice: number,
  count: number,
  opts: { min: number; max: number; volatility: number; trend?: number },
): number[] {
  const prices: number[] = []
  let price = startPrice
  const trend = opts.trend ?? 0

  for (let i = 0; i < count; i++) {
    // Random walk with optional trend
    const change = (Math.random() - 0.5) * 2 * opts.volatility * price + trend * price
    price = Math.max(opts.min, Math.min(opts.max, price + change))
    prices.push(round(price, 2))
  }

  return prices
}

/**
 * Generate a route (array of [lng, lat] points) between two coordinates.
 * Interpolates linearly with random wander for realism.
 */
function generateRoute(
  start: [number, number],
  end: [number, number],
  count: number,
  wander: number,
): Array<[number, number]> {
  const points: Array<[number, number]> = []

  for (let i = 1; i <= count; i++) {
    const t = i / count
    const lng = start[0] + (end[0] - start[0]) * t + (Math.random() - 0.5) * wander
    const lat = start[1] + (end[1] - start[1]) * t + (Math.random() - 0.5) * wander
    points.push([round(lng, 6), round(lat, 6)])
  }

  return points
}

function round(n: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(n * factor) / factor
}
