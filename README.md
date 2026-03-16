<picture>
  <source media="(prefers-color-scheme: dark)" srcset="banner-dark.png" />
  <source media="(prefers-color-scheme: light)" srcset="banner-light.png" />
  <img src="banner-dark.png" alt="@b3nab/payload-hypervalue" width="100%" />
</picture>

Time-series history for [Payload CMS](https://payloadcms.com) fields. Mark any scalar field with `custom: { hypervalue: true }`, and every change gets recorded in a [TimescaleDB](https://www.timescale.com/) hypertable. Query the full history, a point in time, or a range -- via REST or server-side.

## What's in the box

### `@b3nab/payload-hypervalue`

A Payload plugin. You tag fields, it handles the rest: creates hypertables, hooks into `afterChange`, records values with timestamps, and exposes a query API.

```ts
// payload.config.ts
import { payloadHypervalue } from '@b3nab/payload-hypervalue'

export default buildConfig({
  plugins: [
    payloadHypervalue({
      chunkInterval: '3 months',    // TimescaleDB chunk interval
      compressionAfter: '6 months', // optional: compress old data
      retentionAfter: '2 years',    // optional: auto-drop old data
    }),
  ],
  collections: [
    {
      slug: 'sensors',
      fields: [
        {
          name: 'temperature',
          type: 'number',
          custom: { hypervalue: true }, // that's it
        },
      ],
    },
  ],
})
```

Query via REST:

```
GET /api/hypervalue/sensors/abc123/temperature
GET /api/hypervalue/sensors/abc123/temperature?at=2025-06-01T00:00:00Z
GET /api/hypervalue/sensors/abc123/temperature?from=2025-01-01&to=2025-06-01&limit=50
```

Or server-side:

```ts
const history = await payload.hypervalue({
  collection: 'sensors',
  id: 'abc123',
  field: 'temperature',
  from: new Date('2025-01-01'),
  to: new Date('2025-06-01'),
})
```

**Supported field types:** `number`, `text`, `select`, `checkbox`, `date`, `json`, `relationship`

### `@b3nab/postgis-vector-timescaledb`

A Docker image with PostgreSQL 17 + PostGIS 3.5+ + pgvector 0.8+ + TimescaleDB 2.25+, built on the official [Payload postgis-vector image](https://github.com/payloadcms/payload/pkgs/container/postgis-vector). One image, all the extensions you need.

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
