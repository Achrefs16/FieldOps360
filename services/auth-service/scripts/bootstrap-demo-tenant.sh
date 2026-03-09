#!/bin/bash
# Fresh VM bootstrap for auth-service demo tenant.
# Creates required databases, applies Prisma schemas, seeds demo data,
# runs auth migration checks, and verifies deployment health.
#
# Usage:
#   bash scripts/bootstrap-demo-tenant.sh
#
# Optional env vars:
#   KUBECTL_BIN=kubectl
#   DATA_NAMESPACE=fieldops-data
#   AUTH_NAMESPACE=fieldops-auth
#   PLATFORM_DB=fieldops_platform
#   TENANT_DB=fieldops_tenant_demo

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
KUBECTL_BIN="${KUBECTL_BIN:-kubectl}"
DATA_NAMESPACE="${DATA_NAMESPACE:-fieldops-data}"
AUTH_NAMESPACE="${AUTH_NAMESPACE:-fieldops-auth}"
PLATFORM_DB="${PLATFORM_DB:-fieldops_platform}"
TENANT_DB="${TENANT_DB:-fieldops_tenant_demo}"
PG_USER="${PG_USER:-postgres}"

log() {
  echo "[$(date +"%H:%M:%S")] $*"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: required command not found: $1"
    exit 1
  fi
}

require_cmd "$KUBECTL_BIN"

log "Locating PostgreSQL pod in namespace $DATA_NAMESPACE ..."
PG_POD="$($KUBECTL_BIN get pods -n "$DATA_NAMESPACE" -l app.kubernetes.io/name=postgresql -o jsonpath='{.items[0].metadata.name}')"
if [ -z "$PG_POD" ]; then
  echo "ERROR: PostgreSQL pod not found in namespace $DATA_NAMESPACE"
  exit 1
fi

PG_PASSWORD="$($KUBECTL_BIN get secret -n "$DATA_NAMESPACE" postgresql -o jsonpath='{.data.postgres-password}' | base64 -d)"
if [ -z "$PG_PASSWORD" ]; then
  echo "ERROR: could not read postgres password from secret/$DATA_NAMESPACE/postgresql"
  exit 1
fi

log "Waiting for auth-service rollout in namespace $AUTH_NAMESPACE ..."
$KUBECTL_BIN rollout status deployment/auth-service -n "$AUTH_NAMESPACE" --timeout=180s >/dev/null
AUTH_POD="$($KUBECTL_BIN get pods -n "$AUTH_NAMESPACE" -l app=auth-service -o jsonpath='{.items[0].metadata.name}')"
if [ -z "$AUTH_POD" ]; then
  echo "ERROR: auth-service pod not found in namespace $AUTH_NAMESPACE"
  exit 1
fi

DB_HOST="postgresql.${DATA_NAMESPACE}.svc.cluster.local"
PLATFORM_URL="postgresql://${PG_USER}:${PG_PASSWORD}@${DB_HOST}:5432/${PLATFORM_DB}"
TENANT_URL="postgresql://${PG_USER}:${PG_PASSWORD}@${DB_HOST}:5432/${TENANT_DB}"

log "Ensuring databases ${PLATFORM_DB} and ${TENANT_DB} exist ..."
$KUBECTL_BIN exec -n "$DATA_NAMESPACE" "$PG_POD" -- env PGPASSWORD="$PG_PASSWORD" \
  psql -v ON_ERROR_STOP=1 -U "$PG_USER" -d postgres -c "CREATE DATABASE ${PLATFORM_DB};" >/dev/null 2>&1 || true
$KUBECTL_BIN exec -n "$DATA_NAMESPACE" "$PG_POD" -- env PGPASSWORD="$PG_PASSWORD" \
  psql -v ON_ERROR_STOP=1 -U "$PG_USER" -d postgres -c "CREATE DATABASE ${TENANT_DB};" >/dev/null 2>&1 || true

log "Applying Prisma schema to platform database ..."
$KUBECTL_BIN exec -n "$AUTH_NAMESPACE" "$AUTH_POD" -- sh -lc \
  "PLATFORM_DATABASE_URL='$PLATFORM_URL' ./node_modules/.bin/prisma db push --schema=prisma/platform/schema.prisma --skip-generate"

log "Applying Prisma schema to tenant database ..."
$KUBECTL_BIN exec -n "$AUTH_NAMESPACE" "$AUTH_POD" -- sh -lc \
  "TENANT_DATABASE_URL='$TENANT_URL' ./node_modules/.bin/prisma db push --schema=prisma/tenant/schema.prisma --skip-generate"

log "Seeding demo tenant + users ..."
$KUBECTL_BIN exec -n "$AUTH_NAMESPACE" "$AUTH_POD" -- sh -lc \
  "PLATFORM_DATABASE_URL='$PLATFORM_URL' TENANT_DATABASE_URL='$TENANT_URL' DB_HOST='$DB_HOST' DB_PORT='5432' DB_PASSWORD='$PG_PASSWORD' node dist/database/prisma/seed.js"

log "Applying auth migration safety script ..."
bash "$SCRIPT_DIR/migrate-auth-schema.sh" "$TENANT_DB"

log "Running verification ..."
bash "$SCRIPT_DIR/verify-auth-migration.sh" "$TENANT_DB"

cat <<'EOF'

Bootstrap complete.

Demo tenant:
- subdomain header: X-Tenant-ID: demo
- database: fieldops_tenant_demo

Demo users:
- manager@demo.com / Manager@2026
- pm@demo.com / PM@2026Pass
- worker@demo.com / TeamMbr@2026

Quick API test:
curl -k -X POST "https://<YOUR_HOST>/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: demo" \
  -d '{"email":"manager@demo.com","password":"Manager@2026"}'
EOF
