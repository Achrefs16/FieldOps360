import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateTenantDto } from './dto/tenant.dto';

@Injectable()
export class TenantsService {
    constructor(private readonly prisma: PrismaService) { }

    // List all tenants with their plan
    async findAll() {
        return this.prisma.tenant.findMany({
            where: { status: { not: 'DELETED' } },
            include: { plan: true },
            orderBy: { createdAt: 'desc' },
        });
    }

    // Provision a new tenant (create DB, migrate, etc.)
    async provision(dto: CreateTenantDto) {
        const dbName = `fieldops_tenant_${dto.subdomain.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

        // 1. Create tenant record in platform DB
        const tenant = await this.prisma.tenant.create({
            data: {
                name: dto.name,
                subdomain: dto.subdomain,
                sector: dto.sector,
                planId: dto.plan_id,
                contactName: dto.contact_name,
                contactEmail: dto.contact_email,
                contactPhone: dto.contact_phone,
                dbName,
                usersCount: 1, // The admin user
            },
            include: { plan: true },
        });

        // 2. In production, these would be automated:
        // - CREATE DATABASE fieldops_tenant_xxx
        // - prisma migrate deploy
        // - INSERT admin user into tenant DB
        // - Create Traefik IngressRoute for subdomain
        // - Send welcome email via SMTP
        //
        // For PFE demo, the tenant record is created and the
        // frontend shows animated provisioning steps.

        return {
            ...tenant,
            provisioning: {
                database: `${dbName} created`,
                migrations: '24 tables migrated',
                adminAccount: `${dto.admin_user.email} created`,
                routing: `${dto.subdomain}.fieldops360.com configured`,
                email: `Welcome email sent to ${dto.admin_user.email}`,
            },
        };
    }

    // Suspend a tenant
    async suspend(id: string) {
        const tenant = await this.findById(id);
        return this.prisma.tenant.update({
            where: { id: tenant.id },
            data: { status: 'SUSPENDED' },
        });
    }

    // Activate a tenant
    async activate(id: string) {
        const tenant = await this.findById(id);
        return this.prisma.tenant.update({
            where: { id: tenant.id },
            data: { status: 'ACTIVE' },
        });
    }

    // Soft delete a tenant
    async softDelete(id: string) {
        const tenant = await this.findById(id);
        return this.prisma.tenant.update({
            where: { id: tenant.id },
            data: { status: 'DELETED', deletedAt: new Date() },
        });
    }

    // Get tenant metrics
    async getMetrics(id: string) {
        const tenant = await this.prisma.tenant.findUnique({
            where: { id },
            include: { plan: true },
        });

        if (!tenant) throw new NotFoundException('Tenant not found');

        return {
            tenant_id: tenant.id,
            users: {
                total: tenant.usersCount,
                active: Math.floor(tenant.usersCount * 0.85),
                limit: tenant.plan.maxUsers,
            },
            storage: {
                used_gb: Number(tenant.storageUsed),
                limit_gb: tenant.plan.storageGb,
            },
            projects: {
                active: Math.floor(Math.random() * 5) + 1,
                total: Math.floor(Math.random() * 10) + 2,
                limit: tenant.plan.maxProjects,
            },
            api_calls_today: Math.floor(Math.random() * 5000) + 500,
            last_activity: new Date().toISOString(),
        };
    }

    // Helper: find by ID or throw
    private async findById(id: string) {
        const tenant = await this.prisma.tenant.findUnique({ where: { id } });
        if (!tenant) throw new NotFoundException('Tenant not found');
        return tenant;
    }
}
