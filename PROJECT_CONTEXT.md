# FieldOps360 — Complete Project Context & Knowledge Transfer

> **Purpose**: This document contains EVERYTHING an AI assistant needs to know about the FieldOps360 project. Paste or reference this file at the start of any new conversation.
>
> **⚠️ CRITICAL**: The user works on **Windows** but the K3s cluster runs on an **Ubuntu VM**. NEVER run `kubectl`, `curl`, or any cluster command locally on Windows — they must be run on the VM via SSH.

---

## 1. Project Overview

**FieldOps360** is a multi-tenant SaaS platform for managing field operations (construction, maintenance). It's a **PFE (Projet de Fin d'Études)** — a Master's capstone project focusing on **DevOps & Cloud** practices.

- **Owner**: Achref (GitHub: `Achrefs16`)
- **Repo**: `https://github.com/Achrefs16/FieldOps360.git`
- **Branch**: `develop` (primary working branch)
- **Local path (Windows)**: `c:\Users\achra\Desktop\PFE\FieldOps`

---

## 2. Development Workflow — Windows vs VM

### ⚠️ TWO MACHINES — NEVER MIX THEM UP

| Task | Where | How |
|---|---|---|
| Edit code, push to Git | **Windows** (local IDE) | VS Code, git push |
| Run `kubectl`, check pods, curl endpoints | **Ubuntu VM** (192.168.50.10) | SSH into VM |
| Build Docker images | **GitHub Actions** (CI) | Automatic on push |
| Deploy to K3s | **GitHub Actions** (CD) or **ArgoCD** | Automatic |

### How to access the VM
```bash
ssh achref@192.168.50.10
# Password: (user knows it)
# Repo clone on VM: ~/FieldOps360
```

### Workflow
1. Edit code on **Windows** in VS Code
2. `git add`, `git commit`, `git push origin develop` from **Windows**
3. CI builds Docker image on GitHub Actions (ubuntu runner)
4. CD deploys to K3s cluster (self-hosted runner on VM)
5. ArgoCD syncs K8s manifests from Git automatically
6. Test by running `curl` or `kubectl` commands **on the VM** (NOT Windows)

### Common mistake
If the AI runs a command like `kubectl get pods` on Windows, it will fail because kubectl is not configured on Windows — the cluster is on the VM. Always tell the user to run cluster commands **on the VM**.

---

## 3. Architecture

### Microservices (NestJS backend)
| Service | Port | Status | Description |
|---|---|---|---|
| auth-service | 3001 | ✅ Deployed & working | Authentication, JWT RS256, user management, Swagger docs |
| project-service | 3002 | ❌ Not implemented yet | Projects, tasks, phases — placeholder K8s Service exists |
| resource-service | 3003 | ❌ Not implemented yet | Vehicles, equipment, materials — placeholder exists |
| planning-service | 3004 | ❌ Not implemented yet | Scheduling, auto-assignment — placeholder exists |
| reporting-service | 3005 | ❌ Not implemented yet | KPIs, PDF/Excel reports — placeholder exists |

### Frontend
| App | Port | Status | Description |
|---|---|---|---|
| admin-portal | 3000 | ⚠️ Deployed but incomplete | Next.js 16 admin dashboard at `/admin`. Landing page works. Admin pages (tenant management, user management, dashboard) need to be built out. |
web-app | 3000 | ❌ Not implemented yet | React web application for managers and project managers |
| mobile-app | N/A | ❌ Not implemented yet | React Native mobile app for field workers
### Infrastructure Stack
| Component | Namespace | Status | Notes |
|---|---|---|---|
| K3s | — | ✅ Running | Single-node VM (192.168.50.10) |
| Traefik v3.6.7 | kube-system | ✅ Running | Uses `traefik.io/v1alpha1`, hostNetwork enabled |
| ArgoCD | argocd | ✅ Running | GitOps, watches `infra/k8s/` |
| PostgreSQL | fieldops-dev | ✅ Running | Bitnami Helm chart |
| Redis | fieldops-dev | ✅ Running | Bitnami Helm chart |
| RabbitMQ | fieldops-dev | ✅ Running | Bitnami Helm chart |
| MinIO | fieldops-dev | ✅ Running | Object storage |
| Prometheus + Grafana | monitoring | ✅ Running | kube-prometheus-stack |
| Jaeger | — | ❌ NOT deployed yet | Distributed tracing — needs to be added |
| OpenTelemetry | — | ❌ NOT integrated yet | Needs to be added to all services |

---

## 4. What's NOT Finished (Incomplete Items)

> **IMPORTANT for the new AI**: Many things are deployed but NOT complete. Do NOT assume everything works end-to-end.

### Services NOT implemented
- `project-service` — only a placeholder K8s Service exists (no code, no Docker image)
- `resource-service` — same, placeholder only
- `planning-service` — same
- `reporting-service` — same
- `admin-service` — DELETED (not essential for PFE core demo)
- `admin-portal` — DELETED (not essential for PFE core demo)

### Infrastructure NOT done
- **Jaeger** — distributed tracing NOT deployed. Need to:
  1. Deploy Jaeger to K8s (Helm chart or manifest)
  2. Integrate OpenTelemetry SDK into each NestJS service
  3. Add Jaeger IngressRoute for web UI
- **TLS/HTTPS** — not configured, everything is HTTP
- **Network Policies** — no network segmentation
- **Horizontal Pod Autoscaler** — not configured
- **Backup strategy** — PostgreSQL backups not set up

### Testing NOT complete
- **Auth-service** has some Jest unit tests but coverage is low
- **SonarCloud** is configured (`sonar-project.properties`) but analysis runs only for auth-service
- **No integration tests** exist
- **No E2E tests** exist
- CI runs Jest with coverage: `npx jest --coverage --coverageReporters=lcov || true` (the `|| true` means it never fails the build)

---

## 5. CI/CD Pipeline Details

### CI (`.github/workflows/ci.yml`)
Runs on `ubuntu-latest` for every push to `develop` or `main`:

1. **detect-changes**: Uses `dorny/paths-filter` to detect which services changed
2. **lint-test**: Runs TypeScript type-check (only auth-service currently)
3. **build-push**: Builds Docker images for changed services, pushes to Docker Hub with tags `<sha>` and `latest`
4. **terraform-validate**: Validates Terraform config if `infra/` changed
5. **sonar-analysis**: SonarCloud scan (only auth-service)
6. **trivy-scan**: Docker image vulnerability scan (only auth-service image)

### CD (`.github/workflows/cd.yml`)
Runs on `self-hosted` (the VM) after CI succeeds:

1. Loops through all services
2. Checks Docker Hub API (`curl`) if image with SHA tag exists
3. Only deploys services that were actually rebuilt
4. Uses `kubectl set image` + `kubectl rollout status`

### ArgoCD (`infra/argocd/argocd-app.yaml`)
- Watches `infra/k8s/` directory in `develop` branch with `recurse: true`
- `syncPolicy: automated` with `prune: true` and `selfHeal: true`
- Excludes `00-crds/*` directory
- ArgoCD manages K8s manifests only (NOT Docker images)
- When you change a deployment YAML in Git, ArgoCD applies it automatically
- When CI pushes a new Docker image, the CD pipeline restarts the pod (NOT ArgoCD)

### Docker Hub
- User: `achrefs161`
- Images: `achrefs161/fieldops-<service-name>:latest` and `achrefs161/fieldops-<service-name>:<sha>`

---

## 6. Key File Structure

```
FieldOps/
├── .github/workflows/
│   ├── ci.yml                    # CI pipeline
│   └── cd.yml                    # CD pipeline
├── infra/
│   ├── argocd/
│   │   └── argocd-app.yaml       # ArgoCD Application definition
│   ├── k8s/
│   │   ├── └── auth-service.yaml
│   │   ├── services/
│   │   │   ├── auth-servicee.yaml
│   │   │   ├── admin-portal.yaml
│   │   │   └── placeholder-services.yaml  # Stubs for undeployed services
│   │   ├── ingress/
│   │   │   ├── ingressroutes.yaml         # Main Traefik routing (ALL routes)
│   │   │   ├── argocd-ingress.yaml        # ArgoCD at /argocd
│   │   │   └── grafana-ingress.yaml       # Grafana at /grafana
│   │   ├── configmaps/
│   │   │   └── auth-service.yaml
│   │   └── secrets/
│   └── terraform/                # Helm releases for PostgreSQL, Redis, RabbitMQ, MinIO
├── services/
│   ├── auth-service/             # NestJS, Prisma, JWT RS256
│   │   ├── prisma/
│   │   │   ├── platform/schema.prisma    # Platform DB schema (tenants, users)
│   │   │   └── tenant/schema.prisma      # Tenant DB schema
│   └── auth-service/             # NestJS, Prisma, JWT RS256
│       ├── prisma/
│       │   ├── platform/schema.prisma    # Platform DB schema (tenants, users)
│       │   └── tenant/schema.prisma      # Tenant DB schema
│       ├── scripts/setup.sh      # One-time infrastructure setup on VM
│       └── src/                  # NestJS source code
---

## 7. Critical Configuration Details (GOTCHAS)

### Traefik — MUST use correct API version
- **Use `traefik.io/v1alpha1`** in all IngressRoute files
- **NEVER use `traefik.containo.us/v1alpha1`** — Traefik v3 ignores it completely
- Proof: `argocd-ingress.yaml` and `grafana-ingress.yaml` use `traefik.io` and work

### Traefik — hostNetwork
- Traefik runs with `hostNetwork: true` via HelmChartConfig
- This was required because pod-to-pod CNI routing was broken on the VM
- Applied via: `kubectl apply -f` a HelmChartConfig resource (not stored in Git currently)
- If Traefik loses hostNetwork after K3s restart, re-apply:
- After VM restart: ArgoCD repo-server loses connectivity → `connection refused` error
  - Fix: `kubectl rollout restart deployment argocd-repo-server -n argocd`
- ArgoCD application controller is a **StatefulSet**, not a Deployment  
  - `kubectl rollout restart statefulset argocd-application-controller -n argocd`
- ArgoCD does NOT restart pods when Docker images change — that's the CD pipeline's job

### K3s — Post-restart checklist
When the VM is restarted, run these **on the VM** in order:
```bash
# 1. Fix kubeconfig permissions (resets on restart)
sudo chmod 644 /etc/rancher/k3s/k3s.yaml

# 2. Restart ArgoCD repo-server
kubectl rollout restart deployment argocd-repo-server -n argocd

# 3. Re-apply Traefik hostNetwork config
cat <<'EOF' | kubectl apply -f -
apiVersion: helm.cattle.io/v1
kind: HelmChartConfig
metadata:
  name: traefik
  namespace: kube-system
spec:
  valuesContent: |-
    hostNetwork: true
EOF

# 4. Wait 30 seconds, then verify
sleep 30
kubectl get pods -A | grep -v Running
```

### Placeholder Services
`infra/k8s/services/placeholder-services.yaml` contains K8s Service stubs for undeployed microservices (project, resource, planning, reporting). These are required because Traefik rejects the entire IngressRoute if ANY referenced service doesn't exist. Remove each placeholder when the actual service is deployed.

### Services Deleted (March 2, 2026)
- **Admin Service** and **Admin Portal** (Next.js) have been removed
- **Reason**: Simplify deliverables; focus on core field operations features
- **Alternative**: Tenant provisioning done manually via Terraform + kubectl
- **Benefits**: Less complexity, faster development of core microservices

---

## 8. Routing Table

All routes in `infra/k8s/ingress/ingressroutes.yaml`:

| Path | Service | Port | Notes |
|---|---|---|---|
| `/api/auth` | auth-service | 3001 | ✅ Working |
| `/api/docs` | auth-service | 3001 | ✅ Swagger UI |
| `/api/projects`, `/api/tasks`, `/api/phases` | project-service | 3002 | ❌ Placeholder |
| `/api/resources`, `/api/vehicles`, `/api/equipment` | resource-service | 3003 | ❌ Placeholder |
| `/api/planning` | planning-service | 3004 | ❌ Placeholder |
| `/api/reports` | reporting-service | 3005 | ❌ Placeholder |
| `/argocd` | argocd-server (argocd ns) | 80 | ✅ Working |
| `/grafana` | kube-prometheus-grafana (monitoring ns) | 80 | ✅ Working |
| `/jaeger` | jaeger-query (monitoring ns) | 16686 | ✅ Working |

---

## 9. Access URLs

| URL | What | Status |
|---|---|---|

| `http://192.168.50.10/api/docs` | Swagger API docs | ✅ |
| `http://192.168.50.10/argocd` | ArgoCD dashboard | ✅ |
| `http://192.168.50.10/grafana` | Grafana dashboards | ✅ |

---

## 10. Testing & Code Quality

### Current state
- **Auth-service**: Has comprehensive Jest unit tests (`83% coverage`)
- **SonarCloud**: Configured in `sonar-project.properties`, runs in CI
  - Project key: `Achrefs16_FieldOps360`
  - Organization: `achrefs16`
  - Only scans `services/auth-service/src`
- **Trivy**: Docker image vulnerability scanning in CI (auth-service only). Pipeline is strict and will fail the build on 'CRITICAL' or 'HIGH' severities.
- **No integration tests or E2E tests exist yet**

### What needs to be done
- [x] Write comprehensive unit tests for auth-service (target: 80% coverage)
- [ ] Add integration tests (test API endpoints with real database)
- [ ] Extend SonarCloud to scan all services
- [ ] Extend Trivy scanning to all service images
- [x] Make Jest tests actually fail the CI build (remove `|| true`)

---

## 11. Observability & Monitoring

### Deployed
- **Prometheus** — collects metrics from all K8s components
- **Grafana** — dashboards at `/grafana` (kube-prometheus-stack)

### NOT deployed (TODO)
- **Jaeger** — distributed tracing
  - Need to deploy Jaeger to K8s (Helm: `jaegertracing/jaeger`)
  - Need to integrate OpenTelemetry SDK into each NestJS service
  - Need to add a Traefik IngressRoute for Jaeger UI (e.g., `/jaeger`)
- **ELK/Loki** — centralized logging (not deployed)
- **Custom Grafana dashboards** — need dashboards for:
  - Service health
  - Request latency
  - Error rates
  - Business metrics (active tenants, users)

---

## 12. Auth Service Details

### Database
- **Platform DB** (`fieldops_platform`): tenants, users, roles, subscriptions
- **Tenant DB** (`fieldops_tenant_demo`): tenant-specific data
- Both managed by Prisma ORM with separate schemas

### JWT Authentication
- RS256 (asymmetric) keys stored in K8s Secret `jwt-keys`
- Keys generated by `setup.sh` script
- Private key: signs tokens
- Public key: verifies tokens (can be shared with other services)

### Swagger
- Available at `/api/docs`
- Auto-generated from NestJS decorators

---

## 13. Credentials & Secrets

Stored in K8s Secrets (fieldops-dev namespace):
- `fieldops-secrets` — `postgresql-password`, `redis-password`, `minio-access-key`, `minio-secret-key`
- `jwt-keys` — `private.pem`, `public.pem`
- `smtp-credentials` — `smtp-user`, `smtp-pass`

GitHub Actions Secrets:
- `DOCKERHUB_USERNAME` — Docker Hub username (`achrefs161`)
- `DOCKERHUB_TOKEN` — Docker Hub access token
- `SONAR_TOKEN` — SonarCloud token

---

## 14. Suggested Next Steps (Priority Order)

### High Priority
1. **Implement project-service** (Express.js) — the core business service with projects, tasks, phases
2. ~~**Write comprehensive tests** — increase auth-service coverage to 80%+~~ (Done)
3. **Implement resource-service** (FastAPI) — vehicle/equipment/material management
4. **Implement planning-service** (Go) — check-in/out, GPS, photos, signatures

### Medium Priority
5. **Implement reporting-service** (Rust) — KPIs, PDF/Excel generation, analytics
6. **Build web frontend** (React) — Dashboard, Gantt, GPS map
7. **Add OpenTelemetry** to all services for distributed tracing
8. ~~**Deploy Jaeger** for tracing visualization~~ (Done)
9. ~~**Create custom Grafana dashboards**~~ (Done for Auth-Service HTTP Traffic)

### Low Priority
10. **Build mobile app** (React Native) — Field worker app with GPS and camera
11. **Add TLS/HTTPS** (Let's Encrypt + Traefik)
12. **Complete network policies** (egress rules)
13. **Set up PostgreSQL backups** to MinIO
14. **Horizontal Pod Autoscaler** based on CPU/memory
15. **Finalize PFE defense presentation**

---

> **To the new AI**: 
> 1. Read this ENTIRE document before making any changes
> 2. NEVER run kubectl/curl commands on Windows — always instruct the user to run them on the VM
> 3. The most common pitfalls: wrong Traefik API version (`traefik.io/v1alpha1` is correct)
> 4. Most services are NOT implemented yet — only auth-service is fully working
> 5. Admin-service and admin-portal were deleted on March 2, 2026 to simplify project scope
