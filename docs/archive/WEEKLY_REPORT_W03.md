# FieldOps360 - Rapport d'Avancement Hebdomadaire
## Semaine du 23 au 28 Fevrier 2026 (Semaine 03)

**Projet** : FieldOps360 - Plateforme SaaS de gestion d'interventions terrain
**Equipe** : Achref
**Phase** : Developpement du premier microservice (Auth Service)

---

## 1. Resume Executif
Cette semaine marque le passage de la phase infrastructure a la phase developpement avec la creation complete du **Auth Service**, le premier microservice du systeme. Le service implemente 14 endpoints REST, une architecture multi-tenant avec isolation base de donnees par client, une authentification JWT RS256, et une gestion des roles hierarchique (RBAC). L'ensemble est integre dans le pipeline CI/CD existant et pret pour le deploiement sur le cluster K3s.

---

## 2. Rappel des Avancees Precedentes

- **Cluster K3s** : K3s operationnel sur VM Ubuntu (8GB RAM) avec kubeconfig configure.
- **Infrastructure as Code** : Terraform deploie PostgreSQL, Redis, RabbitMQ et MinIO via Helm charts.
- **CI/CD** : Pipelines GitHub Actions (ci.yml + cd.yml) avec path filtering et self-hosted runner sur la VM.
- **Routage** : Traefik IngressRoutes configurees pour les 5 microservices, CRDs automatises.
- **Network Policies** : Zero Trust en ingress (deny-all par defaut, seul Traefik atteint les services).

---

## 3. Travaux Realises

### 3.1 Scaffolding du Projet NestJS

- Initialisation du projet dans `services/auth-service/` avec NestJS 11.
- Installation de toutes les dependances : `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`, `prisma`, `@prisma/client`, `bcryptjs`, `nodemailer`, `minio`, `class-validator`, `class-transformer`, `uuid`.
- Mise en place de l'architecture Clean Architecture avec separation en modules : `auth/`, `users/`, `profile/`, `common/`, `database/`.
- Configuration `tsconfig.json` avec TypeScript strict et compilation zero erreurs.

### 3.2 Base de Donnees et Multi-Tenant

- **ORM** : Prisma 5 selectionne pour sa type-safety et ses capacites de migration.
- **Schema Platform** (`prisma/platform/schema.prisma`) : Tables `tenants`, `platform_admins`, `subscription_plans` dans la base partagee `fieldops_platform`.
- **Schema Tenant** (`prisma/tenant/schema.prisma`) : Table `users` dans les bases isolees `fieldops_tenant_*` (une base par client).
- **Middleware Multi-Tenant** (`tenant.middleware.ts`) :
  - Lit le header `X-Tenant-ID` injecte par Traefik depuis le sous-domaine.
  - Resout le tenant dans la base platform.
  - Attache un PrismaClient connecte a la base isolee du tenant sur chaque requete.
  - Cache des connexions pour eviter la reconnexion a chaque requete.
- **Services Database** :
  - `PlatformDatabaseService` : Wrapper PrismaClient pour la base partagee, avec override de l'URL via variable d'environnement.
  - `TenantDatabaseService` : Factory dynamique qui cree et cache des PrismaClient par tenant.
- **Seed Script** (`seed.ts`) : Creation automatisee d'un Super Admin, d'un tenant demo, et de 3 utilisateurs test (Manager, Project Manager, Team Member) avec mots de passe hashes.

### 3.3 Endpoints d'Authentification (5 endpoints)

| Methode | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/v1/login` | Authentification JWT RS256 + bcrypt + verrouillage apres 5 tentatives |
| POST | `/api/auth/v1/refresh` | Rotation du refresh token a chaque appel |
| POST | `/api/auth/v1/logout` | Revocation du refresh token |
| POST | `/api/auth/v1/forgot-password` | Generation d'un token de reset + envoi email (Nodemailer/Mailtrap) |
| POST | `/api/auth/v1/reset-password` | Validation du token + changement de mot de passe |

### 3.4 Endpoints de Gestion des Utilisateurs (5 endpoints)

| Methode | Endpoint | Permission | Description |
|---|---|---|---|
| GET | `/api/auth/v1/users` | MANAGER+ | Liste paginee avec recherche et filtres (role, actif) |
| POST | `/api/auth/v1/users` | MANAGER | Creation avec validation email unique, hash bcrypt |
| GET | `/api/auth/v1/users/:id` | MANAGER+ | Detail d'un utilisateur |
| PUT | `/api/auth/v1/users/:id` | MANAGER | Mise a jour avec verification doublon email |
| PATCH | `/api/auth/v1/users/:id/status` | MANAGER | Activation/desactivation |

### 3.5 Endpoints Profil (4 endpoints)

| Methode | Endpoint | Description |
|---|---|---|
| GET | `/api/auth/v1/me` | Profil de l'utilisateur connecte |
| PUT | `/api/auth/v1/me` | Modification du profil (nom, telephone, langue, fuseau) |
| PUT | `/api/auth/v1/me/password` | Changement de mot de passe (verification ancien + validation) |
| PUT | `/api/auth/v1/me/avatar` | Upload d'avatar vers MinIO (JPEG/PNG/WebP, max 2MB) |

### 3.6 Securite et Guards

- **JWT Strategy RS256** : Lecture des cles PEM depuis fichiers montes en volume K8s. Access tokens 15 min, refresh tokens 7 jours.
- **Hashage bcrypt** : 10 rounds de sel pour tous les mots de passe.
- **Verrouillage de compte** : Apres 5 tentatives echouees, compte verrouille pendant 30 minutes.
- **Rotation des refresh tokens** : Nouveau token genere a chaque renouvellement.
- **RBAC hierarchique** : 5 niveaux (SUPER_ADMIN > MANAGER > PROJECT_MANAGER > SITE_LEADER > TEAM_MEMBER). Le guard verifie que le niveau de l'utilisateur est superieur ou egal au niveau requis.
- **Format de reponse standardise** :
  - Succes : `{ success: true, data: {...}, meta?: {...} }`
  - Erreur : `{ success: false, error: { code, message, details? } }`
- **Decorateurs** : `@Roles()` pour specifier les roles requis, `@CurrentUser()` pour extraire le payload JWT.

### 3.7 Integration CI/CD

- **ci.yml** : Ajout d'un job `lint-test` pour l'auth-service qui installe les dependances, genere les clients Prisma, et lance `tsc --noEmit` avant le build Docker. Le code ne peut pas etre deploye s'il ne compile pas.
- **cd.yml** : Deja configure pour boucler sur les 5 services et mettre a jour le Deployment via `kubectl set image`. Aucune modification necessaire.
- **IngressRoute** : Deja configuree pour router `PathPrefix(/api/auth)` vers `auth-service:3001`. Aucune modification necessaire.

### 3.8 Kubernetes et Deploiement

- **Dockerfile multi-stage** (3 etapes) :
  1. `deps` : Installation des node_modules (couche cachee).
  2. `builder` : Compilation TypeScript + generation Prisma.
  3. `runner` : Image Alpine minimale, utilisateur non-root (UID 1001), healthcheck integre.
- **Manifestes K8s modulaires** :
  - `infra/k8s/configmaps/auth-service.yaml` : Variables non-sensibles (ports, hosts, expiry).
  - `infra/k8s/services/auth-service.yaml` : Service ClusterIP sur le port 3001.
  - `infra/k8s/deployments/auth-service.yaml` : Deployment avec envFrom ConfigMap, secretKeyRef, probes, resource limits, contexte securise.
  - `infra/k8s/secrets/smtp-credentials.yaml` : Credentials SMTP pour l'envoi d'emails.
- **Secrets Management** :
  - `fieldops-secrets` (Terraform) : postgresql-password, redis-password, minio-access-key, minio-secret-key.
  - `jwt-keys` (setup.sh) : private.pem, public.pem pour JWT RS256.
  - `smtp-credentials` (manifeste) : smtp-user, smtp-pass.
  - Aucun secret en clair dans le code ou les manifestes.
- **Probes** : Liveness (30s) et readiness (10s) sur `/api/auth/v1/health`.
- **Script setup.sh** : Script one-time pour la VM K3s (ne necessite pas Node.js). Cree les bases, genere les cles, applique les manifestes, et lance les migrations/seed via K8s Jobs.

### 3.9 Mise a jour de la documentation

- **06_INFRASTRUCTURE_AND_DEPLOYMENT.md** : Mise a jour du roadmap infrastructure. Secrets Management et Probes marques comme **Done**.

---

## 4. Architecture des fichiers crees

```
services/auth-service/
  Dockerfile                          # Multi-stage build (3 etapes)
  .dockerignore
  .gitignore
  .env                                # Dev uniquement, gitignore
  .env.example                        # Template pour les dev
  package.json
  tsconfig.json
  prisma/
    platform/schema.prisma            # Schema base partagee
    tenant/schema.prisma              # Schema base par tenant
  scripts/
    setup.sh                          # Setup one-time sur VM K3s
    generate-keys.sh                  # Generation cles RS256
  src/
    main.ts                           # Bootstrap NestJS avec CORS, validation
    app.module.ts                     # Module racine (wiring global)
    health.controller.ts              # Endpoint /health pour K8s probes
    auth/
      auth.module.ts                  # Config JWT RS256 + Passport
      auth.controller.ts             # 5 endpoints authentification
      auth.service.ts                 # Logique: login, refresh, logout, reset
      strategies/jwt.strategy.ts      # Validation JWT RS256
      dto/                            # LoginDto, RefreshTokenDto, ForgotPasswordDto, ResetPasswordDto
    users/
      users.module.ts
      users.controller.ts             # 5 endpoints CRUD utilisateurs
      users.service.ts                # Logique: list, create, get, update, status
      dto/                            # CreateUserDto, UpdateUserDto
    profile/
      profile.module.ts
      profile.controller.ts           # 4 endpoints profil
      profile.service.ts              # Logique: get, update, password, avatar (MinIO)
      dto/                            # UpdateProfileDto, ChangePasswordDto
    common/
      middleware/tenant.middleware.ts  # Multi-tenant: X-Tenant-ID -> DB switching
      guards/jwt-auth.guard.ts        # Passport JWT guard
      guards/roles.guard.ts           # RBAC hierarchique
      decorators/roles.decorator.ts   # @Roles()
      decorators/current-user.decorator.ts  # @CurrentUser()
      interceptors/response.interceptor.ts  # Format reponse standard
      filters/http-exception.filter.ts      # Format erreur standard
      dto/pagination.dto.ts           # Pagination partagee
    database/
      database.module.ts              # Module global DB
      platform.service.ts             # PrismaClient base platform
      tenant.service.ts               # PrismaClient factory multi-tenant
      prisma/seed.ts                  # Seed: Super Admin + demo tenant + 3 users

infra/k8s/
  configmaps/auth-service.yaml        # NOUVEAU: Config non-sensible
  services/auth-service.yaml          # NOUVEAU: ClusterIP Service
  deployments/auth-service.yaml       # MODIFIE: Deployment seul + envFrom
  secrets/smtp-credentials.yaml       # NOUVEAU: Credentials SMTP
  ingress/ingressroutes.yaml          # EXISTANT: /api/auth -> auth-service:3001

.github/workflows/
  ci.yml                              # MODIFIE: Ajout job lint-test
  cd.yml                              # EXISTANT: Pas de modification
```

---

## 5. Metriques de la Semaine

| Metrique | Valeur |
|---|---|
| Fichiers TypeScript crees | 22 |
| Fichiers K8s crees/modifies | 5 |
| Fichiers DevOps/Scripts crees | 3 |
| Endpoints API implementes | 14 (+1 health) |
| Schemas Prisma | 2 (6 tables) |
| Tests Unitaires (Jest) | 22 tests (100% succes) |
| DTOs de validation | 7 |
| Guards/Interceptors/Filters | 4 |
| Pipeline CI mise a jour | 1 job ajoute |
| Compilation TypeScript | 0 erreurs |

---

## 6. Prochaines Etapes (Semaine 04)

1. **Deploiement sur K3s** : Push du code sur GitHub, declenchement CI/CD, execution de `setup.sh` sur la VM.
2. **Tests d'integration** : Test des endpoints avec curl/Postman via le cluster K3s.
3. **Deuxieme microservice** : Scaffolding du Project Service (CRUD projets, taches, equipes).

---

*Document genere le 24/02/2026*
