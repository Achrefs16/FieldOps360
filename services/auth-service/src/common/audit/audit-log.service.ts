import { Injectable } from '@nestjs/common';
import type { TenantRequest } from '../middleware/tenant.middleware';

export interface AuditEvent {
  userId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditLogService {
  async log(req: TenantRequest, event: AuditEvent): Promise<void> {
    try {
      const forwarded = req.headers['x-forwarded-for'];
      const ip =
        typeof forwarded === 'string'
          ? forwarded.split(',')[0].trim()
          : req.ip || '0.0.0.0';

      const tenantDb = req.tenantDb as any;

      await tenantDb.auditLog.create({
        data: {
          tenantId: req.tenantId,
          userId: event.userId || null,
          action: event.action,
          resource: event.resource,
          resourceId: event.resourceId || null,
          ipAddress: ip,
          userAgent: req.headers['user-agent'] || null,
          metadata: event.metadata || {},
        },
      });
    } catch {
      // Never block core API flow because of audit logging errors.
    }
  }
}
