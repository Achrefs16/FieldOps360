import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global API prefix: /api
  app.setGlobalPrefix('api');

  // Enable CORS for frontend development
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger / OpenAPI documentation
  const config = new DocumentBuilder()
    .setTitle('FieldOps360 - Auth Service')
    .setDescription(
      'Authentication, user management, and profile management API for the FieldOps360 multi-tenant platform.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'JWT',
    )
    .addApiKey(
      { type: 'apiKey', name: 'X-Tenant-ID', in: 'header' },
      'TenantID',
    )
    .addTag('Authentication', 'Login, logout, token refresh, password reset')
    .addTag('Users', 'User CRUD operations (MANAGER+ access)')
    .addTag('Profile', 'Authenticated user profile management')
    .addTag('Health', 'Service health check')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log(`
  Auth Service is running
  Port: ${port}
  Environment: ${process.env.NODE_ENV || 'development'}
  API: /api/auth/v1
  Docs: /api/docs
  `);
}

bootstrap();
