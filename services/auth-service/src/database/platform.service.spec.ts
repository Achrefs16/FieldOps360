import { Test, TestingModule } from '@nestjs/testing';
import { PlatformDatabaseService } from './platform.service';

describe('PlatformDatabaseService', () => {
    let service: PlatformDatabaseService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [PlatformDatabaseService],
        }).compile();

        service = module.get<PlatformDatabaseService>(PlatformDatabaseService);
        // Mock the PrismaClient methods to prevent real connection
        jest.spyOn(service, '$connect').mockResolvedValue(undefined);
        jest.spyOn(service, '$disconnect').mockResolvedValue(undefined);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should connect on module init', async () => {
        await service.onModuleInit();
        expect(service.$connect).toHaveBeenCalled();
    });

    it('should disconnect on module destroy', async () => {
        await service.onModuleDestroy();
        expect(service.$disconnect).toHaveBeenCalled();
    });
});
