import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { TenantRequest } from '../common/middleware/tenant.middleware';
import { PaginationDto } from '../common/dto/pagination.dto';

describe('UsersController', () => {
    let controller: UsersController;
    let usersService: UsersService;

    const mockUsersService = {
        findAll: jest.fn(),
        create: jest.fn(),
        findOne: jest.fn(),
        update: jest.fn(),
        updateStatus: jest.fn(),
    };

    const mockReq = {} as TenantRequest;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [UsersController],
            providers: [
                {
                    provide: UsersService,
                    useValue: mockUsersService,
                },
            ],
        }).compile();

        controller = module.get<UsersController>(UsersController);
        usersService = module.get<UsersService>(UsersService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    it('should findAll', async () => {
        const pagination: PaginationDto = { page: 1, limit: 10 };
        mockUsersService.findAll.mockResolvedValue({ data: [], meta: {} });
        await controller.findAll(mockReq, pagination, 'MANAGER', 'true', 'search');
        expect(usersService.findAll).toHaveBeenCalledWith(mockReq, pagination, { role: 'MANAGER', active: 'true', search: 'search' });
    });

    it('should create', async () => {
        const dto: any = { email: 'test@demo.com' };
        mockUsersService.create.mockResolvedValue({ id: '1' });
        const result = await controller.create(mockReq, dto);
        expect(usersService.create).toHaveBeenCalledWith(mockReq, dto);
        expect(result).toEqual({ id: '1' });
    });

    it('should findOne', async () => {
        mockUsersService.findOne.mockResolvedValue({ id: '1' });
        await controller.findOne(mockReq, '1');
        expect(usersService.findOne).toHaveBeenCalledWith(mockReq, '1');
    });

    it('should update', async () => {
        const dto: any = { first_name: 'test' };
        mockUsersService.update.mockResolvedValue({ id: '1' });
        await controller.update(mockReq, '1', dto);
        expect(usersService.update).toHaveBeenCalledWith(mockReq, '1', dto);
    });

    it('should updateStatus', async () => {
        mockUsersService.updateStatus.mockResolvedValue({ id: '1', active: false });
        await controller.updateStatus(mockReq, '1', false);
        expect(usersService.updateStatus).toHaveBeenCalledWith(mockReq, '1', false);
    });
});
