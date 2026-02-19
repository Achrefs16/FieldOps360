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

### 4. Create Namespaces
```bash
sudo kubectl apply -f k8s/namespaces/
```

### 5. Deploy with Terraform
```bash
cd terraform

# Init
terraform init

# Deploy dev environment
terraform plan -var-file=environments/dev.tfvars
terraform apply -var-file=environments/dev.tfvars

# Deploy staging
terraform apply -var-file=environments/staging.tfvars

# Deploy prod (with monitoring)
terraform apply -var-file=environments/prod.tfvars
```

### 6. Apply Network Policies
```bash
sudo kubectl apply -f k8s/network-policies/ -n fieldops-dev
sudo kubectl apply -f k8s/network-policies/ -n fieldops-staging
sudo kubectl apply -f k8s/network-policies/ -n fieldops-prod
```

### 7. Verify
```bash
# Check all pods
sudo kubectl get pods -n fieldops-dev

# Check services
sudo kubectl get svc -n fieldops-dev

# Check storage
sudo kubectl get pvc -n fieldops-dev
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
├── k8s/
│   ├── namespaces/          # dev, staging, prod, monitoring
│   └── network-policies/    # Traffic isolation rules
└── terraform/
    ├── main.tf              # Root module
    ├── providers.tf         # K3s provider config
    ├── variables.tf         # Input variables
    ├── outputs.tf           # Outputs
    ├── environments/        # Per-env variable files
    │   ├── dev.tfvars
    │   ├── staging.tfvars
    │   └── prod.tfvars
    └── modules/
        ├── namespace/       # K8s namespace
        ├── database/        # PostgreSQL (Bitnami Helm)
        ├── redis/           # Redis (Bitnami Helm)
        ├── rabbitmq/        # RabbitMQ (Bitnami Helm)
        ├── minio/           # MinIO (Bitnami Helm)
        ├── monitoring/      # Prometheus + Grafana + Loki
        └── ingress/         # Traefik IngressRoute CRDs
```
