# Auth Service

The Auth Service handles user authentication, profile management, and multi-tenant database routing for the FieldOps360 platform.

## Architecture Highlights
- **Framework**: NestJS 11
- **Database**: Prisma 5 with PostgreSQL
- **Multi-Tenancy**: Data isolation via `TenantMiddleware`, dynamically connecting to a database per tenant (`fieldops_tenant_<subdomain>`).
- **Security**: JWT RS256, bcrypt, 30-minute account lockout after 5 failed attempts.

## Running Tests

This service uses Jest for unit testing. The core business logic (`AuthService`, `UsersService`) is fully covered by automated tests.

### Run all tests
```bash
npm run test
```

### Run tests in watch mode (development)
```bash
npm run test:watch
```

### Run test coverage report
```bash
npm run test:cov
```

## Running Locally Without Docker/K3s
1. Start PostgreSQL (e.g. `docker run -p 5432:5432 postgres:16-alpine`)
2. Create databases: `fieldops_platform` and `fieldops_tenant_demo`
3. Generate JWT keys in the `keys/` directory (`private.pem`, `public.pem`)
4. Copy `.env.example` to `.env` and adjust the database URLs to `127.0.0.1`
5. Run migrations: `npx prisma db push --schema=prisma/platform/schema.prisma` and `prisma/tenant/schema.prisma`
6. Seed data: `npx ts-node src/database/prisma/seed.ts`
7. Start server: `npm run start:dev`

Swagger UI will be available at `http://127.0.0.1:3001/api/docs`.
