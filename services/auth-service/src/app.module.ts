import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProfileModule } from './profile/profile.module';
import { HealthController } from './health.controller';
import { TenantMiddleware } from './common/middleware/tenant.middleware';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

@Module({
  imports: [DatabaseModule, AuthModule, UsersModule, ProfileModule],
  controllers: [HealthController],
  providers: [
    // Global exception filter — standard error response format
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    // Global response interceptor — standard success response format
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply tenant middleware to all auth routes EXCEPT health check
    consumer
      .apply(TenantMiddleware)
      .exclude({ path: 'auth/v1/health', method: RequestMethod.GET })
      .forRoutes({ path: 'auth/v1/*', method: RequestMethod.ALL });
  }
}
