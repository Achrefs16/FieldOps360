import {
    Controller,
    Post,
    Body,
    Req,
    HttpCode,
    HttpStatus,
    UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TenantRequest } from '../common/middleware/tenant.middleware';
import { JwtPayload } from './strategies/jwt.strategy';

@ApiTags('Authentication')
@ApiHeader({ name: 'X-Tenant-ID', description: 'Tenant subdomain (e.g. "demo")', required: true })
@Controller('auth/v1')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Login', description: 'Authenticate a user with email and password. Returns JWT access and refresh tokens.' })
    @ApiResponse({ status: 200, description: 'Login successful. Returns access_token, refresh_token, expires_in, and user object.' })
    @ApiResponse({ status: 401, description: 'Invalid credentials or account locked.' })
    async login(@Req() req: TenantRequest, @Body() dto: LoginDto) {
        return this.authService.login(req, dto);
    }

    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Refresh token', description: 'Renew the access token using a valid refresh token. The old refresh token is revoked (rotation).' })
    @ApiResponse({ status: 200, description: 'New access_token and refresh_token issued.' })
    @ApiResponse({ status: 401, description: 'Invalid or expired refresh token.' })
    async refresh(@Req() req: TenantRequest, @Body() dto: RefreshTokenDto) {
        return this.authService.refresh(req, dto.refresh_token);
    }

    @Post('logout')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiBearerAuth('JWT')
    @ApiOperation({ summary: 'Logout', description: 'Revoke the refresh token. The access token remains valid until it expires.' })
    @ApiResponse({ status: 204, description: 'Logout successful.' })
    async logout(
        @Req() req: TenantRequest,
        @CurrentUser() user: JwtPayload,
    ) {
        await this.authService.logout(req, user.sub);
    }

    @Post('forgot-password')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Forgot password', description: 'Send a password reset email with a one-time token. Always returns 200 to prevent email enumeration.' })
    @ApiResponse({ status: 200, description: 'If the email exists, a reset link has been sent.' })
    async forgotPassword(
        @Req() req: TenantRequest,
        @Body() dto: ForgotPasswordDto,
    ) {
        return this.authService.forgotPassword(req, dto);
    }

    @Post('reset-password')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Reset password', description: 'Reset the password using the token received via email.' })
    @ApiResponse({ status: 200, description: 'Password reset successful.' })
    @ApiResponse({ status: 400, description: 'Invalid or expired reset token.' })
    async resetPassword(
        @Req() req: TenantRequest,
        @Body() dto: ResetPasswordDto,
    ) {
        return this.authService.resetPassword(req, dto);
    }
}
