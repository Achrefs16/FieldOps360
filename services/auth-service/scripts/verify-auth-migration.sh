#!/bin/bash
# Quick verification checks for auth-service migration.
# Usage:
#   bash scripts/verify-auth-migration.sh [db_name]

set -euo pipefail

DB_NAME="${1:-fieldops_tenant_demo}"
KUBECTL_BIN="${KUBECTL_BIN:-kubectl}"
DATA_NAMESPACE="${DATA_NAMESPACE:-fieldops-data}"
AUTH_NAMESPACE="${AUTH_NAMESPACE:-fieldops-auth}"
PG_USER="${PG_USER:-postgres}"

PG_POD="$($KUBECTL_BIN get pods -n "$DATA_NAMESPACE" -l app.kubernetes.io/name=postgresql -o jsonpath='{.items[0].metadata.name}')"
PG_PASSWORD="$($KUBECTL_BIN get secret -n "$DATA_NAMESPACE" postgresql -o jsonpath='{.data.postgres-password}' | base64 -d)"

echo "Checking DB objects in $DB_NAME ..."
$KUBECTL_BIN exec -n "$DATA_NAMESPACE" "$PG_POD" -- env PGPASSWORD="$PG_PASSWORD" \
  psql -U "$PG_USER" -d "$DB_NAME" -c "\d users" | sed -n '1,80p'

$KUBECTL_BIN exec -n "$DATA_NAMESPACE" "$PG_POD" -- env PGPASSWORD="$PG_PASSWORD" \
  psql -U "$PG_USER" -d "$DB_NAME" -c "\d audit_logs" | sed -n '1,120p'

echo "Checking auth-service rollout ..."
$KUBECTL_BIN rollout status deployment/auth-service -n "$AUTH_NAMESPACE" --timeout=180s

echo "Checking endpoint availability ..."
$KUBECTL_BIN get pods -n "$AUTH_NAMESPACE" -l app=auth-service

echo "Verification complete."
