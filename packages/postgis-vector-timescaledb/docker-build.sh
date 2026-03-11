#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGE_NAME="postgis-vector-timescaledb"

# Create buildx builder if it doesn't exist
docker buildx create --name multiarch-builder --use 2>/dev/null || docker buildx use multiarch-builder

# Build for local architecture with --load so the image is available locally
docker buildx build \
  --load \
  -t "${IMAGE_NAME}:local" \
  "${SCRIPT_DIR}"
