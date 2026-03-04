import { Test, TestingModule } from '@nestjs/testing';
import { TenantMiddleware, TenantRequest } from './tenant.middleware';
import { PlatformDatabaseService } from '../../database/platform.service';
import { TenantDatabaseService } from '../../database/tenant.service';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';

describe('TenantMiddleware', () => {
    let middleware: TenantMiddleware;
    let platformDb: any;
    let tenantDb: any;

    beforeEach(async () => {
        platformDb = { tenant: { findUnique: jest.fn() } };
        tenantDb = { getClient: jest.fn() };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TenantMiddleware,
                { provide: PlatformDatabaseService, useValue: platformDb },
                { provide: TenantDatabaseService, useValue: tenantDb },
            ],
        }).compile();

        middleware = module.get<TenantMiddleware>(TenantMiddleware);
    });

    it('should be defined', () => {
        expect(middleware).toBeDefined();
    });

    it('should throw if no header', async () => {
        const req = { headers: {} } as any;
        await expect(middleware.use(req, {} as any, jest.fn())).rejects.toThrow(UnauthorizedException);
    });

    it('should throw if tenant not found', async () => {
        const req = { headers: { 'x-tenant-id': 'demo' } } as any;
        platformDb.tenant.findUnique.mockResolvedValue(null);
        await expect(middleware.use(req, {} as any, jest.fn())).rejects.toThrow(ForbiddenException);
    });

    it('should throw if tenant suspended', async () => {
        const req = { headers: { 'x-tenant-id': 'demo' } } as any;
        platformDb.tenant.findUnique.mockResolvedValue({ active: false });
        await expect(middleware.use(req, {} as any, jest.fn())).rejects.toThrow(ForbiddenException);
    });

    it('should attach tenant and call next', async () => {
        const req = { headers: { 'x-tenant-id': 'demo' } } as any;
        platformDb.tenant.findUnique.mockResolvedValue({ id: 'tid', subdomain: 'demo', active: true, dbName: 'db', dbHost: 'localhost', dbPort: 5432 });
        tenantDb.getClient.mockReturnValue({});

        const next = jest.fn();
        await middleware.use(req, {} as any, next);

        expect(next).toHaveBeenCalled();
        expect(req.tenantId).toBe('tid');
        expect(req.tenantSubdomain).toBe('demo');
        expect(req.tenantDb).toBeDefined();
    });
});
