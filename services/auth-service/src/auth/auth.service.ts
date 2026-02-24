import {
    Injectable,
    UnauthorizedException,
    ForbiddenException,
    BadRequestException,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import { TenantRequest } from '../common/middleware/tenant.middleware';
import { JwtPayload } from './strategies/jwt.strategy';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

const SALT_ROUNDS = 10;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes

@Injectable()
export class AuthService {
    private transporter: nodemailer.Transporter;

    constructor(private readonly jwtService: JwtService) {
        // Initialize email transporter (Mailtrap for development)
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'sandbox.smtp.mailtrap.io',
            port: parseInt(process.env.SMTP_PORT || '2525'),
            auth: {
                user: process.env.SMTP_USER || '',
                pass: process.env.SMTP_PASS || '',
            },
        });
    }

    /**
     * Authenticate a user with email and password.
     * Implements: account lockout, bcrypt verification, JWT RS256 token generation.
     */
    async login(req: TenantRequest, dto: LoginDto) {
        const user = await req.tenantDb.user.findUnique({
            where: { email: dto.email },
        });

        if (!user) {
            throw new UnauthorizedException({
                code: 'INVALID_CREDENTIALS',
                message: 'Email ou mot de passe incorrect',
            });
        }

        // Check if account is disabled
        if (!user.active) {
            throw new ForbiddenException({
                code: 'ACCOUNT_DISABLED',
                message: 'Compte desactive',
            });
        }

        // Check if account is locked
        if (user.lockedUntil && user.lockedUntil > new Date()) {
            throw new HttpException(
                {
                    code: 'ACCOUNT_LOCKED',
                    message: `Compte verrouille. Reessayez apres ${user.lockedUntil.toISOString()}`,
                },
                HttpStatus.LOCKED,
            );
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);

        if (!isPasswordValid) {
            // Increment failed attempts
            const attempts = user.failedLoginAttempts + 1;
            const updateData: any = { failedLoginAttempts: attempts };

            // Lock account after MAX_LOGIN_ATTEMPTS
            if (attempts >= MAX_LOGIN_ATTEMPTS) {
                updateData.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
            }

            await req.tenantDb.user.update({
                where: { id: user.id },
                data: updateData,
            });

            throw new UnauthorizedException({
                code: 'INVALID_CREDENTIALS',
                message: 'Email ou mot de passe incorrect',
            });
        }

        // Successful login — reset failed attempts and update last login
        const refreshToken = this.generateRefreshToken();
        const hashedRefreshToken = await bcrypt.hash(refreshToken, SALT_ROUNDS);

        await req.tenantDb.user.update({
            where: { id: user.id },
            data: {
                failedLoginAttempts: 0,
                lockedUntil: null,
                lastLoginAt: new Date(),
                refreshToken: hashedRefreshToken,
            },
        });

        // Generate JWT access token
        const payload: JwtPayload = {
            sub: user.id,
            email: user.email,
            role: user.role,
            tenantId: req.tenantId,
            tenantSubdomain: req.tenantSubdomain,
        };

        const accessToken = this.jwtService.sign(payload);

        return {
            access_token: accessToken,
            refresh_token: refreshToken,
            token_type: 'Bearer',
            expires_in: parseInt(process.env.JWT_ACCESS_EXPIRY || '900'),
            user: {
                id: user.id,
                email: user.email,
                first_name: user.firstName,
                last_name: user.lastName,
                role: user.role,
                avatar_url: user.avatarUrl,
            },
        };
    }

    /**
     * Refresh an access token using a valid refresh token.
     * Implements: refresh token rotation (new refresh token on every call).
     */
    async refresh(req: TenantRequest, refreshToken: string) {
        // Find user with a matching refresh token
        const users = await req.tenantDb.user.findMany({
            where: { active: true },
        });

        let matchedUser = null;
        for (const user of users) {
            if (
                user.refreshToken &&
                (await bcrypt.compare(refreshToken, user.refreshToken))
            ) {
                matchedUser = user;
                break;
            }
        }

        if (!matchedUser) {
            throw new UnauthorizedException({
                code: 'INVALID_REFRESH_TOKEN',
                message: 'Refresh token invalide ou expire',
            });
        }

        // Rotate refresh token
        const newRefreshToken = this.generateRefreshToken();
        const hashedRefreshToken = await bcrypt.hash(newRefreshToken, SALT_ROUNDS);

        await req.tenantDb.user.update({
            where: { id: matchedUser.id },
            data: { refreshToken: hashedRefreshToken },
        });

        // Generate new access token
        const payload: JwtPayload = {
            sub: matchedUser.id,
            email: matchedUser.email,
            role: matchedUser.role,
            tenantId: req.tenantId,
            tenantSubdomain: req.tenantSubdomain,
        };

        return {
            access_token: this.jwtService.sign(payload),
            refresh_token: newRefreshToken,
            expires_in: parseInt(process.env.JWT_ACCESS_EXPIRY || '900'),
        };
    }

    /**
     * Revoke the refresh token (logout).
     */
    async logout(req: TenantRequest, userId: string) {
        await req.tenantDb.user.update({
            where: { id: userId },
            data: { refreshToken: null },
        });
    }

    /**
     * Send a password reset email with a unique token.
     */
    async forgotPassword(req: TenantRequest, dto: ForgotPasswordDto) {
        const user = await req.tenantDb.user.findUnique({
            where: { email: dto.email },
        });

        // Always return success (prevent email enumeration)
        if (!user) {
            return { message: 'Email de reinitialisation envoye' };
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await req.tenantDb.user.update({
            where: { id: user.id },
            data: {
                resetToken: await bcrypt.hash(resetToken, SALT_ROUNDS),
                resetTokenExpiry,
            },
        });

        // Send email
        try {
            await this.transporter.sendMail({
                from: process.env.SMTP_FROM || 'noreply@fieldops360.com',
                to: user.email,
                subject: 'FieldOps360 — Reinitialisation du mot de passe',
                html: `
          <h2>Reinitialisation du mot de passe</h2>
          <p>Bonjour ${user.firstName},</p>
          <p>Votre code de reinitialisation est: <strong>${resetToken}</strong></p>
          <p>Ce code expire dans 1 heure.</p>
          <p>Si vous n'avez pas demande cette reinitialisation, ignorez cet email.</p>
        `,
            });
        } catch (error) {
            console.error('Email send failed:', error);
            // Don't throw — the token is still valid, user can retry
        }

        return { message: 'Email de reinitialisation envoye' };
    }

    /**
     * Reset password using a valid reset token.
     */
    async resetPassword(req: TenantRequest, dto: ResetPasswordDto) {
        if (dto.new_password !== dto.new_password_confirmation) {
            throw new BadRequestException({
                code: 'VALIDATION_ERROR',
                message: 'Les mots de passe ne correspondent pas',
            });
        }

        // Find users with non-expired reset tokens
        const users = await req.tenantDb.user.findMany({
            where: {
                resetToken: { not: null },
                resetTokenExpiry: { gt: new Date() },
            },
        });

        let matchedUser = null;
        for (const user of users) {
            if (
                user.resetToken &&
                (await bcrypt.compare(dto.token, user.resetToken))
            ) {
                matchedUser = user;
                break;
            }
        }

        if (!matchedUser) {
            throw new BadRequestException({
                code: 'INVALID_RESET_TOKEN',
                message: 'Token de reinitialisation invalide ou expire',
            });
        }

        // Update password and clear reset token
        await req.tenantDb.user.update({
            where: { id: matchedUser.id },
            data: {
                passwordHash: await bcrypt.hash(dto.new_password, SALT_ROUNDS),
                resetToken: null,
                resetTokenExpiry: null,
                failedLoginAttempts: 0,
                lockedUntil: null,
            },
        });

        return { message: 'Mot de passe reinitialise avec succes' };
    }

    /**
     * Generate a cryptographically secure refresh token.
     */
    private generateRefreshToken(): string {
        return crypto.randomBytes(64).toString('hex');
    }
}
