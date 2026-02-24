import {
    Controller,
    Get,
    Post,
    Put,
    Patch,
    Body,
    Param,
    Query,
    Req,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantRequest } from '../common/middleware/tenant.middleware';

@ApiTags('Users')
@ApiBearerAuth('JWT')
@ApiHeader({ name: 'X-Tenant-ID', description: 'Tenant subdomain', required: true })
@Controller('auth/v1/users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get()
    @Roles('MANAGER', 'PROJECT_MANAGER')
    @ApiOperation({ summary: 'List users', description: 'Get a paginated list of users with optional filtering by role, active status, and search term.' })
    @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20)' })
    @ApiQuery({ name: 'sort', required: false, type: String, description: 'Sort field (created_at, first_name, last_name, last_login_at)' })
    @ApiQuery({ name: 'order', required: false, enum: ['asc', 'desc'], description: 'Sort order' })
    @ApiQuery({ name: 'role', required: false, type: String, description: 'Filter by role (MANAGER, PROJECT_MANAGER, SITE_LEADER, TEAM_MEMBER)' })
    @ApiQuery({ name: 'active', required: false, type: String, description: 'Filter by active status (true/false)' })
    @ApiQuery({ name: 'search', required: false, type: String, description: 'Search by name or email' })
    @ApiResponse({ status: 200, description: 'Paginated user list with meta information (page, limit, total, totalPages).' })
    async findAll(
        @Req() req: TenantRequest,
        @Query() pagination: PaginationDto,
        @Query('role') role?: string,
        @Query('active') active?: string,
        @Query('search') search?: string,
    ) {
        return this.usersService.findAll(req, pagination, { role, active, search });
    }

    @Post()
    @Roles('MANAGER')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create user', description: 'Create a new user in the tenant. Password must contain uppercase, lowercase, number, and special character.' })
    @ApiResponse({ status: 201, description: 'User created successfully.' })
    @ApiResponse({ status: 409, description: 'Email already in use.' })
    async create(@Req() req: TenantRequest, @Body() dto: CreateUserDto) {
        return this.usersService.create(req, dto);
    }

    @Get(':id')
    @Roles('MANAGER', 'PROJECT_MANAGER')
    @ApiOperation({ summary: 'Get user by ID', description: 'Get the full profile of a specific user.' })
    @ApiParam({ name: 'id', description: 'User UUID' })
    @ApiResponse({ status: 200, description: 'User details.' })
    @ApiResponse({ status: 404, description: 'User not found.' })
    async findOne(@Req() req: TenantRequest, @Param('id') id: string) {
        return this.usersService.findOne(req, id);
    }

    @Put(':id')
    @Roles('MANAGER')
    @ApiOperation({ summary: 'Update user', description: 'Update user information. Only specified fields are modified.' })
    @ApiParam({ name: 'id', description: 'User UUID' })
    @ApiResponse({ status: 200, description: 'User updated.' })
    @ApiResponse({ status: 404, description: 'User not found.' })
    @ApiResponse({ status: 409, description: 'Email already in use.' })
    async update(
        @Req() req: TenantRequest,
        @Param('id') id: string,
        @Body() dto: UpdateUserDto,
    ) {
        return this.usersService.update(req, id, dto);
    }

    @Patch(':id/status')
    @Roles('MANAGER')
    @ApiOperation({ summary: 'Toggle user status', description: 'Activate or deactivate a user account.' })
    @ApiParam({ name: 'id', description: 'User UUID' })
    @ApiResponse({ status: 200, description: 'User status updated.' })
    @ApiResponse({ status: 404, description: 'User not found.' })
    async updateStatus(
        @Req() req: TenantRequest,
        @Param('id') id: string,
        @Body('active') active: boolean,
    ) {
        return this.usersService.updateStatus(req, id, active);
    }
}
