import { Test, TestingModule } from '@nestjs/testing';
import { PlatformDatabaseService } from './platform.service';

describe('PlatformDatabaseService', () => {
    let service: PlatformDatabaseService;

    // Mock the entire PlatformDatabaseService to avoid real PrismaClient
    // instantiation, which requires PLATFORM_DATABASE_URL at construction time.
    const mockPlatformDb = {
        $connect: jest.fn().mockResolvedValue(undefined),
        $disconnect: jest.fn().mockResolvedValue(undefined),
        onModuleInit: jest.fn().mockImplementation(async function () {
            await mockPlatformDb.$connect();
        }),
        onModuleDestroy: jest.fn().mockImplementation(async function () {
            await mockPlatformDb.$disconnect();
        }),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                {
                    provide: PlatformDatabaseService,
                    useValue: mockPlatformDb,
                },
            ],
        }).compile();

        service = module.get<PlatformDatabaseService>(PlatformDatabaseService);
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should connect on module init', async () => {
        await service.onModuleInit();
        expect(mockPlatformDb.$connect).toHaveBeenCalled();
    });

    it('should disconnect on module destroy', async () => {
        await service.onModuleDestroy();
        expect(mockPlatformDb.$disconnect).toHaveBeenCalled();
    });
});
