#!/bin/bash
# Apply auth-service tenant schema migration to one PostgreSQL database.
# Safe to re-run: all DDL uses IF NOT EXISTS checks.
#
# Usage:
#   bash scripts/migrate-auth-schema.sh <db_name>
# Example:
#   bash scripts/migrate-auth-schema.sh fieldops_tenant_demo

set -euo pipefail

DB_NAME="${1:-}"
if [ -z "$DB_NAME" ]; then
  echo "ERROR: database name is required"
  echo "Usage: bash scripts/migrate-auth-schema.sh <db_name>"
  exit 1
fi

KUBECTL_BIN="${KUBECTL_BIN:-kubectl}"
DATA_NAMESPACE="${DATA_NAMESPACE:-fieldops-data}"
PG_USER="${PG_USER:-postgres}"

PG_POD="$($KUBECTL_BIN get pods -n "$DATA_NAMESPACE" -l app.kubernetes.io/name=postgresql -o jsonpath='{.items[0].metadata.name}')"
if [ -z "$PG_POD" ]; then
  echo "ERROR: PostgreSQL pod not found in namespace $DATA_NAMESPACE"
  exit 1
fi

PG_PASSWORD="$($KUBECTL_BIN get secret -n "$DATA_NAMESPACE" postgresql -o jsonpath='{.data.postgres-password}' | base64 -d)"

read -r -d '' SQL <<'EOSQL' || true
ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS deleted_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS created_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
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

echo "Applying auth migration on database: $DB_NAME"
$KUBECTL_BIN exec -n "$DATA_NAMESPACE" "$PG_POD" -- env PGPASSWORD="$PG_PASSWORD" \
  psql -v ON_ERROR_STOP=1 -U "$PG_USER" -d "$DB_NAME" -c "$SQL"

echo "Migration applied successfully on $DB_NAME"
