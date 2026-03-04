import { Test, TestingModule } from '@nestjs/testing';
import { TenantDatabaseService } from './tenant.service';
import { PrismaClient } from '../../node_modules/.prisma/tenant-client';

describe('TenantDatabaseService', () => {
    let service: TenantDatabaseService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [TenantDatabaseService],
        }).compile();

        service = module.get<TenantDatabaseService>(TenantDatabaseService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should return same client instance for the same key', () => {
        const client1 = service.getClient('db1', 'host', 5432);
        const client2 = service.getClient('db1', 'host', 5432);
        expect(client1).toBe(client2);
    });

    it('should disconnect all clients and clear map', async () => {
        const client1 = service.getClient('db1', 'host', 5432);
        jest.spyOn(client1, '$disconnect').mockResolvedValue(undefined);

        await service.disconnectAll();

        expect(client1.$disconnect).toHaveBeenCalled();
        const clientAfter = service.getClient('db1', 'host', 5432);
        expect(clientAfter).not.toBe(client1);
    });
});
