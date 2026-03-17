<picture>
  <source media="(prefers-color-scheme: dark)" srcset="banner-dark.png" />
  <source media="(prefers-color-scheme: light)" srcset="banner-light.png" />
  <img src="banner-dark.png" alt="@b3nab/payload-hypervalue" width="100%" />
</picture>

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/b3nab/payload-hypervalue)
[![GitHub stars](https://img.shields.io/github/stars/b3nab/payload-hypervalue)](https://github.com/b3nab/payload-hypervalue/stargazers)
[![npm version](https://img.shields.io/npm/v/@b3nab/payload-hypervalue.svg)](https://www.npmjs.com/package/@b3nab/payload-hypervalue)
[![npm](https://img.shields.io/npm/dm/@b3nab/payload-hypervalue)](https://npm.chart.dev/@b3nab/payload-hypervalue?primary=neutral&gray=neutral&theme=dark)

Time-series history for [Payload CMS](https://payloadcms.com) fields and
collections. Mark an entire collection or individual fields with
`custom: { hypervalue: true }`, and every change gets recorded in a
[TimescaleDB](https://www.timescale.com/) hypertable. Query full snapshots, a
single field's history, a point in time, or a range — via REST or server-side.

## What's in the box

### `@b3nab/payload-hypervalue`

A Payload plugin that supports two tracking modes:

**Collection-level** — track all scalar fields as full snapshots in a single wide
hypertable:

```ts
// payload.config.ts
import { payloadHypervalue } from "@b3nab/payload-hypervalue";

export default buildConfig({
  plugins: [
    payloadHypervalue({
      chunkInterval: "3 months",
      compressionAfter: "6 months",
      retentionAfter: "2 years",
    }),
  ],
  collections: [
    {
      slug: "products",
      custom: { hypervalue: true }, // track the whole collection
      fields: [
        { name: "title", type: "text" },
        { name: "price", type: "number" },
        { name: "status", type: "select", options: ["draft", "published"] },
      ],
    },
  ],
});
```

**Field-level** — track individual fields, each in its own narrow hypertable:

```ts
{
  slug: "sensors",
  fields: [
    {
      name: "temperature",
      type: "number",
      custom: { hypervalue: true }, // track just this field
    },
  ],
}
```

Both modes can coexist on the same collection.

Query via REST:

```
# Collection-level snapshots
GET /api/hypervalue/products/abc123
GET /api/hypervalue/products/abc123?at=2025-06-01T00:00:00Z

# Field-level history
GET /api/hypervalue/sensors/abc123/temperature
GET /api/hypervalue/sensors/abc123/temperature?from=2025-01-01&to=2025-06-01&limit=50
```

Or server-side:

```ts
// Collection-level — full document snapshots
const snapshots = await payload.hypervalue({
  collection: "products",
  id: "abc123",
});
// → [{ title: "Widget", price: 44.99, status: "published", recorded_at: "..." }, ...]

// Field-level — single field history
const history = await payload.hypervalue({
  collection: "sensors",
  id: "abc123",
  field: "temperature",
  from: new Date("2025-01-01"),
  to: new Date("2025-06-01"),
});
```

**Supported field types:** `number`, `text`, `select`, `checkbox`, `date`,
`json`, `relationship`

### `@b3nab/postgis-vector-timescaledb`

A Docker image with PostgreSQL 17 + PostGIS 3.5+ + pgvector 0.8+ + TimescaleDB
2.25+, built on the official
[Payload postgis-vector image](https://github.com/payloadcms/payload/pkgs/container/postgis-vector).
One image, all the extensions you need.

```bash
docker run --rm \
  -e POSTGRES_USER=payload \
  -e POSTGRES_PASSWORD=payload \
  -e POSTGRES_DB=payload \
  -p 5432:5432 \
  ghcr.io/b3nab/postgis-vector-timescaledb:latest
```

## Requirements

- Payload `^3.79.0` with `@payloadcms/db-postgres`
- PostgreSQL with TimescaleDB (use the Docker image above, or bring your own)
- Node `^18.20.2` or `>=20.9.0`

## Docs

[payload-hypervalue.abbenanti.com](https://payload-hypervalue.abbenanti.com)

## License

MIT
