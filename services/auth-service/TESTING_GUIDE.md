# Auth-Service Testing Guide

This document outlines the testing strategy, patterns, and structure used in the `auth-service` to achieve >80% test coverage and ensure correct behavior.

## Overview

The testing framework used is **Jest** along with **@nestjs/testing** module for mocking dependencies. Tests are run locally or via CI (`npm run test:cov`) and are configured strictly—they must pass, and the resulting coverage report should be reviewed before merging to `develop` or `main`.

## Test Structure

Unit tests are written in files ending with `.spec.ts` located right next to the code they are testing. This makes them easy to find and keep in sync with source code.

```text
src/
  ├── auth/
  │   ├── auth.controller.ts
  │   ├── auth.controller.spec.ts   <- Controller Tests
  │   ├── auth.service.ts
  │   └── auth.service.spec.ts      <- Service Tests
...
```

## Mocking Strategy

The general approach is to **isolate** the unit under test. If we are testing a Controller, we mock the Service. If we are testing a Service, we mock the Database, External APIs (MinIO, NodeMailer), and generic Utils (like bcrypt, crypto).

### 1. Mocking Prisma (Database)
Since the app uses a multi-tenant DB structure through `TenantRequest` (`req.tenantDb.user...`), we mock the `tenantDb` injected by the middleware in our request object.

```typescript
// Reusable Mock Database structure
const mockTenantDbUser = {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
};

// Reusable Mock Request
const mockReq = {
    tenantId: 'platform-tenant-id',
    tenantSubdomain: 'demo',
    tenantDb: {
        user: mockTenantDbUser,
    },
} as unknown as TenantRequest;
```

### 2. Mocking Services (in Controller Tests)
When testing a controller, you don't care *how* the service works, just that it's called correctly and handles the returned value properly.
```typescript
const mockAuthService = {
    login: jest.fn().mockResolvedValue({ access_token: 'ac' }),
};

// In Test Module setup:
providers: [{ provide: AuthService, useValue: mockAuthService }]
```

### 3. Mocking External Libraries
Libraries like `bcryptjs`, `nodemailer`, `uuid`, and `fs` (file system) can be mocked directly at the top of the file to prevent actual hashing, emails, uuid generation or file reads.

```typescript
import * as bcrypt from 'bcryptjs';
jest.mock('bcryptjs');

// usage in test
(bcrypt.compare as jest.Mock).mockResolvedValue(true);
```

## Running Tests

*   **All Tests:** `npm run test`
*   **Watch Mode:** `npm run test:watch`
*   **Coverage Report:** `npm run test:cov`

### Coverage Targets

The project aims for `80%+` across the following:
*   `% Stmts` (Statements)
*   `% Branch` (If/else, Switch cases)
*   `% Funcs` (Functions covered)
*   `% Lines` (Line execution)

## Common Test Scenarios

### 1. Exception Testing (Rejecting Promises)
To ensure validation or logic throws the right HTTP Exceptions (`NotFoundException`, `UnauthorizedException`).
```typescript
it('should throw UnauthorizedException if wrong password', async () => {
    mockTenantDbUser.findUnique.mockResolvedValue(someValidUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false); // Force password falsification
    
    await expect(authService.login(mockReq, dto)).rejects.toThrow(UnauthorizedException);
});
```

### 2. Resolving Promises (Happy Path)
Ensure valid states return correctly.
```typescript
it('should return token on success', async () => {
    const dto = { email: 'e', password: 'p' };
    const result = await controller.login(mockReq, dto);
    
    expect(authService.login).toHaveBeenCalledWith(mockReq, dto);
    expect(result).toHaveProperty('access_token');
});
```

### 3. Argument Matching
Use `expect.objectContaining()` or `expect.any(Object)` to ensure PRISMA database mutations are formed correctly without needing to verify every single field exactly.

```typescript
expect(mockTenantDbUser.update).toHaveBeenCalledWith(
    expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({ firstName: 'Johnny' }),
    }),
);
```

## CI/CD Strictness

The CI pipeline (`.github/workflows/ci.yml`) is configured to run tests via:
`npx jest --coverage --coverageReporters=lcov`

**Note:** The pipeline `|| true` bypass has been explicitly removed. This means any failed assertions will stop the build process. Furthermore, Trivy vulnerability scans are set up to force-fail executions containing `CRITICAL` or `HIGH` vulnerabilities on resulting docker images.

## Excluded Files
Files strictly acting as bootstrappers or generic seeds are excluded from coverage in `package.json`:
*   `src/main.ts`
*   `src/database/prisma/seed.ts`
*   `/node_modules/`
