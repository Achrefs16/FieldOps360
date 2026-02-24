import {
    Controller,
    Get,
    Put,
    Body,
    Req,
    UseGuards,
    UseInterceptors,
    UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TenantRequest } from '../common/middleware/tenant.middleware';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

@ApiTags('Profile')
@ApiBearerAuth('JWT')
@ApiHeader({ name: 'X-Tenant-ID', description: 'Tenant subdomain', required: true })
@Controller('auth/v1/me')
@UseGuards(JwtAuthGuard)
export class ProfileController {
    constructor(private readonly profileService: ProfileService) { }

    @Get()
    @ApiOperation({ summary: 'Get my profile', description: 'Returns the full profile of the currently authenticated user.' })
    @ApiResponse({ status: 200, description: 'User profile.' })
    async getProfile(
        @Req() req: TenantRequest,
        @CurrentUser() user: JwtPayload,
    ) {
        return this.profileService.getProfile(req, user.sub);
    }

    @Put()
    @ApiOperation({ summary: 'Update my profile', description: 'Update profile fields (name, phone, language, timezone). Cannot change email or role.' })
    @ApiResponse({ status: 200, description: 'Profile updated.' })
    async updateProfile(
        @Req() req: TenantRequest,
        @CurrentUser() user: JwtPayload,
        @Body() dto: UpdateProfileDto,
    ) {
        return this.profileService.updateProfile(req, user.sub, dto);
    }

    @Put('password')
    @ApiOperation({ summary: 'Change my password', description: 'Change password by providing the current password and a new one.' })
    @ApiResponse({ status: 200, description: 'Password changed.' })
    @ApiResponse({ status: 401, description: 'Current password is incorrect.' })
    async changePassword(
        @Req() req: TenantRequest,
        @CurrentUser() user: JwtPayload,
        @Body() dto: ChangePasswordDto,
    ) {
        return this.profileService.changePassword(req, user.sub, dto);
    }

    @Put('avatar')
    @UseInterceptors(
        FileInterceptor('avatar', {
            limits: { fileSize: 2 * 1024 * 1024 },
        }),
    )
    @ApiOperation({ summary: 'Upload avatar', description: 'Upload a profile picture. Accepted formats: JPEG, PNG, WebP. Maximum size: 2MB.' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                avatar: { type: 'string', format: 'binary', description: 'Image file (JPEG, PNG, WebP)' },
            },
        },
    })
    @ApiResponse({ status: 200, description: 'Avatar uploaded. Returns { avatar_url }.' })
    @ApiResponse({ status: 400, description: 'Invalid file type or file too large.' })
    async uploadAvatar(
        @Req() req: TenantRequest,
        @CurrentUser() user: JwtPayload,
        @UploadedFile() file: Express.Multer.File,
    ) {
        return this.profileService.uploadAvatar(req, user.sub, file);
    }
}
