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
| CI/CD | GitHub Actions |
| Registry | Docker Hub |

---

## Structure du Projet

```
FieldOps/
├── .github/workflows/
│   ├── ci.yml                    # CI: build, scan, push Docker Hub
│   └── cd.yml                    # CD: deploy to K3s via self-hosted runner
├── infra/
│   ├── k8s/
│   │   ├── namespaces/           # dev, staging, prod, monitoring
│   │   └── network-policies/     # Isolation reseau
│   └── terraform/
│       ├── main.tf               # PostgreSQL, Redis, RabbitMQ, MinIO (Helm)
│       ├── variables.tf          # Variables
│       ├── dev.tfvars            # Valeurs dev (gitignored)
│       └── dev.tfvars.example    # Template (safe to commit)
├── services/                     # Microservices (a venir)
├── frontend/                     # Web + Mobile (a venir)
└── README.md
```

---

## Setup Rapide

### Prerequis
- Ubuntu Server 22.04 (VM 8GB RAM)
- K3s installe
- kubectl + Terraform sur Windows
- Docker Hub account

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
kubectl get pods -n fieldops-dev
```

---

## CI/CD Pipeline

```
git push → GitHub Actions CI → Build Docker → Push Docker Hub → CD → Deploy K3s
```

| Branch | Cible |
|---|---|
| `develop` | fieldops-dev |
| `main` | fieldops-prod (approbation manuelle) |

### Secrets GitHub requis
| Secret | Description |
|---|---|
| `DOCKERHUB_USERNAME` | Docker Hub username |
| `DOCKERHUB_TOKEN` | Docker Hub access token |

### Self-hosted Runner
Le CD utilise un runner auto-heberge sur la VM K3s pour executer `kubectl`.

---

## Branching Strategy (GitFlow)

- `main` — Production
- `develop` — Integration
- `feature/*` — Nouvelles fonctionnalites
- `release/*` — Preparation release
- `hotfix/*` — Corrections urgentes
