import { initTracer, type TracingConfig, type TracingOptions } from 'jaeger-client';
import type { Tracer, Span } from 'opentracing';

interface ClosableTracer extends Tracer {
  close(callback?: () => void): void;
}

let tracer: ClosableTracer | null = null;

function toNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  return value.toLowerCase() === 'true';
}

export function getJaegerTracer(): Tracer {
  if (tracer) {
    return tracer;
  }

  const collectorEndpoint =
    process.env.JAEGER_COLLECTOR_ENDPOINT ||
    'http://jaeger-collector.monitoring.svc.cluster.local:14268/api/traces';

  const config: TracingConfig = {
    serviceName: process.env.JAEGER_SERVICE_NAME || 'auth-service',
    sampler: {
      type: process.env.JAEGER_SAMPLER_TYPE || 'const',
      param: toNumber(process.env.JAEGER_SAMPLER_PARAM, 1),
    },
    reporter: {
      logSpans: toBoolean(process.env.JAEGER_LOG_SPANS, false),
      collectorEndpoint,
      agentHost: process.env.JAEGER_AGENT_HOST,
      agentPort: toNumber(process.env.JAEGER_AGENT_PORT, 6831),
    },
  };

  const options: TracingOptions = {
    logger: {
      info(message: string): void {
        console.log(`[Jaeger] ${message}`);
      },
      error(message: string): void {
        console.error(`[Jaeger] ${message}`);
      },
    },
  };

  const initializedTracer = initTracer(config, options) as ClosableTracer;
  tracer = initializedTracer;

  return initializedTracer;
}

export function closeJaegerTracer(): void {
  if (!tracer) {
    return;
  }

  tracer.close(() => {
    console.log('[Jaeger] tracer closed');
  });
  tracer = null;
}

export interface RequestSpanContext {
  method: string;
  path: string;
  statusCode: number;
}

export function annotateHttpSpan(span: Span, context: RequestSpanContext): void {
  span.setTag('span.kind', 'server');
  span.setTag('http.method', context.method);
  span.setTag('http.target', context.path);
  span.setTag('http.status_code', context.statusCode);

  if (context.statusCode >= 500) {
    span.setTag('error', true);
  }
}
