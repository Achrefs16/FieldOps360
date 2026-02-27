import { Module } from '@nestjs/common';
import { TenantsModule } from './tenants/tenants.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health.controller';

@Module({
  imports: [TenantsModule, DashboardModule, AuthModule],
  controllers: [HealthController],
})
export class AppModule { }
