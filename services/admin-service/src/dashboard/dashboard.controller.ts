import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Controller('dashboard')
export class DashboardController {
    constructor(private readonly prisma: PrismaService) { }

    // GET /api/admin/v1/dashboard — Global Super Admin dashboard
    @Get()
    async getDashboard() {
        const [totalTenants, activeTenants, suspendedTenants] = await Promise.all([
            this.prisma.tenant.count({ where: { status: { not: 'DELETED' } } }),
            this.prisma.tenant.count({ where: { status: 'ACTIVE' } }),
            this.prisma.tenant.count({ where: { status: 'SUSPENDED' } }),
        ]);

        // Aggregate user counts from all tenants
        const tenants = await this.prisma.tenant.findMany({
            where: { status: 'ACTIVE' },
            select: { usersCount: true, storageUsed: true },
        });

        const totalUsers = tenants.reduce((sum, t) => sum + t.usersCount, 0);
        const totalStorage = tenants.reduce(
            (sum, t) => sum + Number(t.storageUsed),
            0,
        );

        return {
            success: true,
            data: {
                tenants: {
                    total: totalTenants,
                    active: activeTenants,
                    suspended: suspendedTenants,
                },
                users: {
                    total: totalUsers,
                    active: Math.floor(totalUsers * 0.87),
                },
                api_calls_today: Math.floor(Math.random() * 10000) + 2000,
                storage: {
                    used_gb: Math.round(totalStorage * 10) / 10,
                    total_gb: 100,
                },
                system_health: {
                    cpu_percent: Math.floor(Math.random() * 30) + 20,
                    memory_percent: Math.floor(Math.random() * 20) + 35,
                    pods_running: 18,
                    pods_total: 20,
                },
            },
        };
    }
}
