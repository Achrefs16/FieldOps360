import {
    Injectable,
    NestMiddleware,
    UnauthorizedException,
    ForbiddenException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PlatformDatabaseService } from '../../database/platform.service';
import { TenantDatabaseService } from '../../database/tenant.service';
import { PrismaClient } from '../../../node_modules/.prisma/tenant-client';

/**
 * Extend Express Request to carry tenant context.
 */
export interface TenantRequest extends Request {
    tenantId: string;
    tenantSubdomain: string;
    tenantDb: PrismaClient;
}

/**
 * TenantMiddleware resolves the tenant from the X-Tenant-ID header
 * (injected by Traefik from the subdomain) and attaches a scoped
 * PrismaClient connected to that tenant's isolated database.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
    constructor(
        private readonly platformDb: PlatformDatabaseService,
        private readonly tenantDbService: TenantDatabaseService,
    ) { }

    async use(req: TenantRequest, _res: Response, next: NextFunction) {
        const tenantId = req.headers['x-tenant-id'] as string;

        if (!tenantId) {
            throw new UnauthorizedException('Missing X-Tenant-ID header');
        }

        // Look up the tenant in the platform database
        const tenant = await this.platformDb.tenant.findUnique({
            where: { subdomain: tenantId },
        });

        if (!tenant) {
            throw new ForbiddenException(`Tenant "${tenantId}" not found`);
        }

        if (!tenant.active) {
            throw new ForbiddenException(`Tenant "${tenantId}" is suspended`);
        }

        // Attach tenant context to the request
        req.tenantId = tenant.id;
        req.tenantSubdomain = tenant.subdomain;
        req.tenantDb = this.tenantDbService.getClient(
            tenant.dbName,
            tenant.dbHost,
            tenant.dbPort,
        );

        next();
    }
}
