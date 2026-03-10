#!/bin/bash
# vault-unseal.sh
# Auto-unseal Vault after VM boot
# Part of FieldOps360 systemd boot automation

set -euo pipefail

# Configuration
KUBECONFIG="/etc/rancher/k3s/k3s.yaml"
VAULT_NAMESPACE="fieldops-data"
VAULT_POD="vault-0"
UNSEAL_KEY_FILE="/root/.vault-unseal-key"
MAX_RETRIES=30
RETRY_DELAY=10

# Logging helper
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*" >&2
}

log "INFO: Vault auto-unseal service started"

# Wait for K3s API server to be ready
log "INFO: Waiting for K3s API server..."
for i in $(seq 1 $MAX_RETRIES); do
    if sudo env KUBECONFIG="$KUBECONFIG" kubectl get nodes &>/dev/null; then
        log "INFO: K3s API server is ready"
        break
    fi
    
    if [ "$i" -eq "$MAX_RETRIES" ]; then
        log "ERROR: K3s API server did not become ready after ${MAX_RETRIES} attempts"
        exit 1
    fi
    
    log "INFO: Waiting for K3s API (attempt $i/$MAX_RETRIES)..."
    sleep "$RETRY_DELAY"
done

# Wait for Vault pod to be running
log "INFO: Waiting for Vault pod to be running..."
for i in $(seq 1 $MAX_RETRIES); do
    POD_STATUS=$(sudo env KUBECONFIG="$KUBECONFIG" kubectl get pod "$VAULT_POD" -n "$VAULT_NAMESPACE" -o jsonpath='{.status.phase}' 2>/dev/null || echo "NotFound")
    
    if [ "$POD_STATUS" = "Running" ]; then
        log "INFO: Vault pod is running"
        break
    fi
    
    if [ "$i" -eq "$MAX_RETRIES" ]; then
        log "ERROR: Vault pod did not become ready after ${MAX_RETRIES} attempts"
        exit 1
    fi
    
    log "INFO: Vault pod status: $POD_STATUS (attempt $i/$MAX_RETRIES)..."
    sleep "$RETRY_DELAY"
done

# Additional wait for Vault process to initialize
log "INFO: Waiting for Vault process to initialize..."
sleep 5

# Check if Vault is already unsealed
log "INFO: Checking Vault seal status..."
SEAL_STATUS=$(sudo env KUBECONFIG="$KUBECONFIG" kubectl exec -n "$VAULT_NAMESPACE" "$VAULT_POD" -- vault status -format=json 2>/dev/null || echo '{"sealed":true}')
IS_SEALED=$(echo "$SEAL_STATUS" | grep -o '"sealed":[^,}]*' | cut -d':' -f2 | tr -d ' ')

if [ "$IS_SEALED" = "false" ]; then
    log "INFO: Vault is already unsealed, nothing to do"
    exit 0
fi

log "INFO: Vault is sealed, proceeding with unseal operation..."

# Check if unseal key file exists
if [ ! -f "$UNSEAL_KEY_FILE" ]; then
    log "ERROR: Unseal key file not found at $UNSEAL_KEY_FILE"
    log "ERROR: Please create it with: echo 'YOUR_UNSEAL_KEY' | sudo tee $UNSEAL_KEY_FILE && sudo chmod 600 $UNSEAL_KEY_FILE"
    exit 1
fi

# Read unseal key
UNSEAL_KEY=$(sudo cat "$UNSEAL_KEY_FILE")

if [ -z "$UNSEAL_KEY" ]; then
    log "ERROR: Unseal key file is empty"
    exit 1
fi

# Unseal Vault
log "INFO: Unsealing Vault..."
UNSEAL_OUTPUT=$(sudo env KUBECONFIG="$KUBECONFIG" kubectl exec -n "$VAULT_NAMESPACE" "$VAULT_POD" -- vault operator unseal "$UNSEAL_KEY" 2>&1)
UNSEAL_EXIT_CODE=$?

if [ $UNSEAL_EXIT_CODE -ne 0 ]; then
    log "ERROR: Vault unseal failed with exit code $UNSEAL_EXIT_CODE"
    log "ERROR: Output: $UNSEAL_OUTPUT"
    exit 1
fi

# Verify unseal succeeded
log "INFO: Verifying unseal status..."
sleep 2
SEAL_STATUS_AFTER=$(sudo env KUBECONFIG="$KUBECONFIG" kubectl exec -n "$VAULT_NAMESPACE" "$VAULT_POD" -- vault status -format=json 2>/dev/null || echo '{"sealed":true}')
IS_SEALED_AFTER=$(echo "$SEAL_STATUS_AFTER" | grep -o '"sealed":[^,}]*' | cut -d':' -f2 | tr -d ' ')

if [ "$IS_SEALED_AFTER" = "false" ]; then
    log "SUCCESS: Vault successfully unsealed!"
    log "INFO: Vault is now ready to serve secrets to workloads"
    exit 0
else
    log "ERROR: Vault unseal command succeeded but Vault is still sealed"
    log "ERROR: This may indicate incorrect unseal key or threshold not met"
    exit 1
fi
