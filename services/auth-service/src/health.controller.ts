import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('auth/v1')
export class HealthController {
    /**
     * GET /api/auth/v1/health
     * K8s liveness/readiness probe endpoint.
     */
    @Get('health')
    health() {
        return {
            status: 'ok',
            service: 'auth-service',
            timestamp: new Date().toISOString(),
        };
    }
}
