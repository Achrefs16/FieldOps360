#!/bin/bash
# Fresh VM bootstrap for auth-service demo tenant.
# Creates required databases, applies Prisma schemas, seeds demo data,
# runs auth migration checks, and verifies deployment health.
#
# Usage:
#   bash scripts/bootstrap-demo-tenant.sh
#
# Optional env vars:
#   KUBECTL_CMD="kubectl"
#   KUBECTL_CMD="sudo env KUBECONFIG=/etc/rancher/k3s/k3s.yaml kubectl"
#   DATA_NAMESPACE=fieldops-data
#   AUTH_NAMESPACE=fieldops-auth
#   PLATFORM_DB=fieldops_platform
#   TENANT_DB=fieldops_tenant_demo

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
KUBECTL_CMD="${KUBECTL_CMD:-${KUBECTL_BIN:-kubectl}}"
DATA_NAMESPACE="${DATA_NAMESPACE:-fieldops-data}"
AUTH_NAMESPACE="${AUTH_NAMESPACE:-fieldops-auth}"
PLATFORM_DB="${PLATFORM_DB:-fieldops_platform}"
TENANT_DB="${TENANT_DB:-fieldops_tenant_demo}"
PG_USER="${PG_USER:-postgres}"

read -r -a KUBECTL_ARR <<< "$KUBECTL_CMD"

log() {
  echo "[$(date +"%H:%M:%S")] $*"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: required command not found: $1"
    exit 1
  fi
}

kubectl_cmd() {
  "${KUBECTL_ARR[@]}" "$@"
}

require_cmd "${KUBECTL_ARR[0]}"

log "Locating PostgreSQL pod in namespace $DATA_NAMESPACE ..."
PG_POD="$(kubectl_cmd get pods -n "$DATA_NAMESPACE" -l app.kubernetes.io/name=postgresql -o jsonpath='{.items[0].metadata.name}')"
if [ -z "$PG_POD" ]; then
  echo "ERROR: PostgreSQL pod not found in namespace $DATA_NAMESPACE"
  exit 1
fi

PG_PASSWORD="$(kubectl_cmd get secret -n "$DATA_NAMESPACE" postgresql -o jsonpath='{.data.postgres-password}' | base64 -d)"
if [ -z "$PG_PASSWORD" ]; then
  echo "ERROR: could not read postgres password from secret/$DATA_NAMESPACE/postgresql"
  exit 1
fi

log "Waiting for auth-service rollout in namespace $AUTH_NAMESPACE ..."
kubectl_cmd rollout status deployment/auth-service -n "$AUTH_NAMESPACE" --timeout=180s >/dev/null
AUTH_POD="$(kubectl_cmd get pods -n "$AUTH_NAMESPACE" -l app=auth-service -o jsonpath='{.items[0].metadata.name}')"
if [ -z "$AUTH_POD" ]; then
  echo "ERROR: auth-service pod not found in namespace $AUTH_NAMESPACE"
  exit 1
fi

DB_HOST="postgresql.${DATA_NAMESPACE}.svc.cluster.local"
PLATFORM_URL="postgresql://${PG_USER}:${PG_PASSWORD}@${DB_HOST}:5432/${PLATFORM_DB}"
TENANT_URL="postgresql://${PG_USER}:${PG_PASSWORD}@${DB_HOST}:5432/${TENANT_DB}"

log "Ensuring databases ${PLATFORM_DB} and ${TENANT_DB} exist ..."
kubectl_cmd exec -n "$DATA_NAMESPACE" "$PG_POD" -- env PGPASSWORD="$PG_PASSWORD" \
  psql -v ON_ERROR_STOP=1 -U "$PG_USER" -d postgres -c "CREATE DATABASE ${PLATFORM_DB};" >/dev/null 2>&1 || true
kubectl_cmd exec -n "$DATA_NAMESPACE" "$PG_POD" -- env PGPASSWORD="$PG_PASSWORD" \
  psql -v ON_ERROR_STOP=1 -U "$PG_USER" -d postgres -c "CREATE DATABASE ${TENANT_DB};" >/dev/null 2>&1 || true

read -r -d '' PLATFORM_SQL <<'EOSQL' || true
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subdomain TEXT NOT NULL UNIQUE,
  db_name TEXT NOT NULL UNIQUE,
  db_host TEXT NOT NULL DEFAULT 'postgresql.fieldops-data.svc.cluster.local',
  db_port INTEGER NOT NULL DEFAULT 5432,
  sector TEXT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'SUPER_ADMIN',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  max_users INTEGER NOT NULL DEFAULT 10,
  max_projects INTEGER NOT NULL DEFAULT 5,
  max_storage_gb INTEGER NOT NULL DEFAULT 5,
  price_monthly DOUBLE PRECISION NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
EOSQL

read -r -d '' TENANT_SQL <<'EOSQL' || true
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role TEXT NOT NULL,
  phone TEXT NULL,
  position TEXT NULL,
  skills TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  avatar_url TEXT NULL,
  language TEXT NOT NULL DEFAULT 'fr',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  active BOOLEAN NOT NULL DEFAULT true,
  first_login BOOLEAN NOT NULL DEFAULT true,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ NULL,
  last_login_at TIMESTAMPTZ NULL,
  refresh_token TEXT NULL,
  reset_token TEXT NULL,
  reset_token_expiry TIMESTAMPTZ NULL,
  deleted_at TIMESTAMPTZ NULL,
  deleted_by TEXT NULL,
  created_by TEXT NULL,
  updated_by TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  user_id TEXT NULL,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  resource_id TEXT NULL,
  ip_address TEXT NOT NULL,
  user_agent TEXT NULL,
  metadata JSONB NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_timestamp ON audit_logs(tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_timestamp ON audit_logs(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_users_metadata_gin ON users USING GIN (metadata);
EOSQL

log "Bootstrapping platform schema with psql ..."
kubectl_cmd exec -n "$DATA_NAMESPACE" "$PG_POD" -- env PGPASSWORD="$PG_PASSWORD" \
  psql -v ON_ERROR_STOP=1 -U "$PG_USER" -d "$PLATFORM_DB" -c "$PLATFORM_SQL"

log "Bootstrapping tenant schema with psql ..."
kubectl_cmd exec -n "$DATA_NAMESPACE" "$PG_POD" -- env PGPASSWORD="$PG_PASSWORD" \
  psql -v ON_ERROR_STOP=1 -U "$PG_USER" -d "$TENANT_DB" -c "$TENANT_SQL"

log "Seeding demo tenant + users ..."
kubectl_cmd exec -n "$AUTH_NAMESPACE" "$AUTH_POD" -- sh -lc \
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
