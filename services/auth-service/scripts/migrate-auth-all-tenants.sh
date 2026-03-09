#!/bin/bash
# Apply auth-service tenant migration on every active tenant database listed in fieldops_platform.tenants.
# Also supports manual extra DB names via EXTRA_DBS env var.
#
# Usage:
#   bash scripts/migrate-auth-all-tenants.sh
#
# Optional env vars:
#   KUBECTL_BIN=kubectl
#   DATA_NAMESPACE=fieldops-data
#   PLATFORM_DB=fieldops_platform
#   EXTRA_DBS="fieldops_tenant_demo another_db"

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
KUBECTL_BIN="${KUBECTL_BIN:-kubectl}"
DATA_NAMESPACE="${DATA_NAMESPACE:-fieldops-data}"
PLATFORM_DB="${PLATFORM_DB:-fieldops_platform}"
PG_USER="${PG_USER:-postgres}"
EXTRA_DBS="${EXTRA_DBS:-}"

PG_POD="$($KUBECTL_BIN get pods -n "$DATA_NAMESPACE" -l app.kubernetes.io/name=postgresql -o jsonpath='{.items[0].metadata.name}')"
if [ -z "$PG_POD" ]; then
  echo "ERROR: PostgreSQL pod not found in namespace $DATA_NAMESPACE"
  exit 1
fi

PG_PASSWORD="$($KUBECTL_BIN get secret -n "$DATA_NAMESPACE" postgresql -o jsonpath='{.data.postgres-password}' | base64 -d)"

echo "Collecting tenant DB names from $PLATFORM_DB.tenants ..."
TENANT_DBS="$($KUBECTL_BIN exec -n "$DATA_NAMESPACE" "$PG_POD" -- env PGPASSWORD="$PG_PASSWORD" \
  psql -t -A -U "$PG_USER" -d "$PLATFORM_DB" -c "SELECT db_name FROM tenants WHERE active = true ORDER BY db_name;")"

DB_LIST=""
if [ -n "$TENANT_DBS" ]; then
  DB_LIST="$TENANT_DBS"
fi

if [ -n "$EXTRA_DBS" ]; then
  DB_LIST="${DB_LIST}
${EXTRA_DBS}"
fi

if [ -z "$(echo "$DB_LIST" | tr -d '[:space:]')" ]; then
  echo "No tenant databases found."
  exit 0
fi

echo "Databases to migrate:"
echo "$DB_LIST" | sed '/^\s*$/d' | sed 's/^/ - /'

while IFS= read -r db; do
  db_trimmed="$(echo "$db" | xargs)"
  if [ -z "$db_trimmed" ]; then
    continue
  fi

  bash "$SCRIPT_DIR/migrate-auth-schema.sh" "$db_trimmed"
done <<< "$DB_LIST"

echo "All tenant auth migrations completed."
