#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGE_NAME="postgis-vector-timescaledb"

# Build first (single platform)
docker build -t "${IMAGE_NAME}:local" "${SCRIPT_DIR}"

# Run
docker run --rm \
  --name "${IMAGE_NAME}" \
  -e POSTGRES_USER=payload \
  -e POSTGRES_PASSWORD=payload \
  -e POSTGRES_DB=payload \
  -p 5433:5432 \
  "${IMAGE_NAME}:local"
