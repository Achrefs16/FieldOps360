# FieldOps360

> Plateforme SaaS Multi-Tenant de gestion des opérations terrain

**PFE Master DevOps & Cloud** | Microservices + K3s + CI/CD + GitOps

---

## Architecture

| Composant | Technologie | Port |
|---|---|---|
| Auth Service | NestJS | 3001 |
| Project Service | Express.js | 3002 |
| Resource Service | FastAPI (Python) | 3003 |
| Planning Service | Go / Gin | 3004 |
| Reporting Service | Rust / Actix-Web | 3005 |

### Infrastructure & Data Layer

| Composant | Technologie |
|---|---|
| Base de données | PostgreSQL (database-per-tenant) |
| Cache & Sessions | Redis |
| Message Broker | RabbitMQ |
| Stockage fichiers | MinIO (S3-compatible) |
| Secrets | HashiCorp Vault |
| Orchestration | K3s (Kubernetes) |
| API Gateway | Traefik (IngressRoutes + Middlewares) |
| IaC | Terraform (modules) |
| CI/CD | GitHub Actions |
| GitOps | ArgoCD |
| Observabilité | Prometheus + Grafana + Loki + Jaeger |
| Registry | Docker Hub (`achrefs161/fieldops-*`) |

---

## Structure du Projet

```text
FieldOps360/
├── .github/workflows/
│   ├── ci.yml                     # CI: detect changes, build, push Docker Hub
│   └── cd.yml                     # CD: deploy to K3s via self-hosted runner
├── docs/
│   ├── DAT_clean.md               # Dossier d'Architecture Technique
│   ├── CahierDesCharges_clean.md  # Cahier des Charges Fonctionnel
│   └── 0X_*.md                    # Documentation modulaire
├── infra/
│   ├── argocd/                    # ArgoCD Application manifests
│   ├── k8s/
│   │   ├── 00-crds/               # Traefik CRDs (apply first)
│   │   ├── configmaps/            # Service configuration
│   │   ├── cronjobs/              # Backups (PG daily, Redis, WAL, restore test)
│   │   ├── deployments/           # Service deployments (Vault-integrated)
│   │   ├── hpa/                   # Horizontal Pod Autoscalers
│   │   ├── ingress/               # Traefik IngressRoutes + Middlewares
│   │   ├── network-policies/      # Zero Trust (deny-all + explicit allow)
│   │   ├── pdb/                   # Pod Disruption Budgets
│   │   └── services/              # ClusterIP services
│   ├── scripts/
│   │   └── vault-bootstrap.sh     # Vault secrets initialization
│   └── terraform/
│       ├── main.tf                # Root module (namespaces + all modules)
│       ├── modules/               # PG, Redis, RabbitMQ, MinIO, Vault, Observability
│       └── *.tfvars               # Environment configs (dev, staging, prod)
└── services/
    └── auth-service/              # NestJS Authentication Microservice
```

---

## Namespaces K8s

| Namespace | Rôle | Workloads |
|---|---|---|
| `fieldops-gateway` | API Gateway | Traefik IngressRoutes |
| `fieldops-auth` | Authentification | Auth Service (2 replicas, HPA) |
| `fieldops-core` | Services métier | Project, Resource, Planning |
| `fieldops-reporting` | Reporting | Reporting Service |
| `fieldops-data` | Data tier | PostgreSQL, Redis, RabbitMQ, MinIO, Vault |
| `fieldops-observability` | Monitoring | Prometheus, Grafana, Loki, Jaeger |
| `argocd` | GitOps | ArgoCD server |

---

## Infrastructure Déployée

| Service | Méthode | Statut |
|---|---|---|
| PostgreSQL | Bitnami Helm (Terraform) | ✅ Déployé |
| Redis | Bitnami Helm (Terraform) | ✅ Déployé |
| RabbitMQ | Bitnami Helm (Terraform) | ✅ Déployé |
| MinIO | Bitnami Helm (Terraform) | ✅ Déployé |
| Vault | HashiCorp Helm (Terraform) | ✅ Déployé |
| Observabilité | kube-prometheus-stack + Loki + Jaeger | ✅ Déployé |
| ArgoCD | Helm (Terraform) | ✅ Déployé |
| Auth Service | K8s Deployment + Vault Agent | ✅ Déployé |
| Network Policies | K8s manifests (Zero Trust) | ✅ Appliquées |
| Backup CronJobs | K8s CronJobs + Vault secrets | ✅ Configurés |

---

## Setup Rapide

### Prérequis
- Ubuntu Server 22.04 (VM 8GB RAM)
- K3s installé (`curl -sfL https://get.k3s.io | sh -`)
- Helm CLI
- Terraform

### 1. Cloner et configurer
```bash
git clone -b develop https://github.com/Achrefs16/FieldOps360.git
cd FieldOps360
cp infra/terraform/dev.tfvars.example infra/terraform/dev.tfvars
nano infra/terraform/dev.tfvars
# → Remplir tous les mots de passe (remplacer CHANGE_ME)
```

### 2. Appliquer les CRDs Traefik
```bash
sudo kubectl apply -f infra/k8s/00-crds/traefik-crds.yaml
```

### 3. Déployer l'infrastructure
```bash
cd infra/terraform
sudo chmod 644 /etc/rancher/k3s/k3s.yaml
terraform init
terraform apply -var-file=dev.tfvars
```

### 4. Créer les secrets manuels
```bash
# JWT keys pour auth-service
openssl genpkey -algorithm RSA -out /tmp/private.pem -pkeyopt rsa_keygen_bits:2048
openssl rsa -in /tmp/private.pem -pubout -out /tmp/public.pem
sudo kubectl create secret generic jwt-keys -n fieldops-auth \
  --from-file=private.pem=/tmp/private.pem --from-file=public.pem=/tmp/public.pem

# TLS certificate (self-signed)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /tmp/tls.key -out /tmp/tls.crt -subj "/CN=fieldops.local"
sudo kubectl create secret tls default-cert -n fieldops-auth \
  --cert=/tmp/tls.crt --key=/tmp/tls.key
sudo kubectl create secret tls default-cert -n fieldops-observability \
  --cert=/tmp/tls.crt --key=/tmp/tls.key
```

### 5. Bootstrap Vault + déployer les manifests
```bash
# Initialize & unseal Vault, then:
bash infra/scripts/vault-bootstrap.sh

# Apply K8s manifests
sudo kubectl apply -f infra/k8s/configmaps/
sudo kubectl apply -f infra/k8s/services/
sudo kubectl apply -f infra/k8s/deployments/
sudo kubectl apply -f infra/k8s/hpa/
sudo kubectl apply -f infra/k8s/pdb/
sudo kubectl apply -f infra/k8s/ingress/
sudo kubectl apply -f infra/k8s/network-policies/
```

### 6. Vérifier
```bash
sudo kubectl get pods -A | grep fieldops
```

---

## CI/CD Pipeline

```
git push → GitHub Actions CI → Build Docker → Push DockerHub → CD → Deploy K3s
                                                                  ↕
                                                              ArgoCD sync
```

| Branche | Cible | Approbation |
|---|---|---|
| `develop` | Auto-deploy (CI/CD + ArgoCD) | Automatique |
| `main` | Production | Manuelle (GitHub Environments) |

### CI (`ci.yml`)
- Détection des changements (`dorny/paths-filter`) — seuls les services modifiés sont rebuilds
- Build + Push Docker Hub avec tags: `{sha}` + `latest`
- Validation Terraform (`fmt`, `init`, `validate`) si infra modifiée

### CD (`cd.yml`)
- Self-hosted runner sur la VM K3s
- Rolling update via `kubectl set image`
- Rollout status avec timeout

---

## Sécurité

- **Zero Trust** — NetworkPolicies deny-all par défaut, flux explicitement autorisés
- **Vault** — Tous les secrets applicatifs injectés via Vault Agent Injector
- **JWT** — Access Token (15min) + Refresh Token (rotation), RBAC 5 rôles
- **Traefik** — Rate limiting, security headers (HSTS), circuit breaker, compression
- **TLS** — Chiffrement in-transit sur tous les flux

---

## Branching Strategy (GitFlow)

- `main` — Production
- `develop` — Intégration
- `feature/*` — Nouvelles fonctionnalités
- `release/*` — Préparation release
- `hotfix/*` — Corrections urgentes

---

## Documentation

| Document | Description |
|---|---|
| [DAT](docs/DAT_clean.md) | Dossier d'Architecture Technique (24 pages) |
| [Cahier des Charges](docs/CahierDesCharges_clean.md) | Spécifications fonctionnelles |
| [Infrastructure](docs/06_INFRASTRUCTURE_AND_DEPLOYMENT.md) | Détail infrastructure & déploiement |
| [API Reference](docs/04_API_REFERENCE.md) | Documentation des APIs REST |
| [Security](docs/05_SECURITY_GUIDELINES.md) | Guidelines sécurité |
