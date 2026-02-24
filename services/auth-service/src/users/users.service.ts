import {
    Injectable,
    ConflictException,
    NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { TenantRequest } from '../common/middleware/tenant.middleware';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

const SALT_ROUNDS = 10;

@Injectable()
export class UsersService {
    /**
     * List all users for the current tenant with pagination and filtering.
     */
    async findAll(
        req: TenantRequest,
        pagination: PaginationDto,
        filters: { role?: string; active?: string; search?: string },
    ) {
        const { page = 1, limit = 20, sort = 'created_at', order = 'desc' } = pagination;
        const skip = (page - 1) * limit;

        // Build where clause
        const where: any = {};
        if (filters.role) where.role = filters.role;
        if (filters.active !== undefined) where.active = filters.active === 'true';
        if (filters.search) {
            where.OR = [
                { firstName: { contains: filters.search, mode: 'insensitive' } },
                { lastName: { contains: filters.search, mode: 'insensitive' } },
                { email: { contains: filters.search, mode: 'insensitive' } },
            ];
        }

        // Map sort fields from API convention to Prisma
        const sortFieldMap: Record<string, string> = {
            created_at: 'createdAt',
            last_login_at: 'lastLoginAt',
            first_name: 'firstName',
            last_name: 'lastName',
        };
        const sortField = sortFieldMap[sort] || 'createdAt';

        const [users, total] = await Promise.all([
            req.tenantDb.user.findMany({
                where,
                skip,
                take: limit,
                orderBy: { [sortField]: order },
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    phone: true,
                    position: true,
                    active: true,
                    lastLoginAt: true,
                    createdAt: true,
                },
            }),
            req.tenantDb.user.count({ where }),
        ]);

        return {
            data: users.map(this.formatUser),
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Create a new user in the tenant's database.
     */
    async create(req: TenantRequest, dto: CreateUserDto) {
        // Check for duplicate email
        const existing = await req.tenantDb.user.findUnique({
            where: { email: dto.email },
        });
        if (existing) {
            throw new ConflictException({
                code: 'DUPLICATE_EMAIL',
                message: `L'email ${dto.email} est deja utilise`,
            });
        }

        const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

        const user = await req.tenantDb.user.create({
            data: {
                email: dto.email,
                passwordHash,
                firstName: dto.first_name,
                lastName: dto.last_name,
                role: dto.role,
                phone: dto.phone,
                position: dto.position,
                skills: dto.skills || [],
            },
        });

        return {
            id: user.id,
            email: user.email,
            first_name: user.firstName,
            last_name: user.lastName,
            role: user.role,
            active: user.active,
            first_login: user.firstLogin,
        };
    }

    /**
     * Get a user by ID.
     */
    async findOne(req: TenantRequest, id: string) {
        const user = await req.tenantDb.user.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                phone: true,
                position: true,
                skills: true,
                avatarUrl: true,
                language: true,
                timezone: true,
                active: true,
                firstLogin: true,
                lastLoginAt: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        if (!user) {
            throw new NotFoundException({
                code: 'USER_NOT_FOUND',
                message: `Utilisateur ${id} introuvable`,
            });
        }

        return this.formatUser(user);
    }

    /**
     * Update a user by ID.
     */
    async update(req: TenantRequest, id: string, dto: UpdateUserDto) {
        await this.findOne(req, id); // Ensure exists

        // Check for email conflict
        if (dto.email) {
            const existing = await req.tenantDb.user.findFirst({
                where: { email: dto.email, id: { not: id } },
            });
            if (existing) {
                throw new ConflictException({
                    code: 'DUPLICATE_EMAIL',
                    message: `L'email ${dto.email} est deja utilise`,
                });
            }
        }

        const user = await req.tenantDb.user.update({
            where: { id },
            data: {
                ...(dto.email && { email: dto.email }),
                ...(dto.first_name && { firstName: dto.first_name }),
                ...(dto.last_name && { lastName: dto.last_name }),
                ...(dto.role && { role: dto.role }),
                ...(dto.phone !== undefined && { phone: dto.phone }),
                ...(dto.position !== undefined && { position: dto.position }),
                ...(dto.skills && { skills: dto.skills }),
            },
        });

        return this.formatUser(user);
    }

    /**
     * Activate or deactivate a user.
     */
    async updateStatus(req: TenantRequest, id: string, active: boolean) {
        await this.findOne(req, id); // Ensure exists

        const user = await req.tenantDb.user.update({
            where: { id },
            data: { active },
        });

        return this.formatUser(user);
    }

    /**
     * Format user entity for API response (snake_case).
     */
    private formatUser(user: any) {
        return {
            id: user.id,
            email: user.email,
            first_name: user.firstName,
            last_name: user.lastName,
            role: user.role,
            phone: user.phone || null,
            position: user.position || null,
            skills: user.skills || [],
            avatar_url: user.avatarUrl || null,
            language: user.language || 'fr',
            timezone: user.timezone || 'UTC',
            active: user.active,
            first_login: user.firstLogin,
            last_login_at: user.lastLoginAt || null,
            created_at: user.createdAt,
            updated_at: user.updatedAt || null,
        };
    }
}
