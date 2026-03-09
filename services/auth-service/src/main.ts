import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import {
  metricsContentType,
  metricsMiddleware,
  metricsPayload,
} from './observability/prometheus.metrics';
import { annotateHttpSpan, closeJaegerTracer, getJaegerTracer } from './tracing/jaeger.tracer';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const tracer = getJaegerTracer();
  const expressApp = app.getHttpAdapter().getInstance();

  expressApp.get('/metrics', async (_req: Request, res: Response) => {
    res.setHeader('Content-Type', metricsContentType());
    res.send(await metricsPayload());
  });

  app.use(metricsMiddleware);

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/metrics') {
      next();
      return;
    }

    const span = tracer.startSpan(`${req.method} ${req.path}`);

    res.on('finish', () => {
      annotateHttpSpan(span, {
        method: req.method,
        path: req.originalUrl || req.url,
        statusCode: res.statusCode,
      });
      span.finish();
    });

    next();
  });

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

  app.enableShutdownHooks();
  process.on('SIGTERM', () => closeJaegerTracer());
  process.on('SIGINT', () => closeJaegerTracer());

  console.log(`
  Auth Service is running
  Port: ${port}
  Environment: ${process.env.NODE_ENV || 'development'}
  API: /api/auth/v1
  Docs: /api/docs
  `);
}

bootstrap();
