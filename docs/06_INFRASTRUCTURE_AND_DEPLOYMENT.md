# 06 - Infrastructure & Deployment

**Version**: 2.0  
**Project**: FieldOps360 — Plateforme de Suivi des Équipes d'Intervention Terrain  
**Last Updated**: March 2026

---

## 1. Environments & Kubernetes (K3s)

### Kubernetes Cluster
- **Distribution:** K3s (lightweight) on Ubuntu 22.04 LTS VM (8GB RAM minimum).
- **Core Components:** containerd, Traefik Ingress (with CRD IngressRoutes), CoreDNS, local-path-provisioner.

### Namespace Architecture
The cluster uses **role-based namespaces** aligned with the microservices architecture described in the DAT:

| Namespace | Tier | Workloads |
|---|---|---|
| `fieldops-gateway` | Gateway | Traefik IngressRoutes (API routing) |
| `fieldops-auth` | Application | Auth Service (NestJS, port 3001) |
| `fieldops-core` | Application | Project Service (3002), Resource Service (3003), Planning Service (3004) |
| `fieldops-reporting` | Application | Reporting Service (Rust/Actix, port 3005) |
| `fieldops-data` | Data | PostgreSQL, Redis, RabbitMQ, MinIO, HashiCorp Vault |
| `fieldops-observability` | Monitoring | Prometheus, Grafana, Loki, Promtail, Jaeger |
| `argocd` | GitOps | ArgoCD server + application controller |

### Local Access (kubeconfig)
```bash
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown $(id -u):$(id -g) ~/.kube/config
sed -i s/127.0.0.1/IP_OF_YOUR_VM/g ~/.kube/config
```

---

## 2. Infrastructure as Code (Terraform)

All stateful infrastructure is managed via Terraform modules in `infra/terraform/`.

### Providers
- `hashicorp/kubernetes` (~> 2.25)
- `hashicorp/helm` (~> 2.12)

### Terraform Module Architecture

| Module | Path | Purpose |
|---|---|---|
| `namespace` | `modules/namespace/` | Creates K8s namespaces with labels |
| `postgresql` | `modules/postgresql/` | Bitnami PostgreSQL Helm chart (standalone, WAL archiving enabled) |
| `redis` | `modules/redis/` | Bitnami Redis Helm chart (standalone) |
| `rabbitmq` | `modules/rabbitmq/` | Bitnami RabbitMQ Helm chart |
| `minio` | `modules/minio/` | Bitnami MinIO Helm chart + bucket initialization job |
| `vault` | `modules/vault/` | HashiCorp Vault Helm chart (HA for prod, standalone for dev) |
| `observability` | `modules/observability/` | kube-prometheus-stack, Loki, Promtail, Jaeger |
| `backup` | `modules/backup/` | Documentation only — actual backups via K8s CronJobs |

### Environment Configuration
- `dev.tfvars` — Dev environment (1Gi DB, 2Gi MinIO, Vault standalone)
- `staging.tfvars` — Staging environment (5Gi DB, 10Gi MinIO)
- `prod.tfvars` — Production environment (20Gi DB, 50Gi MinIO, Vault HA 3 replicas)

> **Security:** All passwords use `CHANGE_ME` placeholders. Set real values via `TF_VAR_*` environment variables at deploy time.

### Other Root Terraform Files
- `argocd.tf` — ArgoCD Helm chart + IngressRoute + Application (watches `infra/k8s/`)
- `monitoring.tf` — metrics-server (required for HPA)
- `dashboards.tf` — Grafana dashboard ConfigMap for auth-service traffic
- `sealed_secrets.tf` — Bitnami Sealed Secrets controller

---

## 3. Kubernetes Manifests (infra/k8s/)

ArgoCD watches `infra/k8s/` and auto-syncs changes to the cluster.

### Directory Layout

| Directory | Contents |
|---|---|
| `00-crds/` | Traefik CRDs (IngressRoute, Middleware, TLSStore) — applied before ArgoCD |
| `configmaps/` | Auth-service non-secret config (ports, hosts, OTEL settings) |
| `cronjobs/` | Daily PostgreSQL backup, Redis backup, monthly restore test, WAL archiving config |
| `deployments/` | Auth-service Deployment with Vault Agent Injector annotations |
| `hpa/` | HPA for auth-service (CPU 50%, min 2 → max 5) |
| `ingress/` | Traefik IngressRoutes for API gateway, Grafana, Jaeger, MinIO, RabbitMQ + TLS stores |
| `network-policies/` | Ingress policies (Traefik, Prometheus, default-deny) + Egress policies per namespace |
| `pdb/` | PodDisruptionBudgets for auth-service and project-service |
| `services/` | ClusterIP services |
| `secrets/` | Empty — secrets created manually or via Vault |

### Secrets Management — HashiCorp Vault
Application secrets (DB passwords, Redis, MinIO, SMTP) are injected at runtime via **Vault Agent Injector** annotations on pod templates. No hardcoded secrets in manifests.

- `vault-bootstrap.sh` initializes Vault with all required secrets
- K8s auth method authenticates pods via ServiceAccount tokens
- Secrets sourced via `source /vault/secrets/*` in container entrypoint

### Traefik Middlewares (API Gateway)
- **Rate Limiting:** 50 req/min burst 100
- **Security Headers:** HSTS, X-Content-Type-Options, X-Frame-Options, X-XSS-Protection
- **Compression:** Gzip enabled
- **Retry:** 3 attempts with 100ms initial interval
- **Circuit Breaker:** Trips on >50% network errors or >25% 5xx responses

---

## 4. CI/CD Pipelines (GitHub Actions)

### Continuous Integration (`ci.yml`)
- **Path Filtering:** Only modified services are built (using `dorny/paths-filter`)
- **Build & Push:** Docker images pushed to Docker Hub (`achrefs161/fieldops-*`) with SHA tags
- **Terraform Validation:** `terraform fmt -check` and `terraform validate` on infra changes

### Continuous Deployment (`cd.yml`)
- **Dev:** Self-hosted runner on K3s VM, auto-deploys via `kubectl set image`
- **Production:** Requires manual approval via GitHub Environments

### GitOps (ArgoCD)
- ArgoCD watches `infra/k8s/` on the `develop` branch
- Auto-sync with prune and self-heal enabled
- CRDs excluded from auto-sync (applied manually)

---

## 5. Backup & Disaster Recovery

| Component | Schedule | Retention | Method |
|---|---|---|---|
| PostgreSQL (daily) | 02:00 daily | 90 days | `pg_dump` → MinIO via Vault secrets |
| PostgreSQL (WAL) | Continuous | ConfigMap-based | `archive_command.sh` → MinIO |
| Redis | 02:30 daily | 30 days | `redis-cli --rdb` → MinIO |
| Restore test | 03:00 monthly | 3 runs | Restore latest daily into temp DB |

All backup CronJobs authenticate via Vault Agent Injector (`backup-job` role).

---

## 6. Network Security (Zero Trust)

### Ingress Policies
- **Default Deny:** All ingress blocked unless explicitly allowed
- **Traefik → Microservices:** Only Traefik pods (kube-system) can reach service ports
- **Services → Data:** Only `fieldops360`-labeled pods can reach DB/cache/broker ports
- **Prometheus → All:** Scrape access on port 9090 from observability namespace

### Egress Policies
- **Auth:** DNS + data tier (PG, Redis, RabbitMQ, MinIO) + observability (OTLP 4317/4318)
- **Core:** DNS + data tier (PG, RabbitMQ, MinIO)
- **Data:** DNS + Vault (8200) + Vault Injector (8080) + MinIO (9000)
- **Gateway:** DNS + auth (3001) + observability (4318)
- **Reporting:** DNS + data tier (PG, Redis, MinIO, RabbitMQ)

---

## 7. Observability Stack

| Component | Purpose | Access |
|---|---|---|
| **Prometheus** | Metrics collection & alerting | Internal (ServiceMonitors) |
| **Grafana** | Dashboards & visualization | `/grafana` via Traefik |
| **Loki** | Log aggregation | Data source in Grafana |
| **Promtail** | Log shipping (DaemonSet) | Internal |
| **Jaeger** | Distributed tracing | `/jaeger` via Traefik |
| **Traefik Metrics** | Ingress metrics via PodMonitor | Scraped by Prometheus |

### Pre-configured Dashboard
- **Auth Service Traffic:** Total requests/min, HTTP status codes, requests by method, P99 latency

---

## 8. Currently Deployed vs Planned

| Service | DAT Status | K8s Manifest | Notes |
|---|---|---|---|
| Auth Service (NestJS:3001) | ✅ Specified | ✅ Deployed | Full Vault integration, HPA, PDB |
| Project Service (Express:3002) | ✅ Specified | ❌ Not yet | PDB defined, needs deployment manifest |
| Resource Service (FastAPI:3003) | ✅ Specified | ❌ Not yet | — |
| Planning Service (Go:3004) | ✅ Specified | ❌ Not yet | — |
| Reporting Service (Rust:3005) | ✅ Specified | ❌ Not yet | — |
| PostgreSQL | ✅ Specified | ✅ Deployed | Bitnami Helm, WAL archiving |
| Redis | ✅ Specified | ✅ Deployed | Bitnami Helm |
| RabbitMQ | ✅ Specified | ✅ Deployed | Bitnami Helm |
| MinIO | ✅ Specified | ✅ Deployed | Bucket init job included |
| Vault | ✅ Specified | ✅ Deployed | HA for prod, standalone for dev |
| Observability | ✅ Specified | ✅ Deployed | Full PLG + Jaeger stack |
| ArgoCD | ✅ Specified | ✅ Deployed | GitOps auto-sync |
