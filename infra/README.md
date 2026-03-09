# FieldOps360 - Infrastructure

## K3s Cluster Setup

### Prerequisites
- Ubuntu Server 22.04 VM (8GB RAM minimum)
- SSH access to the VM

### 1. Install K3s
```bash
curl -sfL https://get.k3s.io | sh -
```

Verify:
```bash
sudo kubectl get nodes
```

K3s kubeconfig is at: `/etc/rancher/k3s/k3s.yaml`

### 2. Install Helm
```bash
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

### 3. Install Terraform
```bash
wget https://releases.hashicorp.com/terraform/1.7.0/terraform_1.7.0_linux_amd64.zip
unzip terraform_1.7.0_linux_amd64.zip
sudo mv terraform /usr/local/bin/
```

### 4. Apply Traefik CRDs
```bash
sudo kubectl apply -f infra/k8s/00-crds/traefik-crds.yaml
```

### 5. Set Sensitive Variables
```bash
# Option A: Copy the example and edit
cp infra/terraform/dev.tfvars.example infra/terraform/dev.tfvars
# Then edit dev.tfvars with real passwords

# Option B: Use environment variables
export TF_VAR_db_password="your_secure_password"
export TF_VAR_redis_password="your_secure_password"
export TF_VAR_rabbitmq_password="your_secure_password"
export TF_VAR_minio_access_key="fieldops_admin"
export TF_VAR_minio_secret_key="your_secure_password"
export TF_VAR_grafana_password="your_secure_password"
```

### 6. Deploy with Terraform
```bash
cd infra/terraform

# Init
terraform init

# Deploy dev environment
terraform plan -var-file=dev.tfvars
terraform apply -var-file=dev.tfvars

# Deploy staging
terraform apply -var-file=staging.tfvars

# Deploy prod
terraform apply -var-file=prod.tfvars
```

### 7. Create Required K8s Secrets

These secrets must be created manually before deploying application pods:

```bash
# JWT signing keys for auth-service
openssl genpkey -algorithm RSA -out /tmp/private.pem -pkeyopt rsa_keygen_bits:2048
openssl rsa -in /tmp/private.pem -pubout -out /tmp/public.pem

sudo kubectl create secret generic jwt-keys \
  --namespace=fieldops-auth \
  --from-file=private.pem=/tmp/private.pem \
  --from-file=public.pem=/tmp/public.pem

# Self-signed TLS certificate (for Traefik TLSStore)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /tmp/tls.key -out /tmp/tls.crt \
  -subj "/CN=fieldops.local"

sudo kubectl create secret tls default-cert \
  --namespace=fieldops-auth \
  --cert=/tmp/tls.crt --key=/tmp/tls.key

sudo kubectl create secret tls default-cert \
  --namespace=fieldops-observability \
  --cert=/tmp/tls.crt --key=/tmp/tls.key
```

### 8. Bootstrap Vault
```bash
# Wait for Vault pods to be running
sudo kubectl get pods -n fieldops-data -l app.kubernetes.io/name=vault

# Initialize Vault (first time only)
sudo kubectl exec -n fieldops-data vault-0 -- vault operator init \
  -key-shares=1 -key-threshold=1
# Save the unseal key and root token!

# Unseal Vault
sudo kubectl exec -n fieldops-data vault-0 -- vault operator unseal <UNSEAL_KEY>
sudo kubectl exec -n fieldops-data vault-0 -- vault login <ROOT_TOKEN>

# Run the bootstrap script to inject secrets
chmod +x infra/scripts/vault-bootstrap.sh
bash infra/scripts/vault-bootstrap.sh
```

### 9. Apply K8s Manifests
```bash
sudo kubectl apply -f infra/k8s/configmaps/
sudo kubectl apply -f infra/k8s/services/
sudo kubectl apply -f infra/k8s/deployments/
sudo kubectl apply -f infra/k8s/hpa/
sudo kubectl apply -f infra/k8s/pdb/
sudo kubectl apply -f infra/k8s/ingress/
```

### 10. Apply Network Policies
```bash
sudo kubectl apply -f infra/k8s/network-policies/
```

### 11. Verify
```bash
# Check all pods
sudo kubectl get pods -A

# Check services
sudo kubectl get svc -A | grep fieldops

# Check storage
sudo kubectl get pvc -A

# Check ingress routes
sudo kubectl get ingressroutes -A
```

### 12. (Optional) Set up ArgoCD GitOps
```bash
# Apply the ArgoCD application to enable auto-sync from Git
sudo kubectl apply -f infra/argocd/argocd-app.yaml

# Get ArgoCD admin password
sudo kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d
```

## Resource Estimation (8GB RAM VM)

| Component | CPU Request | Memory Request |
|---|---|---|
| K3s system | ~300m | ~500Mi |
| PostgreSQL (dev) | 50m | 64Mi |
| Redis (dev) | 25m | 32Mi |
| RabbitMQ (dev) | 50m | 64Mi |
| MinIO (dev) | 50m | 64Mi |
| **Total infra** | **~475m** | **~724Mi** |
| **Remaining for services** | **~3500m** | **~7276Mi** |

## Directory Structure

```
infra/
├── argocd/
│   └── argocd-app.yaml          # ArgoCD Application definition
├── k8s/
│   ├── 00-crds/                 # Traefik CRDs (apply first)
│   ├── configmaps/              # Service configuration
│   ├── cronjobs/                # Backup jobs (Vault-integrated)
│   ├── deployments/             # Service deployments
│   ├── hpa/                     # Horizontal Pod Autoscalers
│   ├── ingress/                 # Traefik IngressRoutes & middlewares
│   ├── network-policies/        # Traffic isolation rules
│   ├── pdb/                     # Pod Disruption Budgets
│   ├── secrets/                 # (created manually, not in Git)
│   └── services/                # ClusterIP services
├── scripts/
│   └── vault-bootstrap.sh       # Vault secrets initialization
└── terraform/
    ├── main.tf                  # Root module
    ├── namespace.tf             # Namespace creation
    ├── providers.tf             # K3s provider config
    ├── variables.tf             # Input variables
    ├── outputs.tf               # Outputs
    ├── backend.tf               # MinIO S3 backend (2-phase setup)
    ├── argocd.tf                # ArgoCD Helm + Application
    ├── sealed_secrets.tf        # Bitnami Sealed Secrets
    ├── dev.tfvars               # Dev variable values
    ├── staging.tfvars           # Staging variable values
    ├── prod.tfvars              # Prod variable values
    └── modules/
        ├── namespace/           # K8s namespace
        ├── postgresql/          # PostgreSQL (Bitnami Helm)
        ├── redis/               # Redis (Bitnami Helm)
        ├── rabbitmq/            # RabbitMQ (Bitnami Helm)
        ├── minio/               # MinIO (Bitnami Helm)
        ├── vault/               # HashiCorp Vault
        ├── observability/       # Prometheus + Grafana + Loki + Jaeger
        └── backup/              # Backup documentation
```
