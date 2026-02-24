import { Injectable } from '@nestjs/common';
import { PrismaClient } from '../../node_modules/.prisma/tenant-client';

@Injectable()
export class TenantDatabaseService {
    private clients: Map<string, PrismaClient> = new Map();

    /**
     * Get or create a PrismaClient for a specific tenant database.
     * Connections are cached to avoid reconnecting on every request.
     */
    getClient(dbName: string, dbHost: string, dbPort: number): PrismaClient {
        const key = `${dbHost}:${dbPort}/${dbName}`;

        if (this.clients.has(key)) {
            return this.clients.get(key)!;
        }

        const password = process.env.DB_PASSWORD || '';
        const dbUser = process.env.DB_USER || 'postgres';

        const client = new PrismaClient({
            datasources: {
                db: {
                    url: `postgresql://${dbUser}:${password}@${dbHost}:${dbPort}/${dbName}?schema=public`,
                },
            },
        });

        this.clients.set(key, client);
        return client;
    }

    /**
     * Disconnect all cached tenant connections (on shutdown).
     */
    async disconnectAll(): Promise<void> {
        for (const [, client] of this.clients) {
            await client.$disconnect();
        }
        this.clients.clear();
    }
}
