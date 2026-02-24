# 06 - Infrastructure & Deployment

**Version**: 1.0
**Project**: FieldOps360 — Plateforme de Suivi des Équipes d'Intervention Terrain

---

## 1. Environments & Kubernetes (K3s)

### Kubernetes Cluster
- **Distribution:** K3s (lightweight) on an Ubuntu 22.04 LTS VM (8GB RAM).
- **Core Components:** containerd, Traefik Ingress, CoreDNS, local-path-provisioner.
- **Namespaces:** `fieldops-dev`, `fieldops-staging`, `fieldops-prod`, `monitoring`.

### Local Access (kubeconfig)
To connect to the cluster from a local machine, retrieve `/etc/rancher/k3s/k3s.yaml` and update the IP:
```bash
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown $(id -u):$(id -g) ~/.kube/config
sed -i s/127.0.0.1/IP_DE_VOTRE_VM/g ~/.kube/config
```

---

## 2. Infrastructure as Code (Terraform)

All base stateful infrastructure is managed declaratively via Terraform to ensure reproducibility.
- **Location:** `infra/terraform/` — Split across individual resource files (`namespace.tf`, `postgresql.tf`, `redis.tf`, `rabbitmq.tf`, `minio.tf`, `secrets.tf`, `variables.tf`, `providers.tf`, `outputs.tf`).
- **Providers:** `hashicorp/kubernetes` (~> 2.25) and `hashicorp/helm` (~> 2.12).

### Stateful Services Deployed
To respect VM resource limits (8GB), services are deployed sequentially:
1. **PostgreSQL** (Multi-Tenant DB): Deployed via Helm (`bitnamicharts/postgresql` from OCI registry).
2. **Redis** (Cache & Sessions): Deployed via Helm (`bitnamicharts/redis` from OCI registry).
3. **RabbitMQ** (Message Broker): Deployed via Kubernetes YAML utilizing the official `rabbitmq:3-management` image.
4. **MinIO** (S3 Object Storage): Deployed via Kubernetes YAML utilizing the official `minio/minio:latest` image.

*Note: Passwords and sensitive variables are supplied via `dev.tfvars` (gitignored), which injects them safely as Kubernetes Secrets.*

---

## 3. CI/CD Pipelines (GitHub Actions)

### 3.1 Continuous Integration (`ci.yml`)
Triggers on `push` or `pull_request` to `develop`/`main`.
1. **Path Filtering:** Uses `dorny/paths-filter` to detect which specific microservices changed. Only modified services are built.
2. **Build & Push:** Logs into Docker Hub (`achrefs16`), builds the Docker image, and pushes with both a latest tag and a git-sha tag for traceability.
3. **Terraform Validation:** If the `infra/` folder changes, it runs `terraform fmt -check` and `terraform validate`.

### 3.2 Continuous Deployment (`cd.yml`)
Triggers after successful CI.
- **Dev Environment:** Runs on a Self-Hosted Runner installed directly on the K3s VM. It executes `kubectl set image` to update Deployments in the `fieldops-dev` namespace.
- **Production Environment:** Triggers only on `main` branch. Requires manual approval via GitHub Environments before updating `fieldops-prod`.

---

## 4. Advanced Infrastructure Roadmap

The following phases outline the steps for elevating the infrastructure to production-grade standards:

| Phase | Component | Implementation Detail | Status |
|---|---|---|---|
| **1** | Observability | Prometheus + Grafana + Node Exporter for cluster health dashboards. | Pending |
| **2** | API Gateway | Traefik IngressRoutes providing path-based routing (e.g., `/api/auth`). | ⚠️ Basic (no TLS, no middlewares) |
| **3** | Centralized Logs | Loki + Promtail DaemonSet to ship container logs to Grafana. | Pending |
| **4** | Secrets Management| K8s Secrets via `secretKeyRef` for DB, Redis, MinIO, SMTP, JWT keys. No plaintext in manifests. | Done |
| **5** | Probes | Liveness/Readiness probes on auth-service Deployment (HTTP /api/auth/v1/health). | Done (auth-service) |
| **6** | Autoscaling | Metrics Server + HPA to auto-scale microservices (1 → 3 pods based on CPU). | Pending |
| **7** | Network & Backup | Network Policies (Zero Trust) and daily PostgreSQL backup CronJob to MinIO. | ⚠️ Ingress only (no egress rules) |

### Network Policies (Zero Trust)
Defined in `infra/k8s/network-policies/default-policies.yaml`:
- **Ingress:** ✅ Deny-all by default. Only Traefik can reach Microservices. Services-to-data and Prometheus scrape rules defined.
- **Egress:** ❌ Not yet implemented. Planned: Microservices should only reach specific data layer ports (PG:5432, Redis:6379, RMQ:5672, MinIO:9000).
