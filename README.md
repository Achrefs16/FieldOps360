# FieldOps360

**Plateforme de Suivi des Équipes d'Intervention Terrain**

> A cloud-native, multi-tenant SaaS platform for managing field intervention teams in BTP, Electricity, and Public Works sectors.

## Architecture

- **Frontend**: React (Web) + React Native (Mobile)
- **Backend**: Polyglot Microservices (NestJS, Express, FastAPI, Go)
- **Infrastructure**: K3s, Terraform, GitHub Actions
- **Observability**: Prometheus, Grafana, Loki, Jaeger

## Environments

| Environment | Namespace | Purpose |
|---|---|---|
| Dev | `fieldops-dev` | Development |
| Staging | `fieldops-staging` | Pre-production |
| Production | `fieldops-prod` | Production (Blue/Green) |

## Getting Started

See [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) for full project details.
