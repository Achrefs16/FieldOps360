import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TenantRequest } from '../common/middleware/tenant.middleware';
import { JwtPayload } from './strategies/jwt.strategy';

describe('AuthController', () => {
    let controller: AuthController;
    let authService: AuthService;

    const mockAuthService = {
        login: jest.fn(),
        refresh: jest.fn(),
        logout: jest.fn(),
        forgotPassword: jest.fn(),
        resetPassword: jest.fn(),
    };

    const mockReq = {} as TenantRequest;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [AuthController],
            providers: [
                {
                    provide: AuthService,
                    useValue: mockAuthService,
                },
            ],
        }).compile();

        controller = module.get<AuthController>(AuthController);
        authService = module.get<AuthService>(AuthService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    it('should login', async () => {
        const dto = { email: 'test@demo.com', password: 'Password@123' };
        mockAuthService.login.mockResolvedValue({ access_token: 'ac' });
        const result = await controller.login(mockReq, dto);
        expect(result).toEqual({ access_token: 'ac' });
        expect(authService.login).toHaveBeenCalledWith(mockReq, dto);
    });

    it('should refresh', async () => {
        const dto = { refresh_token: 'rf' };
        mockAuthService.refresh.mockResolvedValue({ access_token: 'ac' });
        const result = await controller.refresh(mockReq, dto);
        expect(result).toEqual({ access_token: 'ac' });
        expect(authService.refresh).toHaveBeenCalledWith(mockReq, 'rf');
    });

    it('should logout', async () => {
        const user = { sub: 'u1' } as JwtPayload;
        await controller.logout(mockReq, user);
        expect(authService.logout).toHaveBeenCalledWith(mockReq, 'u1');
    });

    it('should forgot password', async () => {
        const dto = { email: 'test@demo.com' };
        mockAuthService.forgotPassword.mockResolvedValue({ message: 'sent' });
        await controller.forgotPassword(mockReq, dto);
        expect(authService.forgotPassword).toHaveBeenCalledWith(mockReq, dto);
    });

    it('should reset password', async () => {
        const dto = { token: 't', new_password: 'p1', new_password_confirmation: 'p1' };
        mockAuthService.resetPassword.mockResolvedValue({ message: 'reset' });
        await controller.resetPassword(mockReq, dto);
        expect(authService.resetPassword).toHaveBeenCalledWith(mockReq, dto);
    });
});
