import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, ForbiddenException, HttpException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import { AuthService } from './auth.service';
import { TenantRequest } from '../common/middleware/tenant.middleware';

// Mock dependencies
jest.mock('bcryptjs');
jest.mock('crypto');
jest.mock('nodemailer');

describe('AuthService', () => {
    let authService: AuthService;
    let jwtService: JwtService;

    // Mock Request Object
    const mockTenantDbUser = {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
    };

    const mockReq = {
        tenantId: 'platform-tenant-id',
        tenantSubdomain: 'demo',
        tenantDb: {
            user: mockTenantDbUser,
        },
    } as unknown as TenantRequest;

    // Global Mocks
    const mockJwtService = {
        sign: jest.fn().mockReturnValue('mock-jwt-token'),
    };

    const mockTransporter = {
        sendMail: jest.fn().mockResolvedValue(true),
    };

    beforeAll(() => {
        (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);
        (crypto.randomBytes as jest.Mock).mockReturnValue({
            toString: () => 'random-bytes-token',
        });
    });

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                {
                    provide: JwtService,
                    useValue: mockJwtService,
                },
            ],
        }).compile();

        authService = module.get<AuthService>(AuthService);
        jwtService = module.get<JwtService>(JwtService);

        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(authService).toBeDefined();
    });

    describe('login', () => {
        const loginDto = { email: 'test@demo.com', password: 'Password@123' };

        it('should throw UnauthorizedException if user is not found', async () => {
            mockTenantDbUser.findUnique.mockResolvedValue(null);

            await expect(authService.login(mockReq, loginDto)).rejects.toThrow(UnauthorizedException);
        });

        it('should throw ForbiddenException if user is inactive', async () => {
            mockTenantDbUser.findUnique.mockResolvedValue({ active: false });

            await expect(authService.login(mockReq, loginDto)).rejects.toThrow(ForbiddenException);
        });

        it('should throw HttpException(LOCKED) if account is locked', async () => {
            mockTenantDbUser.findUnique.mockResolvedValue({
                active: true,
                lockedUntil: new Date(Date.now() + 10000), // Locked in the future
            });

            await expect(authService.login(mockReq, loginDto)).rejects.toThrow(HttpException);
        });

        it('should lock account after max failed attempts', async () => {
            const mockUser = {
                id: 'u1',
                active: true,
                failedLoginAttempts: 4, // 5th attempt will lock
                passwordHash: 'hashed-pw',
            };
            mockTenantDbUser.findUnique.mockResolvedValue(mockUser);
            (bcrypt.compare as jest.Mock).mockResolvedValue(false);

            await expect(authService.login(mockReq, loginDto)).rejects.toThrow(UnauthorizedException);
            expect(mockTenantDbUser.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        failedLoginAttempts: 5,
                        lockedUntil: expect.any(Date),
                    }),
                })
            );
        });

        it('should login successfully and return tokens', async () => {
            const mockUser = {
                id: 'u1',
                email: 'test@demo.com',
                firstName: 'John',
                lastName: 'Doe',
                role: 'MANAGER',
                active: true,
                failedLoginAttempts: 0,
                passwordHash: 'hashed-pw',
                avatarUrl: null,
            };
            mockTenantDbUser.findUnique.mockResolvedValue(mockUser);
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);
            (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-refresh-token');

            const result = await authService.login(mockReq, loginDto);

            expect(result).toHaveProperty('access_token', 'mock-jwt-token');
            expect(result).toHaveProperty('refresh_token', 'random-bytes-token');
            expect(result.user).toHaveProperty('email', 'test@demo.com');
            expect(mockTenantDbUser.update).toHaveBeenCalled();
        });
    });

    describe('refresh', () => {
        it('should throw Unauthorized if no matching token is found', async () => {
            mockTenantDbUser.findMany.mockResolvedValue([]);
            await expect(authService.refresh(mockReq, 'old-token')).rejects.toThrow(UnauthorizedException);
        });

        it('should rotate token and return new credentials on success', async () => {
            const mockUser = { id: 'u1', email: 'test@demo.com', role: 'MANAGER', refreshToken: 'hashed-old-token' };
            mockTenantDbUser.findMany.mockResolvedValue([mockUser]);
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);
            (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-new-token');

            const result = await authService.refresh(mockReq, 'old-token');

            expect(result).toHaveProperty('access_token', 'mock-jwt-token');
            expect(result).toHaveProperty('refresh_token', 'random-bytes-token');
            expect(mockTenantDbUser.update).toHaveBeenCalledWith(
                expect.objectContaining({ data: { refreshToken: 'hashed-new-token' } })
            );
        });
    });

    describe('forgotPassword', () => {
        it('should send an email and return success even if user not found', async () => {
            mockTenantDbUser.findUnique.mockResolvedValue(null);

            const result = await authService.forgotPassword(mockReq, { email: 'nobody@demo.com' });
            expect(result.message).toBe('Email de reinitialisation envoye');
            expect(mockTransporter.sendMail).not.toHaveBeenCalled();
        });

        it('should generate token, update user, and send email', async () => {
            const mockUser = { id: 'u1', email: 'test@demo.com', firstName: 'John' };
            mockTenantDbUser.findUnique.mockResolvedValue(mockUser);
            (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-reset-token');

            const result = await authService.forgotPassword(mockReq, { email: 'test@demo.com' });

            expect(result.message).toBe('Email de reinitialisation envoye');
            expect(mockTenantDbUser.update).toHaveBeenCalled();
            expect(mockTransporter.sendMail).toHaveBeenCalled();
        });
    });

    describe('resetPassword', () => {
        it('should throw BadRequestException if passwords do not match', async () => {
            const dto = { token: 'reset-token', new_password: 'Pass1', new_password_confirmation: 'Pass2' };
            await expect(authService.resetPassword(mockReq, dto)).rejects.toThrow(BadRequestException);
        });

        it('should throw BadRequestException if token is invalid or expired', async () => {
            const dto = { token: 'invalid-token', new_password: 'Pass1', new_password_confirmation: 'Pass1' };
            mockTenantDbUser.findMany.mockResolvedValue([]); // No users with active valid token

            await expect(authService.resetPassword(mockReq, dto)).rejects.toThrow(BadRequestException);
        });

        it('should reset password on valid token', async () => {
            const dto = { token: 'valid-token', new_password: 'NewPassword@123', new_password_confirmation: 'NewPassword@123' };
            const mockUser = { id: 'u1', resetToken: 'hashed-valid-token' };

            mockTenantDbUser.findMany.mockResolvedValue([mockUser]);
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);
            (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-pw');

            const result = await authService.resetPassword(mockReq, dto);

            expect(result.message).toBe('Mot de passe reinitialise avec succes');
            expect(mockTenantDbUser.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        passwordHash: 'new-hashed-pw',
                        resetToken: null,
                        resetTokenExpiry: null,
                        failedLoginAttempts: 0,
                        lockedUntil: null,
                    })
                })
            );
        });
    });
});
