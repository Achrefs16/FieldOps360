# Infrastructure Scripts

This directory contains operational scripts for Vault management and infrastructure automation.

## Scripts Overview

### 1. vault-bootstrap.sh
**Purpose**: Initialize Vault with secrets, policies, and authentication methods

**When to use**: 
- First-time Vault setup
- After Vault re-initialization
- When Vault secrets need to be reset

**What it does**:
- Enables KV-v2 secrets engine at `secret/`
- Writes PostgreSQL, Redis, MinIO, SMTP credentials to Vault
- Configures Kubernetes auth method (if available) or AppRole
- Creates policies for auth-service and backup-job service accounts
- Sets up Vault roles for secret access

**Requirements**:
- Vault must be **initialized and unsealed**
- kubectl access to K3s cluster
- Environment variables for passwords (or uses defaults)

**Usage**:
```bash
# Run with sudo to access K3s kubeconfig
sudo bash infra/scripts/vault-bootstrap.sh

# Or with custom passwords
export TF_VAR_db_password="my-secure-password"
export TF_VAR_redis_password="my-redis-pass"
bash infra/scripts/vault-bootstrap.sh
```

---

### 2. vault-unseal.sh
**Purpose**: Automatically unseal Vault using stored unseal key

**When to use**: 
- Called automatically by systemd on boot (after setup)
- Manual unsealing during troubleshooting

**What it does**:
- Waits for K3s API server to be ready
- Waits for Vault pod to be running
- Checks if Vault is already unsealed (idempotent)
- Reads unseal key from `/root/.vault-unseal-key`
- Unseals Vault via `vault operator unseal`
- Verifies unsealing succeeded
- Logs all operations to systemd journal

**Requirements**:
- Vault unseal key stored at `/root/.vault-unseal-key` (600 permissions)
- Root access (for kubectl with K3s kubeconfig)
- K3s cluster running

**Usage**:
```bash
# Automatic (via systemd, recommended)
sudo systemctl start vault-unseal

# Manual execution
sudo bash /path/to/vault-unseal.sh

# View logs
sudo journalctl -u vault-unseal -f
```

---

### 3. vault-unseal.service
**Purpose**: Systemd unit file for automatic Vault unsealing on boot

**When to use**: 
- Installed once via `setup-vault-autounseal.sh`
- Runs automatically on every VM boot after installation

**What it does**:
- Triggers after K3s service starts
- Executes `vault-unseal.sh`
- Logs output to systemd journal
- Restarts on failure (30s backoff)

**Installation location**: `/etc/systemd/system/vault-unseal.service`

**Service management**:
```bash
# Check status
sudo systemctl status vault-unseal

# Enable on boot (done by setup script)
sudo systemctl enable vault-unseal

# Disable auto-unseal
sudo systemctl disable vault-unseal

# View logs
sudo journalctl -u vault-unseal -n 50
```

---

### 4. setup-vault-autounseal.sh
**Purpose**: One-time installation of Vault auto-unseal system

**When to use**: 
- **Once** per VM to enable automatic unsealing
- When changing unseal key
- When re-enabling auto-unseal after disabling

**What it does**:
- Prompts for Vault unseal key
- Stores key securely at `/root/.vault-unseal-key` (600 permissions)
- Makes `vault-unseal.sh` executable
- Installs `vault-unseal.service` to `/etc/systemd/system/`
- Updates service file with correct script path
- Enables service to run on boot
- Optionally tests unsealing immediately

**Requirements**:
- Root access (use sudo)
- Vault unseal key (from initial Vault initialization)

**Usage**:
```bash
# Run setup
sudo bash infra/scripts/setup-vault-autounseal.sh

# You'll be prompted for:
# 1. Your Vault unseal key
# 2. Whether to test unseal now (yes/no)
```

**Output**:
- Creates `/root/.vault-unseal-key` (unseal key storage)
- Installs `/etc/systemd/system/vault-unseal.service`
- Enables service for automatic boot execution

---

## Workflow Guide

### First-Time Setup

```bash
# Step 1: Initialize Vault (if not done)
sudo KUBECONFIG=/etc/rancher/k3s/k3s.yaml kubectl exec -n fieldops-data vault-0 -- vault operator init -key-shares=1 -key-threshold=1

# Save the unseal key and root token from output!

# Step 2: Unseal Vault manually (first time)
sudo KUBECONFIG=/etc/rancher/k3s/k3s.yaml kubectl exec -n fieldops-data vault-0 -- vault operator unseal <YOUR_UNSEAL_KEY>

# Step 3: Bootstrap Vault with secrets
cd ~/FieldOps360
sudo bash infra/scripts/vault-bootstrap.sh

# Step 4: Setup auto-unseal (so you never unseal manually again)
sudo bash infra/scripts/setup-vault-autounseal.sh
```

### After VM Reboot (Automatic)

With auto-unseal enabled:
1. VM boots → K3s starts → Vault pod starts (sealed)
2. systemd triggers `vault-unseal.service`
3. `vault-unseal.sh` unseals Vault automatically
4. Auth service and other workloads start successfully

**No manual intervention needed!**

### Testing Auto-Unseal

```bash
# Seal Vault manually (for testing)
sudo KUBECONFIG=/etc/rancher/k3s/k3s.yaml kubectl exec -n fieldops-data vault-0 -- vault operator seal

# Verify it's sealed
sudo KUBECONFIG=/etc/rancher/k3s/k3s.yaml kubectl exec -n fieldops-data vault-0 -- vault status

# Trigger auto-unseal
sudo systemctl start vault-unseal

# Check logs
sudo journalctl -u vault-unseal -n 30

# Verify it's unsealed
sudo KUBECONFIG=/etc/rancher/k3s/k3s.yaml kubectl exec -n fieldops-data vault-0 -- vault status
```

---

## Security Considerations

### Auto-Unseal Security Model

**Threat Protection:**
- ✅ Protects against disk theft (if VM is off)
- ✅ Protects against snapshot attacks (if Vault sealed)
- ❌ **Does NOT protect** if attacker gains root access while VM is running

**Risk tradeoff:**
- **With auto-unseal**: Convenience (VM reboots work automatically) at cost of security (unseal key on disk)
- **Without auto-unseal**: Maximum security (key in operator's password manager) at cost of manual intervention

**Recommendation:**
- **Dev/Lab/Demo**: Auto-unseal is appropriate (this implementation)
- **Production**: Use KMS auto-unseal (AWS KMS, Azure Key Vault, GCP KMS)

### File Permissions

The unseal key file has strict permissions:
```bash
-rw------- 1 root root /root/.vault-unseal-key
```

Only root can read it. Regular users and service accounts cannot access it.

### Rotating Unseal Keys

If you need to rotate unseal keys (Shamir rekeying):

```bash
# 1. Generate new unseal keys
sudo KUBECONFIG=/etc/rancher/k3s/k3s.yaml kubectl exec -n fieldops-data vault-0 -- vault operator rekey -init -key-shares=1 -key-threshold=1

# 2. Complete rekey process (follow prompts)

# 3. Update stored key
echo "NEW_UNSEAL_KEY" | sudo tee /root/.vault-unseal-key
sudo chmod 600 /root/.vault-unseal-key

# 4. Test
sudo systemctl start vault-unseal
```

---

## Troubleshooting

### Auto-unseal not working after reboot

```bash
# Check service status
sudo systemctl status vault-unseal

# View logs
sudo journalctl -u vault-unseal -n 100

# Common issues:
# - Service not enabled: sudo systemctl enable vault-unseal
# - Unseal key missing: check /root/.vault-unseal-key exists
# - Wrong unseal key: re-run setup-vault-autounseal.sh
# - Script path wrong: check /etc/systemd/system/vault-unseal.service ExecStart=
```

### Vault still sealed

```bash
# Check if Vault pod is running
sudo KUBECONFIG=/etc/rancher/k3s/k3s.yaml kubectl get pods -n fieldops-data

# Check Vault status
sudo KUBECONFIG=/etc/rancher/k3s/k3s.yaml kubectl exec -n fieldops-data vault-0 -- vault status

# Manually trigger unseal
sudo systemctl start vault-unseal

# If still sealed, check unseal key
sudo cat /root/.vault-unseal-key
```

### Service fails with "K3s API not ready"

```bash
# K3s might be slow to start
# Edit vault-unseal.sh and increase MAX_RETRIES or RETRY_DELAY

# Or check K3s status
sudo systemctl status k3s

# Check if K3s API is accessible
sudo KUBECONFIG=/etc/rancher/k3s/k3s.yaml kubectl get nodes
```

---

## Migration to Production KMS Auto-Unseal

When moving to production, replace this with cloud KMS:

### AWS KMS Example

```hcl
# In Vault Helm values or Terraform
seal "awskms" {
  region     = "us-east-1"
  kms_key_id = "alias/vault-unseal-key"
}
```

Then:
1. Disable systemd auto-unseal: `sudo systemctl disable vault-unseal`
2. Remove unseal key file: `sudo rm /root/.vault-unseal-key`
3. Vault will auto-unseal using AWS KMS (no keys on server)

### Azure Key Vault Example

```hcl
seal "azurekeyvault" {
  tenant_id      = "<tenant-id>"
  client_id      = "<client-id>"
  client_secret  = "<client-secret>"
  vault_name     = "vault-unseal-kv"
  key_name       = "vault-unseal-key"
}
```

### GCP KMS Example

```hcl
seal "gcpckms" {
  project     = "my-project"
  region      = "us-east1"
  key_ring    = "vault-unseal"
  crypto_key  = "vault-key"
}
```

---

## References

- [Vault Seal/Unseal Concepts](https://developer.hashicorp.com/vault/docs/concepts/seal)
- [Vault Auto-Unseal](https://developer.hashicorp.com/vault/docs/concepts/seal#auto-unseal)
- [Vault AppRole Auth](https://developer.hashicorp.com/vault/docs/auth/approle)
- [Systemd Service Units](https://www.freedesktop.org/software/systemd/man/systemd.service.html)
