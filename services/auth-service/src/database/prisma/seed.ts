/**
 * Database Seed Script — runs once to bootstrap the system.
 *
 * Creates:
 * 1. A Super Admin account in the platform database
 * 2. A demo tenant record
 * 3. A test Manager account in the demo tenant's database
 *
 * Usage: npx ts-node src/database/prisma/seed.ts
 */

import { PrismaClient as PlatformClient } from '../../../node_modules/.prisma/platform-client';
import { PrismaClient as TenantClient } from '../../../node_modules/.prisma/tenant-client';
import * as bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

async function main() {
    console.log('Seeding databases...\n');

    // ── 1. Seed Platform Database ──────────────────────────────────────
    const platformDb = new PlatformClient({
        datasources: {
            db: { url: process.env.PLATFORM_DATABASE_URL },
        },
    });

    // Create subscription plans
    const freePlan = await platformDb.subscriptionPlan.upsert({
        where: { name: 'Free' },
        update: {},
        create: {
            name: 'Free',
            maxUsers: 5,
            maxProjects: 2,
            maxStorageGb: 1,
            priceMonthly: 0,
        },
    });

    const proPlan = await platformDb.subscriptionPlan.upsert({
        where: { name: 'Professional' },
        update: {},
        create: {
            name: 'Professional',
            maxUsers: 50,
            maxProjects: 20,
            maxStorageGb: 50,
            priceMonthly: 99.99,
        },
    });

    console.log('Subscription plans created:', freePlan.name, proPlan.name);

    // Create Super Admin
    const adminPassword = await bcrypt.hash('SuperAdmin@2026', SALT_ROUNDS);
    const superAdmin = await platformDb.platformAdmin.upsert({
        where: { email: 'admin@fieldops360.com' },
        update: {},
        create: {
            email: 'admin@fieldops360.com',
            passwordHash: adminPassword,
            firstName: 'Super',
            lastName: 'Admin',
            role: 'SUPER_ADMIN',
        },
    });
    console.log('Super Admin created:', superAdmin.email);

    // Create demo tenant
    const demoTenant = await platformDb.tenant.upsert({
        where: { subdomain: 'demo' },
        update: {},
        create: {
            name: 'Demo Company',
            subdomain: 'demo',
            dbName: 'fieldops_tenant_demo',
            dbHost: process.env.DB_HOST || 'localhost',
            dbPort: parseInt(process.env.DB_PORT || '5432'),
            sector: 'BTP',
            plan: 'Professional',
        },
    });
    console.log('Demo tenant created:', demoTenant.subdomain);

    await platformDb.$disconnect();

    // ── 2. Seed Demo Tenant Database ───────────────────────────────────
    const tenantDb = new TenantClient({
        datasources: {
            db: {
                url: process.env.TENANT_DATABASE_URL ||
                    `postgresql://postgres:${process.env.DB_PASSWORD || 'password'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/fieldops_tenant_demo`,
            },
        },
    });

    // Create test Manager
    const managerPassword = await bcrypt.hash('Manager@2026', SALT_ROUNDS);
    const manager = await tenantDb.user.upsert({
        where: { email: 'manager@demo.com' },
        update: {},
        create: {
            email: 'manager@demo.com',
            passwordHash: managerPassword,
            firstName: 'Ahmed',
            lastName: 'Manager',
            role: 'MANAGER',
            position: 'Chef de Projet Senior',
            phone: '+1555000001',
        },
    });
    console.log('Test Manager created:', manager.email);

    // Create test Project Manager
    const pmPassword = await bcrypt.hash('PM@2026Pass', SALT_ROUNDS);
    const pm = await tenantDb.user.upsert({
        where: { email: 'pm@demo.com' },
        update: {},
        create: {
            email: 'pm@demo.com',
            passwordHash: pmPassword,
            firstName: 'Karim',
            lastName: 'ProjectManager',
            role: 'PROJECT_MANAGER',
            position: 'Chef de Projet',
            phone: '+1555000002',
        },
    });
    console.log('Test Project Manager created:', pm.email);

    // Create test Team Member
    const tmPassword = await bcrypt.hash('TeamMbr@2026', SALT_ROUNDS);
    const teamMember = await tenantDb.user.upsert({
        where: { email: 'worker@demo.com' },
        update: {},
        create: {
            email: 'worker@demo.com',
            passwordHash: tmPassword,
            firstName: 'Hassan',
            lastName: 'Worker',
            role: 'TEAM_MEMBER',
            position: 'Electricien',
            skills: ['Electricite', 'Cablage', 'Installation'],
            phone: '+1555000003',
        },
    });
    console.log('Test Team Member created:', teamMember.email);

    await tenantDb.$disconnect();

    console.log('\nSeeding complete. Test credentials:');
    console.log('  Super Admin: admin@fieldops360.com / SuperAdmin@2026');
    console.log('  Manager:     manager@demo.com / Manager@2026');
    console.log('  PM:          pm@demo.com / PM@2026Pass');
    console.log('  Worker:      worker@demo.com / TeamMbr@2026');
}

main().catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
});
