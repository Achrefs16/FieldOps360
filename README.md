# FieldOps360

> Plateforme SaaS Multi-Tenant de gestion des operations terrain

**PFE Master DevOps & Cloud** | Microservices + K3s + CI/CD

---

## Architecture

| Composant | Technologie |
|---|---|
| Auth Service | NestJS (port 3001) |
| Project Service | Express.js (port 3002) |
| Resource Service | FastAPI (port 3003) |
| Planning Service | Go / Gin (port 3004) |
| Reporting Service | Port 3005 |
| Base de donnees | PostgreSQL (database-per-tenant) |
| Cache | Redis |
| Message Broker | RabbitMQ |
| Stockage fichiers | MinIO (S3-compatible) |
| Orchestration | K3s (Kubernetes) |
| Ingress | Traefik (pre-installe avec K3s) |
| IaC | Terraform |
| CI/CD | GitHub Actions |
| Registry | Docker Hub |

---

## Structure du Projet

```
FieldOps360/
├── .github/workflows/
│   ├── ci.yml                    # CI: detect changes, build, push Docker Hub
│   └── cd.yml                    # CD: deploy to K3s via self-hosted runner
├── infra/
│   ├── k8s/
│   │   └── network-policies/     # Zero trust (4 regles reseau)
│   └── terraform/
│       ├── main.tf               # PostgreSQL, Redis, RabbitMQ, MinIO
│       ├── variables.tf          # 8 variables (5 sensibles)
│       ├── dev.tfvars            # Valeurs dev (gitignored)
│       └── dev.tfvars.example    # Template (safe to commit)
├── planification/
│   ├── DOCUMENTATION_TECHNIQUE.md  # Documentation complete
│   └── INFRASTRUCTURE_PLAN.md      # Plan phases avancees
├── services/                     # Microservices (a venir)
└── frontend/                     # Web + Mobile (a venir)
```

---

## Infrastructure Deployee (K3s)

| Service | Image | Port | Statut |
|---|---|---|---|
| PostgreSQL | Bitnami (Helm OCI) | 5432 | ✅ Running |
| Redis | Bitnami (Helm OCI) | 6379 | ✅ Running |
| RabbitMQ | `rabbitmq:3-management` | 5672 / 15672 | ✅ Running |
| MinIO | `minio/minio:latest` | 9000 / 9001 | ✅ Running |

---

## Setup Rapide

### Prerequis
- Ubuntu Server 22.04 (VM 8GB RAM)
- K3s installe (`curl -sfL https://get.k3s.io | sh -`)
- Helm CLI
- Terraform

### 1. Cloner et configurer
```bash
git clone -b develop https://github.com/Achrefs16/FieldOps360.git
cd FieldOps360
cp infra/terraform/dev.tfvars.example infra/terraform/dev.tfvars
nano infra/terraform/dev.tfvars
# → Remplir les mots de passe
```

### 2. Deployer tout (namespace + services)
```bash
cd infra/terraform
sudo chmod 644 /etc/rancher/k3s/k3s.yaml
terraform init
terraform apply -var-file=dev.tfvars
```

### 3. Verifier
```bash
sudo kubectl get pods -n fieldops-dev
```

---

## CI/CD Pipeline

```
git push → GitHub Actions CI → Build Docker → Push Docker Hub → CD → Deploy K3s
```

| Branche | Cible | Approbation |
|---|---|---|
| `develop` | fieldops-dev | Automatique |
| `main` | fieldops-prod | Manuelle |

### Fonctionnalites CI
- Detection des changements (`dorny/paths-filter`) — seuls les services modifies sont rebuilds
- Build + Push Docker Hub avec 2 tags: `{sha}` + `latest`
- Validation Terraform (`fmt`, `init`, `validate`) si infra modifiee

### Fonctionnalites CD
- Self-hosted runner sur la VM K3s
- Rolling update via `kubectl set image`
- Rollout status avec timeout

---

## Branching Strategy (GitFlow)

- `main` — Production
- `develop` — Integration
- `feature/*` — Nouvelles fonctionnalites
- `release/*` — Preparation release
- `hotfix/*` — Corrections urgentes
