import {
    Injectable,
    NotFoundException,
    UnauthorizedException,
    BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as Minio from 'minio';
import { v4 as uuidv4 } from 'uuid';
import { TenantRequest } from '../common/middleware/tenant.middleware';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

const SALT_ROUNDS = 10;
const AVATAR_BUCKET = process.env.MINIO_BUCKET || 'avatars';
const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2MB

@Injectable()
export class ProfileService {
    private minioClient: Minio.Client;

    constructor() {
        this.minioClient = new Minio.Client({
            endPoint: process.env.MINIO_ENDPOINT || 'localhost',
            port: parseInt(process.env.MINIO_PORT || '9000'),
            useSSL: process.env.MINIO_USE_SSL === 'true',
            accessKey: process.env.MINIO_ACCESS_KEY || '',
            secretKey: process.env.MINIO_SECRET_KEY || '',
        });
    }

    /**
     * Get the profile of the currently authenticated user.
     */
    async getProfile(req: TenantRequest, userId: string) {
        const user = await req.tenantDb.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        return this.formatProfile(user);
    }

    /**
     * Update the profile of the currently authenticated user.
     */
    async updateProfile(
        req: TenantRequest,
        userId: string,
        dto: UpdateProfileDto,
    ) {
        const user = await req.tenantDb.user.update({
            where: { id: userId },
            data: {
                ...(dto.first_name && { firstName: dto.first_name }),
                ...(dto.last_name && { lastName: dto.last_name }),
                ...(dto.phone !== undefined && { phone: dto.phone }),
                ...(dto.language && { language: dto.language }),
                ...(dto.timezone && { timezone: dto.timezone }),
            },
        });

        return this.formatProfile(user);
    }

    /**
     * Change the password of the currently authenticated user.
     */
    async changePassword(
        req: TenantRequest,
        userId: string,
        dto: ChangePasswordDto,
    ) {
        if (dto.new_password !== dto.new_password_confirmation) {
            throw new BadRequestException({
                code: 'VALIDATION_ERROR',
                message: 'Les mots de passe ne correspondent pas',
            });
        }

        const user = await req.tenantDb.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        const isValid = await bcrypt.compare(dto.current_password, user.passwordHash);
        if (!isValid) {
            throw new UnauthorizedException({
                code: 'INVALID_PASSWORD',
                message: 'Mot de passe actuel incorrect',
            });
        }

        await req.tenantDb.user.update({
            where: { id: userId },
            data: {
                passwordHash: await bcrypt.hash(dto.new_password, SALT_ROUNDS),
                firstLogin: false,
            },
        });

        return { message: 'Mot de passe modifie avec succes' };
    }

    /**
     * Upload avatar image to MinIO.
     */
    async uploadAvatar(
        req: TenantRequest,
        userId: string,
        file: Express.Multer.File,
    ) {
        if (!file) {
            throw new BadRequestException('No file uploaded');
        }

        if (file.size > MAX_AVATAR_SIZE) {
            throw new BadRequestException('File too large. Maximum 2MB');
        }

        const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedMimes.includes(file.mimetype)) {
            throw new BadRequestException('Only JPEG, PNG, and WebP images are allowed');
        }

        // Ensure bucket exists
        const bucketExists = await this.minioClient.bucketExists(AVATAR_BUCKET);
        if (!bucketExists) {
            await this.minioClient.makeBucket(AVATAR_BUCKET);
        }

        // Generate unique filename
        const ext = file.originalname.split('.').pop();
        const objectName = `${req.tenantSubdomain}/${userId}/${uuidv4()}.${ext}`;

        // Upload to MinIO
        await this.minioClient.putObject(
            AVATAR_BUCKET,
            objectName,
            file.buffer,
            file.size,
            { 'Content-Type': file.mimetype },
        );

        // Build the avatar URL
        const avatarUrl = `http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}/${AVATAR_BUCKET}/${objectName}`;

        // Update user record
        await req.tenantDb.user.update({
            where: { id: userId },
            data: { avatarUrl },
        });

        return { avatar_url: avatarUrl };
    }

    private formatProfile(user: any) {
        return {
            id: user.id,
            email: user.email,
            first_name: user.firstName,
            last_name: user.lastName,
            role: user.role,
            phone: user.phone,
            position: user.position,
            skills: user.skills || [],
            avatar_url: user.avatarUrl,
            language: user.language,
            timezone: user.timezone,
            active: user.active,
            first_login: user.firstLogin,
            last_login_at: user.lastLoginAt,
            created_at: user.createdAt,
        };
    }
}
