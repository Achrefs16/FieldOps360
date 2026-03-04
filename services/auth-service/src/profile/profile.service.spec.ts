import { Test, TestingModule } from '@nestjs/testing';
import { ProfileService } from './profile.service';
import { TenantRequest } from '../common/middleware/tenant.middleware';
import { NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

jest.mock('bcryptjs');

// Mock minio before importing module
jest.mock('minio', () => ({
    Client: jest.fn().mockImplementation(() => ({
        bucketExists: jest.fn().mockResolvedValue(true),
        makeBucket: jest.fn().mockResolvedValue(true),
        putObject: jest.fn().mockResolvedValue(true),
    })),
}));

describe('ProfileService', () => {
    let service: ProfileService;

    const mockTenantDbUser = {
        findUnique: jest.fn(),
        update: jest.fn(),
    };

    const mockReq = {
        tenantSubdomain: 'demo',
        tenantDb: {
            user: mockTenantDbUser,
        },
    } as unknown as TenantRequest;

    const dummyUser = {
        id: 'u1',
        email: 'test@demo.com',
        firstName: 'John',
        lastName: 'Doe',
        passwordHash: 'hashed-pw',
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [ProfileService],
        }).compile();

        service = module.get<ProfileService>(ProfileService);
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('getProfile', () => {
        it('should throw NotFoundException if user not found', async () => {
            mockTenantDbUser.findUnique.mockResolvedValue(null);
            await expect(service.getProfile(mockReq, 'invalid-id')).rejects.toThrow(NotFoundException);
        });

        it('should format profile if user found', async () => {
            mockTenantDbUser.findUnique.mockResolvedValue(dummyUser);
            const res = await service.getProfile(mockReq, 'u1');
            expect(res).toHaveProperty('id', 'u1');
            expect(res).toHaveProperty('first_name', 'John');
        });
    });

    describe('updateProfile', () => {
        it('should update user fields', async () => {
            mockTenantDbUser.update.mockResolvedValue({ ...dummyUser, firstName: 'Jane' });
            const res = await service.updateProfile(mockReq, 'u1', { first_name: 'Jane' });
            expect(mockTenantDbUser.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'u1' },
                    data: expect.objectContaining({ firstName: 'Jane' }),
                })
            );
            expect(res).toHaveProperty('first_name', 'Jane');
        });
    });

    describe('changePassword', () => {
        it('should throw BadRequestException if passwords do not match', async () => {
            await expect(
                service.changePassword(mockReq, 'u1', {
                    current_password: 'pw',
                    new_password: 'pw1',
                    new_password_confirmation: 'pw2',
                })
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw NotFoundException if user not found', async () => {
            mockTenantDbUser.findUnique.mockResolvedValue(null);
            await expect(
                service.changePassword(mockReq, 'u1', {
                    current_password: 'pw',
                    new_password: 'pw1',
                    new_password_confirmation: 'pw1',
                })
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw UnauthorizedException if current password is wrong', async () => {
            mockTenantDbUser.findUnique.mockResolvedValue(dummyUser);
            (bcrypt.compare as jest.Mock).mockResolvedValue(false);
            await expect(
                service.changePassword(mockReq, 'u1', {
                    current_password: 'wrong',
                    new_password: 'pw1',
                    new_password_confirmation: 'pw1',
                })
            ).rejects.toThrow(UnauthorizedException);
        });

        it('should change password on success', async () => {
            mockTenantDbUser.findUnique.mockResolvedValue(dummyUser);
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);
            (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-new');
            const res = await service.changePassword(mockReq, 'u1', {
                current_password: 'pw',
                new_password: 'pw1',
                new_password_confirmation: 'pw1',
            });
            expect(res.message).toEqual('Mot de passe modifie avec succes');
            expect(mockTenantDbUser.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: { passwordHash: 'hashed-new', firstLogin: false },
                })
            );
        });
    });

    describe('uploadAvatar', () => {
        it('should throw BadRequestException if file is larger than 2MB', async () => {
            const file = { size: 3 * 1024 * 1024 } as Express.Multer.File;
            await expect(service.uploadAvatar(mockReq, 'u1', file)).rejects.toThrow(BadRequestException);
        });

        it('should upload success', async () => {
            const file = { size: 1024, mimetype: 'image/jpeg', originalname: 'test.jpg' } as Express.Multer.File;
            const res = await service.uploadAvatar(mockReq, 'u1', file);
            expect(res).toHaveProperty('avatar_url');
        });
    });
});
