# postgis-vector-timescaledb

PostgreSQL with PostGIS, pgvector, and TimescaleDB — ready for PayloadCMS and
`@b3nab/postgis-vector-timescaledb` docker image for postgres with all
extensions already installed.

## Extensions

| Extension   | Version | Description                    |
| ----------- | ------- | ------------------------------ |
| PostGIS     | 3.5+    | Spatial and geographic objects |
| pgvector    | 0.8+    | Vector similarity search       |
| TimescaleDB | 2.25+   | Time-series data at scale      |

## Base Image

Built on top of
[`ghcr.io/payloadcms/postgis-vector:17-7.0`](https://github.com/payloadcms/payload/pkgs/container/postgis-vector),
which provides PostgreSQL 17 with PostGIS and pgvector. This image adds
TimescaleDB via the official APT repository.

## Usage

### Docker Run

```bash
docker run --rm \
  --name postgis-vector-timescaledb \
  -e POSTGRES_USER=payload \
  -e POSTGRES_PASSWORD=payload \
  -e POSTGRES_DB=payload \
  -p 5432:5432 \
  ghcr.io/b3nab/postgis-vector-timescaledb:latest
```

### Docker Compose

```yaml
services:
  db:
    image: ghcr.io/b3nab/postgis-vector-timescaledb:latest
    environment:
      POSTGRES_USER: payload
      POSTGRES_PASSWORD: payload
      POSTGRES_DB: payload
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

## Local Development

Build the image locally:

```bash
./docker-build.sh
```

Build and run interactively:

```bash
./docker-run.sh
```

## Related

- [payload-hypervalue](https://github.com/b3nab/payload-hypervalue) — PayloadCMS
  plugin for hypervalue features
