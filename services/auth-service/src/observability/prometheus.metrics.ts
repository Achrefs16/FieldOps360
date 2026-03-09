import type { NextFunction, Request, Response } from 'express';
import { collectDefaultMetrics, Counter, Histogram, Registry } from 'prom-client';

const registry = new Registry();

collectDefaultMetrics({
  register: registry,
  prefix: 'auth_service_',
});

const httpRequestDuration = new Histogram({
  name: 'auth_service_http_request_duration_seconds',
  help: 'HTTP request duration in seconds for auth-service',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [registry],
});

const httpRequestsTotal = new Counter({
  name: 'auth_service_http_requests_total',
  help: 'Total number of HTTP requests handled by auth-service',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry],
});

function normalizeRoute(req: Request): string {
  if (req.path === '/metrics') {
    return '/metrics';
  }

  const candidate = req.baseUrl ? `${req.baseUrl}${req.path}` : req.path;
  return candidate || req.originalUrl.split('?')[0] || 'unknown';
}

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const elapsedNs = process.hrtime.bigint() - start;
    const elapsedSeconds = Number(elapsedNs) / 1_000_000_000;
    const route = normalizeRoute(req);
    const statusCode = String(res.statusCode);

    httpRequestDuration.observe(
      {
        method: req.method,
        route,
        status_code: statusCode,
      },
      elapsedSeconds,
    );

    httpRequestsTotal.inc({
      method: req.method,
      route,
      status_code: statusCode,
    });
  });

  next();
}

export function metricsContentType(): string {
  return registry.contentType;
}

export async function metricsPayload(): Promise<string> {
  return registry.metrics();
}
