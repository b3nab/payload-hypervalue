#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGE_NAME="postgis-vector-timescaledb"
CONTAINER_NAME="pvt-test-$$"
DB_USER="test"
DB_PASS="test"
DB_NAME="test"
READY_TIMEOUT=30

PASSED=0
FAILED=0

cleanup() {
  echo ""
  echo "==> Cleaning up..."
  docker stop "${CONTAINER_NAME}" >/dev/null 2>&1 || true
  docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

pass() {
  echo "  PASS: $1"
  PASSED=$((PASSED + 1))
}

fail() {
  echo "  FAIL: $1"
  FAILED=$((FAILED + 1))
}

echo "==> Building image..."
docker build -t "${IMAGE_NAME}:local" "${SCRIPT_DIR}"

echo "==> Starting container (${CONTAINER_NAME})..."
docker run --rm -d \
  --name "${CONTAINER_NAME}" \
  -e POSTGRES_USER="${DB_USER}" \
  -e POSTGRES_PASSWORD="${DB_PASS}" \
  -e POSTGRES_DB="${DB_NAME}" \
  "${IMAGE_NAME}:local" >/dev/null

echo "==> Waiting for PostgreSQL to be ready (timeout: ${READY_TIMEOUT}s)..."
SECONDS=0
until docker exec "${CONTAINER_NAME}" pg_isready -U "${DB_USER}" -d "${DB_NAME}" >/dev/null 2>&1; do
  if [ "${SECONDS}" -ge "${READY_TIMEOUT}" ]; then
    echo "ERROR: PostgreSQL did not become ready within ${READY_TIMEOUT}s"
    exit 1
  fi
  sleep 1
done
echo "  PostgreSQL ready in ${SECONDS}s"

echo ""
echo "==> Running extension tests..."

# Create all extensions
docker exec "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${DB_NAME}" -c "
  CREATE EXTENSION IF NOT EXISTS timescaledb;
  CREATE EXTENSION IF NOT EXISTS vector;
  CREATE EXTENSION IF NOT EXISTS postgis;
" >/dev/null 2>&1

# Verify each extension is present
for ext in timescaledb vector postgis; do
  result=$(docker exec "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${DB_NAME}" -tA -c \
    "SELECT extversion FROM pg_extension WHERE extname = '${ext}';")
  if [ -n "${result}" ]; then
    pass "${ext} installed (version: ${result})"
  else
    fail "${ext} not found"
  fi
done

# Verify TimescaleDB version >= 2.15.0
tsdb_version=$(docker exec "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${DB_NAME}" -tA -c \
  "SELECT extversion FROM pg_extension WHERE extname = 'timescaledb';")
if [ -n "${tsdb_version}" ]; then
  # Compare versions: split on dots and compare numerically
  IFS='.' read -r major minor patch <<< "${tsdb_version}"
  if [ "${major}" -gt 2 ] || { [ "${major}" -eq 2 ] && [ "${minor}" -ge 15 ]; }; then
    pass "TimescaleDB version ${tsdb_version} >= 2.15.0"
  else
    fail "TimescaleDB version ${tsdb_version} < 2.15.0 (need >= 2.15.0)"
  fi
fi

# Verify shared_preload_libraries includes timescaledb
spl=$(docker exec "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${DB_NAME}" -tA -c \
  "SHOW shared_preload_libraries;")
if echo "${spl}" | grep -q "timescaledb"; then
  pass "shared_preload_libraries includes timescaledb (${spl})"
else
  fail "shared_preload_libraries missing timescaledb (${spl})"
fi

echo ""
echo "==============================="
echo "  Results: ${PASSED} passed, ${FAILED} failed"
echo "==============================="

if [ "${FAILED}" -gt 0 ]; then
  exit 1
fi
