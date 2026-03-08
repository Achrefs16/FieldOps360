#!/bin/bash
# FieldOps360 - Vault Secrets Bootstrap Script
# This script initializes HashiCorp Vault with the required secrets for the Auth Service.
# Run this script BEFORE ArgoCD deploys the auth-service pod.

set -e

# Configuration
VAULT_NAMESPACE="fieldops-data"
VAULT_POD="vault-0"

echo "======================================================"
echo " Starting Vault Secrets Bootstrap "
echo "======================================================"

# Ensure kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "Error: kubectl could not be found."
    exit 1
fi

echo "[1/4] Checking Vault pod status..."
kubectl wait --for=condition=Ready pod/${VAULT_POD} -n ${VAULT_NAMESPACE} --timeout=120s

echo "Note: This script assumes Vault is initialized and unsealed."
echo "If this is the first run, ensure Vault is set up."

# The commands here are executed inside the vault-0 pod
echo "[2/4] Enabling KV V2 secrets engine at 'secret/' (if not already enabled)..."
kubectl exec -n ${VAULT_NAMESPACE} ${VAULT_POD} -- sh -c "vault secrets enable -path=secret kv-v2 || true"

echo "[3/4] Injecting required application secrets into Vault..."

# We generate strong random passwords for the services
# Alternatively, you can replace these with env variables provided by your CI/CD pipeline
DB_PASS=${TF_VAR_db_password:-"$(openssl rand -hex 16)"}
REDIS_PASS=${TF_VAR_redis_password:-"$(openssl rand -hex 16)"}
MINIO_AK=${TF_VAR_minio_access_key:-"fieldops_admin"}
MINIO_SK=${TF_VAR_minio_secret_key:-"$(openssl rand -hex 16)"}
SMTP_USER=${SMTP_USER:-"no-reply@fieldops360.com"}
SMTP_PASS=${SMTP_PASS:-"$(openssl rand -hex 16)"}

# 1. PostgreSQL Database Secret
kubectl exec -n ${VAULT_NAMESPACE} ${VAULT_POD} -- sh -c "vault kv put secret/postgresql password='${DB_PASS}'"
echo "PostgreSQL secret written"

# 2. Redis Secret
kubectl exec -n ${VAULT_NAMESPACE} ${VAULT_POD} -- sh -c "vault kv put secret/redis password='${REDIS_PASS}'"
echo "Redis secret written"

# 3. MinIO Secret
kubectl exec -n ${VAULT_NAMESPACE} ${VAULT_POD} -- sh -c "vault kv put secret/minio access_key='${MINIO_AK}' secret_key='${MINIO_SK}'"
echo "MinIO secret written"

# 4. SMTP Credentials
kubectl exec -n ${VAULT_NAMESPACE} ${VAULT_POD} -- sh -c "vault kv put secret/fieldops/smtp smtp_user='${SMTP_USER}' smtp_pass='${SMTP_PASS}'"
echo "SMTP secret written"

echo "[4/5] Enabling Kubernetes Auth method..."
kubectl exec -n ${VAULT_NAMESPACE} ${VAULT_POD} -- sh -c "vault auth enable kubernetes || true"

# Configure K8s auth
kubectl exec -n ${VAULT_NAMESPACE} ${VAULT_POD} -- sh -c "vault write auth/kubernetes/config kubernetes_host=https://kubernetes.default.svc.cluster.local"

echo "[5/5] Creating Vault policies and roles for K8s Service Accounts..."

# Policy allows reading any secret
kubectl exec -n ${VAULT_NAMESPACE} ${VAULT_POD} -- sh -c "vault policy write read-all - <<EOF
path \"secret/data/*\" {
  capabilities = [\"read\"]
}
EOF"

# Role for auth-service
kubectl exec -n ${VAULT_NAMESPACE} ${VAULT_POD} -- sh -c "vault write auth/kubernetes/role/auth-service bound_service_account_names=auth-service bound_service_account_namespaces=fieldops-auth policies=read-all ttl=1h"

# Role for backup cronjobs in fieldops-data
kubectl exec -n ${VAULT_NAMESPACE} ${VAULT_POD} -- sh -c "vault write auth/kubernetes/role/backup-job bound_service_account_names=default bound_service_account_namespaces=fieldops-data policies=read-all ttl=1h"


echo "======================================================"
echo " Vault Bootstrap Complete! "
echo " The cluster can now safely use the Vault Agent Injector."
echo "======================================================"
