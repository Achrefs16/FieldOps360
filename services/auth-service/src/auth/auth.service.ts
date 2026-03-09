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
import * as crypto from 'node:crypto';
import * as nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';
import { TenantRequest } from '../common/middleware/tenant.middleware';
import { JwtPayload } from './strategies/jwt.strategy';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { resolvePermissions } from '../common/auth/permissions';
import { TokenBlacklistService } from '../common/security/token-blacklist.service';
import { AuditLogService } from '../common/audit/audit-log.service';

const SALT_ROUNDS = 10;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes

@Injectable()
export class AuthService {
    private readonly transporter: nodemailer.Transporter;

    constructor(
        private readonly jwtService: JwtService,
        private readonly tokenBlacklistService: TokenBlacklistService,
        private readonly auditLogService: AuditLogService,
    ) {
        // Initialize email transporter (Mailtrap for development)
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'sandbox.smtp.mailtrap.io',
            port: Number.parseInt(process.env.SMTP_PORT || '2525'),
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

        if (user?.deletedAt) {
            throw new UnauthorizedException({
                code: 'INVALID_CREDENTIALS',
                message: 'Email ou mot de passe incorrect',
            });
        }

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

            await this.auditLogService.log(req, {
                userId: user.id,
                action: 'AUTH_LOGIN_FAILED',
                resource: 'auth',
                resourceId: user.id,
                metadata: { email: dto.email, attempts },
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
                updatedBy: user.id,
            },
        });

        // Generate JWT access token
        const payload: JwtPayload = {
            sub: user.id,
            email: user.email,
            role: user.role,
            permissions: resolvePermissions(user.role),
            jti: uuidv4(),
            tenantId: req.tenantId,
            tenantSubdomain: req.tenantSubdomain,
        };

        const accessToken = this.jwtService.sign(payload);

        await this.auditLogService.log(req, {
            userId: user.id,
            action: 'AUTH_LOGIN_SUCCESS',
            resource: 'auth',
            resourceId: user.id,
            metadata: { role: user.role },
        });

        return {
            access_token: accessToken,
            refresh_token: refreshToken,
            token_type: 'Bearer',
            expires_in: Number.parseInt(process.env.JWT_ACCESS_EXPIRY || '900'),
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
            where: { active: true, deletedAt: null },
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
            data: { refreshToken: hashedRefreshToken, updatedBy: matchedUser.id },
        });

        // Generate new access token
        const payload: JwtPayload = {
            sub: matchedUser.id,
            email: matchedUser.email,
            role: matchedUser.role,
            permissions: resolvePermissions(matchedUser.role),
            jti: uuidv4(),
            tenantId: req.tenantId,
            tenantSubdomain: req.tenantSubdomain,
        };

        return {
            access_token: this.jwtService.sign(payload),
            refresh_token: newRefreshToken,
            expires_in: Number.parseInt(process.env.JWT_ACCESS_EXPIRY || '900'),
        };
    }

    /**
     * Revoke the refresh token (logout).
     */
    async logout(req: TenantRequest, userId: string, jwtPayload?: JwtPayload) {
        await req.tenantDb.user.update({
            where: { id: userId },
            data: { refreshToken: null, updatedBy: userId },
        });

        if (jwtPayload?.jti && jwtPayload?.exp) {
            const now = Math.floor(Date.now() / 1000);
            const ttl = Math.max(0, jwtPayload.exp - now);
            await this.tokenBlacklistService.blacklist(jwtPayload.jti, ttl);
        }

        await this.auditLogService.log(req, {
            userId,
            action: 'AUTH_LOGOUT',
            resource: 'auth',
            resourceId: userId,
            metadata: { jti: jwtPayload?.jti ?? null },
        });
    }

    /**
     * Send a password reset email with a unique token.
     */
    async forgotPassword(req: TenantRequest, dto: ForgotPasswordDto) {
        const user = await req.tenantDb.user.findUnique({
            where: { email: dto.email },
        });

        if (user?.deletedAt) {
            return { message: 'Email de reinitialisation envoye' };
        }

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
                updatedBy: user.id,
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
                deletedAt: null,
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
                updatedBy: matchedUser.id,
            },
        });

        await this.auditLogService.log(req, {
            userId: matchedUser.id,
            action: 'AUTH_PASSWORD_RESET',
            resource: 'users',
            resourceId: matchedUser.id,
        });

        return { message: 'Mot de passe reinitialise avec succes' };
    }

    async ssoLogin(req: TenantRequest, provider: 'google' | 'microsoft', accessToken: string) {
        const profile = await this.fetchSsoProfile(provider, accessToken);
        if (!profile.email) {
            throw new UnauthorizedException({
                code: 'SSO_EMAIL_MISSING',
                message: 'Le fournisseur SSO n\'a pas retourne d\'email.',
            });
        }

        let user = await req.tenantDb.user.findUnique({ where: { email: profile.email } });

        if (!user) {
            const randomPassword = await bcrypt.hash(this.generateRefreshToken(), SALT_ROUNDS);
            const createData: any = {
                email: profile.email,
                passwordHash: randomPassword,
                firstName: profile.firstName || 'SSO',
                lastName: profile.lastName || 'User',
                role: 'TEAM_MEMBER',
                active: true,
                firstLogin: false,
                createdBy: null,
                updatedBy: null,
                metadata: {
                    sso_provider: provider,
                    sso_subject: profile.subject,
                },
            };
            user = await req.tenantDb.user.create({ data: createData });
        }

        if (!user.active || user.deletedAt) {
            throw new ForbiddenException({
                code: 'ACCOUNT_DISABLED',
                message: 'Compte desactive',
            });
        }

        const refreshToken = this.generateRefreshToken();
        const hashedRefreshToken = await bcrypt.hash(refreshToken, SALT_ROUNDS);

        await req.tenantDb.user.update({
            where: { id: user.id },
            data: {
                lastLoginAt: new Date(),
                refreshToken: hashedRefreshToken,
                updatedBy: user.id,
            },
        });

        const payload: JwtPayload = {
            sub: user.id,
            email: user.email,
            role: user.role,
            permissions: resolvePermissions(user.role),
            jti: uuidv4(),
            tenantId: req.tenantId,
            tenantSubdomain: req.tenantSubdomain,
        };

        await this.auditLogService.log(req, {
            userId: user.id,
            action: 'AUTH_SSO_LOGIN',
            resource: 'auth',
            resourceId: user.id,
            metadata: { provider },
        });

        return {
            access_token: this.jwtService.sign(payload),
            refresh_token: refreshToken,
            token_type: 'Bearer',
            expires_in: Number.parseInt(process.env.JWT_ACCESS_EXPIRY || '900'),
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

    async enableMfa(req: TenantRequest, userId: string, currentPassword: string) {
        const user = await req.tenantDb.user.findFirst({ where: { id: userId, deletedAt: null } });
        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        const validPassword = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!validPassword) {
            throw new UnauthorizedException({
                code: 'INVALID_PASSWORD',
                message: 'Mot de passe actuel incorrect',
            });
        }

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const speakeasy = require('speakeasy');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const QRCode = require('qrcode');

        const secret = speakeasy.generateSecret({
            name: `FieldOps360 (${req.tenantSubdomain})`,
            issuer: 'FieldOps360',
            length: 20,
        });

        const metadata = (user.metadata && typeof user.metadata === 'object' ? user.metadata : {}) as Record<string, unknown>;
        metadata.mfa = {
            enabled: false,
            secret: secret.base32,
            pending: true,
        };

        const updateData: any = { metadata, updatedBy: userId };
        await req.tenantDb.user.update({ where: { id: userId }, data: updateData });

        const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url);

        await this.auditLogService.log(req, {
            userId,
            action: 'AUTH_MFA_ENABLE_CHALLENGE',
            resource: 'users',
            resourceId: userId,
        });

        return {
            message: 'MFA challenge generated',
            secret: secret.base32,
            qr_code: qrCodeDataUrl,
        };
    }

    async verifyMfa(req: TenantRequest, userId: string, code: string) {
        const user = await req.tenantDb.user.findFirst({ where: { id: userId, deletedAt: null } });
        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        const metadata = (user.metadata && typeof user.metadata === 'object' ? user.metadata : {}) as Record<string, any>;
        const mfa = metadata.mfa;
        if (!mfa?.secret) {
            throw new BadRequestException({
                code: 'MFA_NOT_INITIALIZED',
                message: 'MFA is not initialized for this account.',
            });
        }

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const speakeasy = require('speakeasy');
        const verified = speakeasy.totp.verify({
            secret: mfa.secret,
            encoding: 'base32',
            token: code,
            window: 1,
        });

        if (!verified) {
            throw new UnauthorizedException({
                code: 'MFA_INVALID_CODE',
                message: 'Invalid MFA code.',
            });
        }

        metadata.mfa = {
            ...mfa,
            enabled: true,
            pending: false,
            verifiedAt: new Date().toISOString(),
        };

        const updateData: any = { metadata, updatedBy: userId };
        await req.tenantDb.user.update({ where: { id: userId }, data: updateData });

        await this.auditLogService.log(req, {
            userId,
            action: 'AUTH_MFA_ENABLED',
            resource: 'users',
            resourceId: userId,
        });

        return { message: 'MFA enabled successfully' };
    }

    private async fetchSsoProfile(provider: 'google' | 'microsoft', accessToken: string) {
        const endpoint =
            provider === 'google'
                ? 'https://www.googleapis.com/oauth2/v3/userinfo'
                : 'https://graph.microsoft.com/v1.0/me';

        const response = await fetch(endpoint, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            throw new UnauthorizedException({
                code: 'SSO_TOKEN_INVALID',
                message: 'Invalid SSO access token.',
            });
        }

        const data: any = await response.json();

        if (provider === 'google') {
            return {
                subject: data.sub,
                email: data.email,
                firstName: data.given_name,
                lastName: data.family_name,
            };
        }

        return {
            subject: data.id,
            email: data.mail || data.userPrincipalName,
            firstName: data.givenName,
            lastName: data.surname,
        };
    }

    /**
     * Generate a cryptographically secure refresh token.
     */
    private generateRefreshToken(): string {
        return crypto.randomBytes(64).toString('hex');
    }
}
