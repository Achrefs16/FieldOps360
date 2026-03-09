import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('v1/auth')
export class HealthController {
    /**
    * GET /api/v1/auth/health
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
