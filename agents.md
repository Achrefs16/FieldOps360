# FieldOps360 - AI Assistant Guidelines (.cursorrules / agents.md)

> This file contains the core architectural decisions, coding standards, and best practices for the FieldOps360 project. AI coding assistants MUST read and follow these rules when writing code or making architectural suggestions for this repository.

## 1. Project Overview
- **Name**: FieldOps360
- **Type**: SaaS Platform for Field Operations Management (BTP, Public Works, Electrical)
- **Architecture**: Microservices, Cloud-Native, API-First
- **Tenancy Model**: Multi-tenant (Database-per-Tenant)
- **Infrastructure**: Kubernetes (K3s), Terraform, ArgoCD (GitOps)

## 2. Technology Stack
- **Backend**: NestJS (TypeScript), Express.js, FastAPI, Go, Rust
- **Frontend**: React (Web), React Native (Mobile) - *Planned*
- **Databases**: PostgreSQL (Relational), Redis (Cache/Session)
- **Message Broker**: RabbitMQ
- **Object Storage**: MinIO (S3-compatible)
- **ORM**: Prisma (for Node.js services)
- **Containerization**: Docker (Alpine, Multi-stage)
- **CI/CD**: GitHub Actions

## 3. Core Architectural Rules

### 3.1 Multi-Tenancy (CRITICAL)
- The system uses a **Database-per-Tenant** strategy.
- Every incoming HTTP request to a Node.js service MUST be intercepted by the `TenantMiddleware`.
- The middleware reads the `X-Tenant-ID` header (injected by Traefik from the subdomain).
- The middleware attaches a specific `PrismaClient` connected *only* to that tenant's database to the `req` object.
- **Rule**: NEVER write generic SQL queries. ALWAYS use `req.tenantDb` for tenant-specific data operations.
- The `fieldops_platform` database is STRICTLY for tenant registries and super-admins. No operational data goes here.

### 3.2 Security & Authentication
- All services use **JWT RS256** (Asymmetric encryption).
- Only the Auth Service has the Private Key (to sign tokens).
- Other services use the Public Key to verify tokens.
- **Passwords**: Must be hashed using `bcrypt` (10 rounds). NEVER log or return passwords in API responses.
- **Route Protection**: Use `@UseGuards(JwtAuthGuard)` and `@Roles('MANAGER', 'PROJECT_MANAGER', ...)` decorators to protect endpoints.
- **Least Privilege**: Always apply the lowest necessary RBAC permission for an endpoint.

### 3.3 Microservices Communication
- **Synchronous**: REST API calls via Traefik.
- **Asynchronous**: Events via RabbitMQ.
- Services should be loosely coupled. If Service A goes down, Service B should handle it gracefully (e.g., using circuit breakers or offline queues).

## 4. Coding Standards (TypeScript / NestJS)

### 4.1 Clean Architecture
Follow a strict 3-layer architecture:
1.  **Controllers**: Handle HTTP routing, parsing, and DTO validation. NO business logic here.
2.  **Services**: Pure business logic. Must be fully testable without HTTP context.
3.  **Database (Prisma)**: Data access layer.

### 4.2 Formatting and Linting
- Use **Strict TypeScript** (`"strict": true` in tsconfig).
- No `any` types unless absolutely unavoidable (use `unknown` and type guards instead).
- Use `PascalCase` for classes/interfaces, `camelCase` for variables/functions, `UPPER_SNAKE_CASE` for constants.
- Follow ESLint and Prettier rules defined in the project.

### 4.3 API Design (REST)
- Use plural nouns for resources (e.g., `/users`, not `/user`).
- Use Standard HTTP methods (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`).
- **Standardized Responses**:
    - Every endpoint MUST use the global `ResponseInterceptor` (returns `{ success: true, data: {...} }`).
    - Every error MUST be caught by the global `HttpExceptionFilter` (returns `{ success: false, error: {...} }`).
- **Swagger/OpenAPI**: EVERY endpoint, controller, and DTO must be decorated with `@nestjs/swagger` decorators (`@ApiProperty`, `@ApiOperation`, `@ApiResponse`).

## 5. DevOps & Infrastructure Rules

### 5.1 Docker
- Use **Multi-stage builds** based on `alpine` to keep image sizes small (< 200MB).
- NEVER run containers as `root`. Always create a specific user (e.g., `nestjs:nodejs`) in the Dockerfile.
- Always include a `HEALTHCHECK` directive.

### 5.2 Kubernetes (K8s)
- Store manifests in `infra/k8s/`.
- Never use `latest` tags in production deployments. Always use the Git SHA tag.
- Apply **Network Policies** (`default-deny-ingress` by default). Pods should only accept traffic from allowed sources (like Traefik).
- Use **Liveness and Readiness probes** for all deployments.

### 5.3 Terraform
- All infrastructure must be provisioned via Terraform (`infra/terraform/`).
- Use the `helm` provider to install third-party charts (PostgreSQL, Redis, ArgoCD).
- Secrets must not be hardcoded in `.tf` files. Pass them via `.tfvars` (which is git-ignored) and create Kubernetes Secrets.

### 5.4 GitOps (ArgoCD)
- Deployment to the K3s cluster is handled automatically by **ArgoCD**.
- To deploy a change, commit the updated Kubernetes YAML manifest to the `develop` or `main` branch. ArgoCD will pull and apply it automatically. Do NOT use `kubectl apply` manually.

### 5.5 Continuous Integration (GitHub Actions)
- All PRs must pass the CI pipeline (`ci.yml`).
- The pipeline uses `dorny/paths-filter`. If you only modify `auth-service`, only `auth-service` will be built and tested.
- Ensure `npm run build` and `npx tsc --noEmit` pass locally before pushing.

## 6. How to Assist the User
1. **Be Precise**: The user is studying a Master's in DevOps & Cloud. Do not skip infrastructure details. Explain *why* a decision is made, not just *what* it is.
2. **Read the Docs First**: Before answering architectural questions, read `docs/04_API_REFERENCE.md`, `docs/PRESENTATION_DETAILS.md`, and `docs/GUIDE_FONCTIONNEL.md`.
3. **Write Shell Scripts**: If a task requires multiple terminal commands, prefer writing a reusable `.sh` script rather than asking the user to copy-paste multiple commands.
4. **Think Infrastructure as Code**: If asked to deploy something, default to writing a Terraform module (`.tf`) or a Kubernetes manifest (`.yaml`), rather than a shell command.
