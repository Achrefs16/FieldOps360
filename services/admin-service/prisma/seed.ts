// Seed script for the platform database
// Creates default plans and a Super Admin account

import { PrismaClient } from '.prisma/platform';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding platform database...');

    // --- Create Plans ---
    const starter = await prisma.plan.upsert({
        where: { name: 'Starter' },
        update: {},
        create: {
            name: 'Starter',
            maxUsers: 5,
            maxProjects: 3,
            storageGb: 5,
            hasGps: false,
            price: 9900,
        },
    });

    const professional = await prisma.plan.upsert({
        where: { name: 'Professional' },
        update: {},
        create: {
            name: 'Professional',
            maxUsers: 25,
            maxProjects: 15,
            storageGb: 25,
            hasGps: true,
            price: 29900,
        },
    });

    const enterprise = await prisma.plan.upsert({
        where: { name: 'Enterprise' },
        update: {},
        create: {
            name: 'Enterprise',
            maxUsers: 999,
            maxProjects: 999,
            storageGb: 500,
            hasGps: true,
            price: 99900,
        },
    });

    console.log('✅ Plans created:', starter.name, professional.name, enterprise.name);

    // --- Create Super Admin ---
    const hashedPassword = await bcrypt.hash('SuperAdmin2026!', 10);

    const admin = await prisma.platformAdmin.upsert({
        where: { email: 'admin@fieldops360.com' },
        update: {},
        create: {
            email: 'admin@fieldops360.com',
            password: hashedPassword,
            firstName: 'Admin',
            lastName: 'FieldOps360',
        },
    });

    console.log('✅ Super Admin created:', admin.email);

    // --- Create Sample Tenants ---
    const sampleTenants = [
        { name: 'ACME Construction', subdomain: 'acme', sector: 'BTP', planId: professional.id, contactName: 'Ahmed Bensalem', contactEmail: 'ahmed@acme-btp.com', usersCount: 32, storageUsed: 3.2 },
        { name: 'Delta Electrique', subdomain: 'delta', sector: 'ELECTRICAL', planId: starter.id, contactName: 'Fatima Zahra', contactEmail: 'fatima@delta-elec.com', usersCount: 5, storageUsed: 0.8 },
        { name: 'Omega TP', subdomain: 'omega', sector: 'PUBLIC_WORKS', planId: enterprise.id, contactName: 'Karim Directeur', contactEmail: 'karim@omega-tp.com', usersCount: 89, storageUsed: 12.5 },
        { name: 'BatiPlus SARL', subdomain: 'batiplus', sector: 'BTP', planId: professional.id, contactName: 'Nadia Chefik', contactEmail: 'nadia@batiplus.com', usersCount: 18, storageUsed: 5.1 },
        { name: 'SolairTech', subdomain: 'solairtech', sector: 'ELECTRICAL', planId: professional.id, contactName: 'Youcef Hamdi', contactEmail: 'youcef@solairtech.com', usersCount: 12, storageUsed: 2.3 },
    ];

    for (const t of sampleTenants) {
        await prisma.tenant.upsert({
            where: { subdomain: t.subdomain },
            update: {},
            create: {
                ...t,
                dbName: `fieldops_tenant_${t.subdomain}`,
                storageUsed: t.storageUsed,
            },
        });
    }

    console.log('✅ Sample tenants created:', sampleTenants.length);
    console.log('🎉 Seeding complete!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
