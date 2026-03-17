# @b3nab/payload-hypervalue

Time-series history tracking for [Payload CMS](https://payloadcms.com) fields and collections, powered by [TimescaleDB](https://www.timescale.com/) hypertables.

## Install

```bash
pnpm add @b3nab/payload-hypervalue
```

## Usage

```ts
import { buildConfig } from "payload";
import { payloadHypervalue } from "@b3nab/payload-hypervalue";

export default buildConfig({
  plugins: [payloadHypervalue()],
  collections: [
    {
      slug: "products",
      custom: { hypervalue: true }, // collection-level: track all scalar fields
      fields: [
        { name: "title", type: "text" },
        { name: "price", type: "number" },
        { name: "status", type: "select", options: ["draft", "published"] },
      ],
    },
    {
      slug: "sensors",
      fields: [
        {
          name: "temperature",
          type: "number",
          custom: { hypervalue: true }, // field-level: track just this field
        },
      ],
    },
  ],
});
```

## Tracking Modes

**Collection-level** — Add `custom: { hypervalue: true }` to a collection. All scalar fields are tracked in a single wide hypertable (`hv_{collection}`). Every update stores a full snapshot.

**Field-level** — Add `custom: { hypervalue: true }` to individual fields. Each gets its own narrow hypertable (`hv_{collection}_{field}`).

Both modes can coexist on the same collection.

## Querying

```ts
// Collection-level — full document snapshots
const snapshots = await payload.hypervalue({
  collection: "products",
  id: productId,
});

// Field-level — single field history
const history = await payload.hypervalue({
  collection: "sensors",
  id: sensorId,
  field: "temperature",
});

// Point-in-time
const snapshot = await payload.hypervalue({
  collection: "products",
  id: productId,
  at: new Date("2025-06-01"),
});

// Range
const range = await payload.hypervalue({
  collection: "sensors",
  id: sensorId,
  field: "temperature",
  from: new Date("2025-01-01"),
  to: new Date("2025-06-01"),
});
```

REST endpoints:

```
GET /api/hypervalue/:collection/:id            # collection-level snapshots
GET /api/hypervalue/:collection/:id/:field     # field-level history
```

## Plugin Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `chunkInterval` | `string` | `'3 months'` | TimescaleDB chunk time interval |
| `compressionAfter` | `string` | — | Compress chunks older than this interval |
| `retentionAfter` | `string` | — | Auto-drop chunks older than this interval |
| `trackDrafts` | `boolean` | `false` | Record changes on draft saves |
| `disabled` | `boolean` | `false` | Disable the plugin at runtime |

## Supported Field Types

`number`, `text`, `select`, `checkbox`, `date`, `json`, `relationship`

## Requirements

- Payload `^3.79.0` with `@payloadcms/db-postgres`
- PostgreSQL with TimescaleDB 2.15+
- Node `^18.20.2` or `>=20.9.0`

## Docs

[payload-hypervalue.abbenanti.com](https://payload-hypervalue.abbenanti.com)

## License

MIT
