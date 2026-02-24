import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UsersService } from './users.service';
import { TenantRequest } from '../common/middleware/tenant.middleware';

jest.mock('bcryptjs');

describe('UsersService', () => {
    let usersService: UsersService;

    const mockTenantDbUser = {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
    };

    const mockReq = {
        tenantId: 'platform-tenant-id',
        tenantSubdomain: 'demo',
        tenantDb: {
            user: mockTenantDbUser,
        },
    } as unknown as TenantRequest;

    // Reusable dummy user that matches Prisma schema output
    const dummyUser = {
        id: 'u1',
        email: 'test@demo.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'MANAGER',
        phone: '123456789',
        position: 'Developer',
        skills: ['Node.js'],
        avatarUrl: null,
        language: 'fr',
        timezone: 'UTC',
        active: true,
        firstLogin: true,
        lastLoginAt: new Date('2026-01-01T00:00:00Z'),
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [UsersService],
        }).compile();

        usersService = module.get<UsersService>(UsersService);
        jest.clearAllMocks();
    });

    describe('findAll', () => {
        it('should return paginated users and meta data', async () => {
            mockTenantDbUser.findMany.mockResolvedValue([dummyUser]);
            mockTenantDbUser.count.mockResolvedValue(1);

            const result = await usersService.findAll(mockReq, { page: 1, limit: 10 }, { role: 'MANAGER' });

            expect(mockTenantDbUser.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ role: 'MANAGER' }),
                    skip: 0,
                    take: 10,
                }),
            );
            expect(mockTenantDbUser.count).toHaveBeenCalled();
            expect(result.data).toHaveLength(1);
            expect(result.data[0]).toHaveProperty('first_name', 'John');
            expect(result.meta).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
        });

        it('should apply search filters correctly', async () => {
            mockTenantDbUser.findMany.mockResolvedValue([]);
            mockTenantDbUser.count.mockResolvedValue(0);

            await usersService.findAll(mockReq, {}, { search: 'John' });

            expect(mockTenantDbUser.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        OR: [
                            { firstName: { contains: 'John', mode: 'insensitive' } },
                            { lastName: { contains: 'John', mode: 'insensitive' } },
                            { email: { contains: 'John', mode: 'insensitive' } },
                        ],
                    }),
                }),
            );
        });
    });

    describe('create', () => {
        const createDto = {
            email: 'new@demo.com',
            password: 'Password@123',
            first_name: 'Jane',
            last_name: 'Smith',
            role: 'TEAM_MEMBER',
            phone: '987654321',
            position: 'Tester',
            skills: ['QA'],
        };

        it('should throw ConflictException if email exists', async () => {
            mockTenantDbUser.findUnique.mockResolvedValue(dummyUser);

            await expect(usersService.create(mockReq, createDto)).rejects.toThrow(ConflictException);
        });

        it('should hash password and create user', async () => {
            mockTenantDbUser.findUnique.mockResolvedValue(null);
            (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
            mockTenantDbUser.create.mockResolvedValue({
                id: 'u2',
                email: 'new@demo.com',
                firstName: 'Jane',
                lastName: 'Smith',
                role: 'TEAM_MEMBER',
                active: true,
                firstLogin: true,
            });

            const result = await usersService.create(mockReq, createDto);

            expect(bcrypt.hash).toHaveBeenCalledWith('Password@123', 10);
            expect(mockTenantDbUser.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ email: 'new@demo.com', passwordHash: 'hashed-password' }),
                }),
            );
            expect(result).toHaveProperty('id', 'u2');
            expect(result).toHaveProperty('first_name', 'Jane');
        });
    });

    describe('findOne', () => {
        it('should throw NotFoundException if user not found', async () => {
            mockTenantDbUser.findUnique.mockResolvedValue(null);

            await expect(usersService.findOne(mockReq, 'invalid-id')).rejects.toThrow(NotFoundException);
        });

        it('should return formatted user if found', async () => {
            mockTenantDbUser.findUnique.mockResolvedValue(dummyUser);

            const result = await usersService.findOne(mockReq, 'u1');

            expect(mockTenantDbUser.findUnique).toHaveBeenCalledWith({ where: { id: 'u1' }, select: expect.any(Object) });
            expect(result).toHaveProperty('first_name', 'John');
            expect(result).toHaveProperty('timezone', 'UTC');
        });
    });

    describe('update', () => {
        it('should prevent updating email to an existing one', async () => {
            mockTenantDbUser.findUnique.mockResolvedValue(dummyUser); // findOne succeeds
            mockTenantDbUser.findFirst.mockResolvedValue({ id: 'u2', email: 'conflict@demo.com' });

            await expect(usersService.update(mockReq, 'u1', { email: 'conflict@demo.com' })).rejects.toThrow(ConflictException);
        });

        it('should update and return formatted user', async () => {
            mockTenantDbUser.findUnique.mockResolvedValue(dummyUser); // findOne succeeds
            mockTenantDbUser.findFirst.mockResolvedValue(null); // No email conflict
            mockTenantDbUser.update.mockResolvedValue({ ...dummyUser, firstName: 'Johnny' });

            const result = await usersService.update(mockReq, 'u1', { first_name: 'Johnny' });

            expect(mockTenantDbUser.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'u1' },
                    data: expect.objectContaining({ firstName: 'Johnny' }),
                }),
            );
            expect(result).toHaveProperty('first_name', 'Johnny');
        });
    });

    describe('updateStatus', () => {
        it('should update active status', async () => {
            mockTenantDbUser.findUnique.mockResolvedValue(dummyUser); // findOne succeeds
            mockTenantDbUser.update.mockResolvedValue({ ...dummyUser, active: false });

            const result = await usersService.updateStatus(mockReq, 'u1', false);

            expect(mockTenantDbUser.update).toHaveBeenCalledWith({
                where: { id: 'u1' },
                data: { active: false },
            });
            expect(result).toHaveProperty('active', false);
        });
    });
});
