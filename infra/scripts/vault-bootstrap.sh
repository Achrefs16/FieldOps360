#!/bin/bash
# FieldOps360 - Vault Secrets Bootstrap Script
# This script initializes HashiCorp Vault with the required secrets for the Auth Service.
# Run this script BEFORE ArgoCD deploys the auth-service pod.

set -e

# Configuration
VAULT_NAMESPACE="fieldops-data"
VAULT_POD="vault-0"
K3S_KUBECONFIG_PATH="${K3S_KUBECONFIG_PATH:-/etc/rancher/k3s/k3s.yaml}"

# Use sudo + explicit kubeconfig by default on K3s VMs to avoid x509 kubeconfig issues.
if [ "${USE_SUDO_KUBECTL:-true}" = "true" ]; then
  KUBECTL_CMD="sudo env KUBECONFIG=${K3S_KUBECONFIG_PATH} kubectl"
else
  KUBECTL_CMD="kubectl"
fi

echo "======================================================"
echo " Starting Vault Secrets Bootstrap "
echo "======================================================"

# Ensure kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "Error: kubectl could not be found."
    exit 1
fi

echo "[1/4] Checking Vault pod status..."
${KUBECTL_CMD} wait --for=condition=Ready pod/${VAULT_POD} -n ${VAULT_NAMESPACE} --timeout=120s

echo "Note: This script assumes Vault is initialized and unsealed."
echo "If this is the first run, ensure Vault is set up."

# Require VAULT_TOKEN to authenticate vault commands inside the pod
if [ -z "${VAULT_TOKEN:-}" ]; then
    echo "ERROR: VAULT_TOKEN is not set. Export the root token before running this script."
    echo "  export VAULT_TOKEN='hvs.XXXX'"
    exit 1
fi
echo "Using VAULT_TOKEN for authentication."

# The commands here are executed inside the vault-0 pod
echo "[2/4] Enabling KV V2 secrets engine at 'secret/' (if not already enabled)..."
${KUBECTL_CMD} exec -n ${VAULT_NAMESPACE} ${VAULT_POD} -- sh -c "VAULT_TOKEN='${VAULT_TOKEN}' vault secrets enable -path=secret kv-v2 || true"

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
${KUBECTL_CMD} exec -n ${VAULT_NAMESPACE} ${VAULT_POD} -- sh -c "VAULT_TOKEN='${VAULT_TOKEN}' vault kv put secret/postgresql password='${DB_PASS}'"
echo "PostgreSQL secret written"

# 2. Redis Secret
${KUBECTL_CMD} exec -n ${VAULT_NAMESPACE} ${VAULT_POD} -- sh -c "VAULT_TOKEN='${VAULT_TOKEN}' vault kv put secret/redis password='${REDIS_PASS}'"
echo "Redis secret written"

# 3. MinIO Secret
${KUBECTL_CMD} exec -n ${VAULT_NAMESPACE} ${VAULT_POD} -- sh -c "VAULT_TOKEN='${VAULT_TOKEN}' vault kv put secret/minio access_key='${MINIO_AK}' secret_key='${MINIO_SK}'"
echo "MinIO secret written"

# 4. SMTP Credentials
${KUBECTL_CMD} exec -n ${VAULT_NAMESPACE} ${VAULT_POD} -- sh -c "VAULT_TOKEN='${VAULT_TOKEN}' vault kv put secret/fieldops/smtp smtp_user='${SMTP_USER}' smtp_pass='${SMTP_PASS}'"
echo "SMTP secret written"

echo "[4/5] Enabling AppRole Auth method..."
${KUBECTL_CMD} exec -n ${VAULT_NAMESPACE} ${VAULT_POD} -- sh -c "VAULT_TOKEN='${VAULT_TOKEN}' vault auth enable approle || true"

echo "[5/5] Creating Vault policies and AppRole for auth-service..."

# Policy allows reading any secret
${KUBECTL_CMD} exec -n ${VAULT_NAMESPACE} ${VAULT_POD} -- sh -c "VAULT_TOKEN='${VAULT_TOKEN}' vault policy write read-all - <<EOF
path \"secret/data/*\" {
  capabilities = [\"read\"]
}
EOF"

# AppRole for auth-service
${KUBECTL_CMD} exec -n ${VAULT_NAMESPACE} ${VAULT_POD} -- sh -c "VAULT_TOKEN='${VAULT_TOKEN}' vault write auth/approle/role/auth-service token_policies=read-all token_ttl=1h token_max_ttl=4h"

# Export RoleID and SecretID
ROLE_ID=$(${KUBECTL_CMD} exec -n ${VAULT_NAMESPACE} ${VAULT_POD} -- sh -c "VAULT_TOKEN='${VAULT_TOKEN}' vault read -field=role_id auth/approle/role/auth-service/role-id")
SECRET_ID=$(${KUBECTL_CMD} exec -n ${VAULT_NAMESPACE} ${VAULT_POD} -- sh -c "VAULT_TOKEN='${VAULT_TOKEN}' vault write -f -field=secret_id auth/approle/role/auth-service/secret-id")

echo "AppRole credentials generated"
echo ""
echo "====================================================="
echo " IMPORTANT: Save these AppRole credentials!"
echo "====================================================="
echo " Role ID:   ${ROLE_ID}"
echo " Secret ID: ${SECRET_ID}"
echo "====================================================="
echo ""
echo "Storing AppRole credentials as K8s secret..."

${KUBECTL_CMD} create secret generic vault-approle-auth \
  --from-literal=role-id="${ROLE_ID}" \
  --from-literal=secret-id="${SECRET_ID}" \
  -n fieldops-auth \
  --dry-run=client -o yaml | ${KUBECTL_CMD} apply -f -

echo "K8s secret 'vault-approle-auth' created/updated in fieldops-auth namespace"


echo "======================================================"
echo " Vault Bootstrap Complete! "
echo " Secrets written. AppRole created. K8s secret updated."
echo " Restart auth-service pods to pick up new credentials."
echo "======================================================"
