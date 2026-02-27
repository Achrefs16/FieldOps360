import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/tenant.dto';

@Controller('tenants')
export class TenantsController {
    constructor(private readonly tenantsService: TenantsService) { }

    // GET /api/admin/v1/tenants — List all tenants
    @Get()
    async findAll() {
        const tenants = await this.tenantsService.findAll();
        return { success: true, data: tenants };
    }

    // POST /api/admin/v1/tenants — Provision new tenant
    @Post()
    @HttpCode(HttpStatus.CREATED)
    async create(@Body() dto: CreateTenantDto) {
        const tenant = await this.tenantsService.provision(dto);
        return { success: true, data: tenant };
    }

    // PATCH /api/admin/v1/tenants/:id/suspend
    @Patch(':id/suspend')
    async suspend(@Param('id') id: string) {
        const tenant = await this.tenantsService.suspend(id);
        return { success: true, data: tenant };
    }

    // PATCH /api/admin/v1/tenants/:id/activate
    @Patch(':id/activate')
    async activate(@Param('id') id: string) {
        const tenant = await this.tenantsService.activate(id);
        return { success: true, data: tenant };
    }

    // DELETE /api/admin/v1/tenants/:id — Soft delete
    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    async remove(@Param('id') id: string) {
        const tenant = await this.tenantsService.softDelete(id);
        return { success: true, data: tenant };
    }

    // GET /api/admin/v1/tenants/:id/metrics
    @Get(':id/metrics')
    async metrics(@Param('id') id: string) {
        const metrics = await this.tenantsService.getMetrics(id);
        return { success: true, data: metrics };
    }
}
