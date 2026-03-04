import { Test, TestingModule } from '@nestjs/testing';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { TenantRequest } from '../common/middleware/tenant.middleware';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

describe('ProfileController', () => {
    let controller: ProfileController;
    let profileService: ProfileService;

    const mockProfileService = {
        getProfile: jest.fn(),
        updateProfile: jest.fn(),
        changePassword: jest.fn(),
        uploadAvatar: jest.fn(),
    };

    const mockReq = {} as TenantRequest;
    const mockUser = { sub: 'u1' } as JwtPayload;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [ProfileController],
            providers: [
                {
                    provide: ProfileService,
                    useValue: mockProfileService,
                },
            ],
        }).compile();

        controller = module.get<ProfileController>(ProfileController);
        profileService = module.get<ProfileService>(ProfileService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    it('should getProfile', async () => {
        mockProfileService.getProfile.mockResolvedValue({ id: 'u1' });
        await controller.getProfile(mockReq, mockUser);
        expect(profileService.getProfile).toHaveBeenCalledWith(mockReq, 'u1');
    });

    it('should updateProfile', async () => {
        const dto: any = { first_name: 'test' };
        mockProfileService.updateProfile.mockResolvedValue({ id: 'u1' });
        await controller.updateProfile(mockReq, mockUser, dto);
        expect(profileService.updateProfile).toHaveBeenCalledWith(mockReq, 'u1', dto);
    });

    it('should changePassword', async () => {
        const dto: any = { current_password: 'p', new_password: 'n', new_password_confirmation: 'n' };
        mockProfileService.changePassword.mockResolvedValue({ message: 'changed' });
        await controller.changePassword(mockReq, mockUser, dto);
        expect(profileService.changePassword).toHaveBeenCalledWith(mockReq, 'u1', dto);
    });

    it('should uploadAvatar', async () => {
        const file = {} as Express.Multer.File;
        mockProfileService.uploadAvatar.mockResolvedValue({ avatar_url: 'url' });
        await controller.uploadAvatar(mockReq, mockUser, file);
        expect(profileService.uploadAvatar).toHaveBeenCalledWith(mockReq, 'u1', file);
    });
});
