FROM ghcr.io/payloadcms/postgis-vector:17-7.0

ARG TIMESCALEDB_VERSION=2
ARG PG_MAJOR=17

LABEL org.opencontainers.image.title="postgis-vector-timescaledb" \
      org.opencontainers.image.description="PostgreSQL with PostGIS, pgvector, and TimescaleDB" \
      org.opencontainers.image.version="17-1.0" \
      org.opencontainers.image.vendor="b3nab" \
      org.opencontainers.image.authors="b3nab" \
      org.opencontainers.image.source="https://github.com/b3nab/payload-hypervalue" \
      org.opencontainers.image.licenses="MIT"

# Install TimescaleDB from official APT repo
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       gnupg lsb-release curl ca-certificates \
    && echo "deb https://packagecloud.io/timescale/timescaledb/debian/ $(lsb_release -cs) main" \
       > /etc/apt/sources.list.d/timescaledb.list \
    && curl -sL https://packagecloud.io/timescale/timescaledb/gpgkey | gpg --dearmor -o /etc/apt/trusted.gpg.d/timescaledb.gpg \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
       timescaledb-${TIMESCALEDB_VERSION}-postgresql-${PG_MAJOR} \
    && apt-get purge -y gnupg lsb-release \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

# Enable TimescaleDB in shared_preload_libraries
# Official TimescaleDB Docker pattern: uncomments and prepends to existing value
RUN sed -r -i "s/[#]*\s*(shared_preload_libraries)\s*=\s*'(.*)'/ \1 = 'timescaledb,\2'/;s/,'/'/" \
    /usr/share/postgresql/postgresql.conf.sample
