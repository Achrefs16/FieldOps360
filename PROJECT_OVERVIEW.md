# FieldOps360 — Project Overview

**Plateforme de Suivi des Équipes d'Intervention Terrain**

> SaaS multi-tenant platform for tracking and managing field intervention teams in **BTP, Electricity, and Public Works** sectors.

---

## Functional Architecture

### User Profiles

| Profile | Role |
|---|---|
| **Manager** | Global KPI dashboard, multi-site consolidated view, profitability tracking |
| **Chef de Projet** | Interactive Gantt planning, resource allocation, budget tracking |
| **Chef de Chantier** | Daily work plans, task validation, team attendance |
| **Membre d'Équipe** | Task list (mobile), photo upload/proof, geolocated attendance, e-signature |

### 5 Functional Modules

1. **Project/Site Management** — Create sites, define phases/milestones, manage documents
2. **Resource Management** — Vehicle fleet (GPS), equipment inventory, raw materials stock
3. **Planning & Execution** — Drag & drop scheduling, auto-assign by skills, customizable checklists
4. **Traceability & Proof** — Timestamping, geolocation, watermarked photos, e-signatures, audit trail
5. **Reporting & Analytics** — Real-time KPIs, automatic reports, PDF/Excel export

---

## Technology Stack

### Frontend

| Layer | Technology |
|---|---|
| **Web App** | React (TypeScript) |
| **Mobile App** | React Native |

### Backend Microservices (Polyglot)

| Microservice | Tech | Purpose |
|---|---|---|
| **Auth Service** | NestJS (Node.js) | JWT authentication, RBAC, multi-tenant user management |
| **Project Service** | Express (Node.js) | Site/project CRUD, phases, milestones, documents |
| **Resource Service** | FastAPI (Python) | Fleet, equipment, material management |
| **Planning Service** | Go | High-performance scheduling, task assignment engine |
| **Reporting Service** | TBD | KPI aggregation, report generation |

### Infrastructure & DevOps

| Component | Technology |
|---|---|
| **Orchestration** | K3s (lightweight Kubernetes) |
| **IaC** | Terraform |
| **CI/CD** | GitHub Actions |
| **API Gateway** | Traefik (bundled with K3s) |
| **Database** | PostgreSQL (database-per-tenant) |
| **Cache** | Redis |
| **Message Broker** | RabbitMQ or Kafka |
| **File Storage** | MinIO (S3-compatible) |
| **Monitoring** | Prometheus + Grafana |
| **Logging** | ELK Stack or Loki |
| **Tracing** | Jaeger |

---

## 3 Environments (Ubuntu Server VM)

| Environment | Namespace | Purpose |
|---|---|---|
| **Dev** | `fieldops-dev` | Active development, fast iteration |
| **Staging** | `fieldops-staging` | Pre-production testing, mirrors production |
| **Production** | `fieldops-prod` | Final deployment, Blue/Green strategy |

---

## CI/CD Pipeline (GitHub Actions)

```
Push → Lint & Build → Unit Tests → Security Scan (SAST) → Docker Build →
Push to Registry → Deploy to Dev → Integration Tests →
Deploy to Staging → E2E Tests → Blue/Green Deploy to Prod
```

---

## Implementation Roadmap

1. **Infrastructure Setup** — Terraform modules for K3s namespaces (dev/staging/prod), PostgreSQL, Redis, MinIO, RabbitMQ
2. **Git Repository Structure** — Monorepo with each microservice in its own folder, Helm charts, Terraform configs
3. **Microservices Scaffolding** — Create each backend service with its respective framework
4. **Dockerization** — Dockerfile for each service
5. **Helm Charts** — Kubernetes deployment manifests for each service
6. **CI/CD Pipelines** — GitHub Actions workflows for build, test, scan, deploy
7. **API Gateway** — Configure Traefik routing
8. **Multi-Tenant System** — Database-per-tenant provisioning scripts
9. **Frontend (React + React Native)** — Role-based dashboards
10. **Observability Stack** — Prometheus, Grafana, Loki/ELK, Jaeger
11. **Documentation** — Architecture docs, API docs (Swagger), runbooks

---

## Deliverables

### Technical
- Git repository with GitFlow branching strategy
- Infrastructure as Code (Terraform)
- Helm Charts for K8s deployment
- Complete CI/CD pipeline (GitHub Actions)
- Operational monitoring stack
- Tenant provisioning automation scripts
- Automated tests (unit, integration, E2E)

### Documentation
- Technical architecture document
- Deployment & operations guide
- Runbooks for common incidents
- API documentation (OpenAPI/Swagger)

### Demo
- Functional demo environment
- New client provisioning scenario
- Monitoring dashboard

---

## Bonus Innovation Axes

1. **GitOps** with ArgoCD/Flux
2. **Service Mesh** (Istio/Linkerd)
3. **Chaos Engineering** for resilience testing
4. **FinOps** — Cloud cost optimization per tenant
5. **MLOps** — Task duration prediction based on history
