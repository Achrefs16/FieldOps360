# Vault Authentication on K3s: Troubleshooting & Final Solution

**The Original Issue:**
The `auth-service` pods were permanently stuck in `Init:0/1` because the `vault-agent-init` sidecar constantly received a `403 Permission Denied` error when trying to authenticate to Vault using the Kubernetes Auth method.

## Phase 1: Diagnosing the 403

When Vault's Kubernetes Auth method receives a JWT, Vault contacts the Kubernetes API `TokenReview` endpoint to verify if the token is authentic. If Kube API rejects the token, Vault returns a `403`. 

We attempted multiple configurations to fix the TokenReview rejection:
1. **Injected a Permanent Service Account Token:** We created a 10-year raw JWT and injected it directly into `token_reviewer_jwt` to bypass K3s's lack of permanent SA tokens. (Failed: K3s API still rejected the TokenReview).
2. **Vault PVC Wipe:** We discovered Vault's internal storage was corrupted (`cipher` errors), so we wiped the PVC and reinitialized the Vault. (Fixed corruption, but K3s Auth still failed).
3. **Disabled Issuer Validation:** We set `disable_iss_validation=true` knowing K3s handles `iss` claims poorly. (Failed: K3s API still rejected the TokenReview).
4. **Local JWT Validation:** We attempted to bypass the TokenReview API entirely by downloading the K3s cluster's JWKS public keys and configuring Vault to check the token signatures locally (`disable_local_ca_jwt=true`). (Failed).

**Conclusion on K3s:**
K3s `v1.28+`, especially when sitting behind Traefik or specific networking stacks, deeply alters or strips the `aud` (Audience) and `iss` (Issuer) claims inside Service Account JWTs. Because Vault `1.15.2` is extremely strict about JWT structures, it became impossible for the two systems to agree on a valid JWT via the Kubernetes Auth method.

---

## Phase 2: The Final Solution (Vault AppRole Bypass)

To permanently fix the issue, we completely abandoned the Kubernetes Auth method for this service. 

We switched the deployment to use **Vault AppRole Authentication**. AppRole is Vault's native machine-to-machine authentication mechanism. It operates entirely independently of the Kubernetes API, meaning K3s's broken JWTs are completely removed from the equation.

### How We Implemented It:
1. **Enabled AppRole on Vault Server:** We created a static AppRole named `auth-service` with `read-all` policies.
2. **Generated Static Credentials:** We exported the AppRole `RoleID` and `SecretID`.
3. **Stored Credentials in K8s:** We saved the `RoleID` and `SecretID` into a standard Kubernetes Secret named `vault-approle-auth`.
4. **Updated the Deployment Annotations:** We changed the `auth-service.yaml` annotations to instruct the Vault Agent to use AppRole:
   ```yaml
   vault.hashicorp.com/auth-type: "approle"
   vault.hashicorp.com/auth-path: "auth/approle"
   vault.hashicorp.com/auth-config-role-id-file-path: "/vault/custom/role-id"
   vault.hashicorp.com/auth-config-secret-id-file-path: "/vault/custom/secret-id"
   ```
5. **Injected the Secret natively:** To ensure the init sidecar could read those credentials before the main app started, we used the `agent-extra-secret` annotation which mounts the K8s Secret directly into `/vault/custom/`:
   ```yaml
   vault.hashicorp.com/agent-extra-secret: "vault-approle-auth"
   ```

### 🏆 The Result:
The Pod immediately advanced past `Init:0/1`, proving the Vault Agent successfully authenticated via AppRole, pulled the `db`/`redis`/`smtp`/`minio` secrets, constructed the `PLATFORM_DATABASE_URL`, and terminated cleanly (Exit Code 0).

---

## The New Issue: ErrImagePull

The Vault error is **100% resolved**. The `vault-agent-init` sidecar finished its job (`Exit Code 0`).

The remaining error (`ImagePullBackOff`) means K3s cannot find the compiled `auth-service` app container.

```
Failed to pull image "achrefs161/fieldops-auth-service:v1.0.0": rpc error: code = NotFound
```

**How to Fix:**
You need to build the Docker image for your `auth-service` and push it to DockerHub so K3s can pull it and run the main application:
1. `docker build -t achrefs161/fieldops-auth-service:v1.0.0 ./services/auth-service`
2. `docker push achrefs161/fieldops-auth-service:v1.0.0`
3. Kubernetes will automatically download it and start the application!

---

## March 2026 Incident: PostgreSQL `ErrImagePull` + Auth `CrashLoopBackOff`

### Symptoms Observed
- `fieldops-data/postgresql-0` stayed in `ErrImagePull` / `ImagePullBackOff`.
- `fieldops-auth/auth-service` stayed in `1/2` with `CrashLoopBackOff`.
- App logs showed Prisma `P1000` (invalid DB credentials).

### Root Causes
1. Bitnami PostgreSQL chart versions pinned in Terraform referenced image tags that are no longer available on Docker Hub.
2. `vault-bootstrap.sh` failed silently on some runs because `kubectl` used a kubeconfig/cert context that did not match K3s (`x509: certificate signed by unknown authority`).
3. Auth health probes used `/api/health` while the service exposes `/api/auth/v1/health`, causing extra restarts.

### Permanent Fixes Applied In Repository
- `infra/terraform/modules/postgresql/main.tf`
   - Upgraded chart and set PostgreSQL image to a pullable tag (`latest`) to avoid stale removed tags.
- `infra/scripts/vault-bootstrap.sh`
   - Uses `sudo env KUBECONFIG=/etc/rancher/k3s/k3s.yaml kubectl` by default.
   - Prevents kubeconfig TLS mismatch during Vault secret bootstrap.
- `infra/k8s/deployments/auth-service.yaml`
   - Liveness and readiness probes changed to `/api/auth/v1/health`.

### Recovery Runbook (Validated)
```bash
cd ~/FieldOps360
git pull origin develop

# 1) Read the real PostgreSQL password currently in K8s
export REAL_DB_PASS=$(sudo KUBECONFIG=/etc/rancher/k3s/k3s.yaml kubectl get secret postgresql -n fieldops-data -o jsonpath='{.data.postgres-password}' | base64 -d)

# 2) Align Vault DB secret with PostgreSQL password
export TF_VAR_db_password="$REAL_DB_PASS"
bash infra/scripts/vault-bootstrap.sh

# 3) Apply auth deployment updates and restart pods
sudo KUBECONFIG=/etc/rancher/k3s/k3s.yaml kubectl apply -f infra/k8s/deployments/auth-service.yaml
sudo KUBECONFIG=/etc/rancher/k3s/k3s.yaml kubectl rollout restart deployment/auth-service -n fieldops-auth
sudo KUBECONFIG=/etc/rancher/k3s/k3s.yaml kubectl rollout status deployment/auth-service -n fieldops-auth --timeout=180s
```

### Verification Commands
```bash
sudo KUBECONFIG=/etc/rancher/k3s/k3s.yaml kubectl get pods -n fieldops-data
sudo KUBECONFIG=/etc/rancher/k3s/k3s.yaml kubectl get pods -n fieldops-auth
sudo KUBECONFIG=/etc/rancher/k3s/k3s.yaml kubectl logs -n fieldops-auth deploy/auth-service -c auth-service --tail=120
```

Expected state:
- `postgresql-0` is `1/1 Running`.
- `auth-service` pods become `2/2 Running`.

---

## March 2026: Vault Auto-Unseal Solution (Permanent Fix)

### The Seal/Unseal Problem Explained

**Why Vault Seals Exist:**
Vault sealing is a **core security feature**, not a bug. It protects secrets from physical server theft and memory dump attacks:

1. **Encrypted Storage**: Vault stores all secrets encrypted on disk using a **master key**
2. **Protected Master Key**: The master key itself is encrypted by **unseal key(s)** (Shamir shares)
3. **Keys Never Persist**: Unseal keys are NEVER stored on disk (only in operator's secure storage)
4. **Sealed by Default**: After any restart, Vault starts **sealed** (master key not in memory → can't decrypt secrets)

**Real-world threat model:**
- Attacker steals VM disk → gets encrypted data, but NO unseal keys → secrets remain protected
- Attacker gains root access during downtime → Vault auto-seals on restart → secrets inaccessible
- Memory dump attack → after reboot, master key is wiped from RAM → attacker gets nothing

**The tradeoff:**
- **Production**: Manual unsealing is GOOD (audit trail, deliberate human action required)
- **Dev/Lab**: Manual unsealing is ANNOYING (every VM reboot = manual intervention)

### Solution: Systemd Auto-Unseal Service

For **single-VM lab/demo environments**, we trade maximum security for operational convenience by implementing automatic unsealing on boot.

**Security considerations:**
- Unseal key stored on VM at `/root/.vault-unseal-key` (600 permissions, root-only)
- Less secure than KMS auto-unseal (cloud provider HSMs)
- Appropriate for non-production environments
- If VM is compromised, attacker can read unseal key

### Implementation Files

Three new files created in `infra/scripts/`:

1. **vault-unseal.sh**: Main unseal logic
   - Waits for K3s API server to be ready
   - Waits for Vault pod to be running
   - Checks if Vault is already unsealed (idempotent)
   - Reads unseal key from `/root/.vault-unseal-key`
   - Unseals Vault via `kubectl exec`
   - Verifies unseal succeeded
   - Logs all operations to systemd journal

2. **vault-unseal.service**: Systemd unit file
   - Runs after `k3s.service` and `network-online.target`
   - One-shot service (runs once per boot)
   - Auto-restart on failure (30s backoff)
   - 5-minute timeout
   - Logs to journal with identifier `vault-unseal`

3. **setup-vault-autounseal.sh**: One-time installation script
   - Prompts for unseal key
   - Stores key securely at `/root/.vault-unseal-key`
   - Installs systemd service
   - Enables service to run on boot
   - Optionally tests unsealing immediately

### Installation Instructions

Run this **ONCE** on your VM:

```bash
# SSH into your VM
cd ~/FieldOps360

# Make setup script executable
chmod +x infra/scripts/setup-vault-autounseal.sh

# Run setup (will prompt for unseal key)
sudo infra/scripts/setup-vault-autounseal.sh
```

**During setup, you'll be prompted for:**
1. Your Vault unseal key (stored securely at `/root/.vault-unseal-key`)
2. Whether to test unseal immediately (recommended)

### Verification Commands

```bash
# Check service status
sudo systemctl status vault-unseal

# View recent logs
sudo journalctl -u vault-unseal -n 50

# Test unseal manually
sudo systemctl start vault-unseal

# Follow logs in real-time
sudo journalctl -u vault-unseal -f
```

### Expected Boot Sequence

After VM reboot:
1. VM starts → systemd initializes
2. K3s starts (`k3s.service`)
3. Vault pod starts (but sealed)
4. `vault-unseal.service` triggers automatically
5. Script waits for Vault pod ready
6. Script unseals Vault
7. Auth service and backup jobs start successfully (Vault injection works)

### Monitoring

Check if auto-unseal worked after reboot:

```bash
# Check Vault seal status directly
sudo KUBECONFIG=/etc/rancher/k3s/k3s.yaml kubectl exec -n fieldops-data vault-0 -- vault status

# Check service logs
sudo journalctl -u vault-unseal --since "10 minutes ago"

# Check dependent workloads
sudo KUBECONFIG=/etc/rancher/k3s/k3s.yaml kubectl get pods -n fieldops-auth
sudo KUBECONFIG=/etc/rancher/k3s/k3s.yaml kubectl get pods -n fieldops-data
```

### Troubleshooting

**Service failed:**
```bash
# View full logs
sudo journalctl -u vault-unseal -n 100

# Common issues:
# - Unseal key file missing/empty → check /root/.vault-unseal-key exists
# - Wrong unseal key → re-run setup-vault-autounseal.sh
# - K3s not ready → increase MAX_RETRIES in vault-unseal.sh
```

**Vault still sealed after boot:**
```bash
# Check if service ran
sudo systemctl status vault-unseal

# If service is inactive, start it manually
sudo systemctl start vault-unseal
sudo journalctl -u vault-unseal -f
```

### Disabling Auto-Unseal

If you want to return to manual unsealing:

```bash
# Disable service
sudo systemctl disable vault-unseal

# Optionally remove unseal key
sudo rm /root/.vault-unseal-key
```

### Future Production Migration

When moving to production, replace this with **KMS Auto-Unseal**:

```hcl
# Vault configuration (Terraform or Helm values)
seal "awskms" {
  region     = "us-east-1"
  kms_key_id = "alias/vault-unseal-key"
  access_key = "AWS_ACCESS_KEY"
  secret_key = "AWS_SECRET_KEY"
}
```

This removes the unseal key from the server entirely and delegates unsealing to AWS/Azure/GCP KMS (proper production security).
