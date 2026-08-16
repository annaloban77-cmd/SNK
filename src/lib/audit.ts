// Audit log helper — writes a record to AuditLog table for compliance & security.
// Failures are non-fatal: we log to console and continue.
import { dbMon as db } from './db-monetization'

export interface LogAuditParams {
  organizationId?: string | null
  userId?: string | null
  action: string
  resourceType?: string | null
  resourceId?: string | null
  details?: Record<string, unknown> | null
  ipAddress?: string | null
  userAgent?: string | null
}

export async function logAudit(params: LogAuditParams): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        organizationId: params.organizationId ?? null,
        userId: params.userId ?? null,
        action: params.action,
        resourceType: params.resourceType ?? null,
        resourceId: params.resourceId ?? null,
        details: params.details ? JSON.stringify(params.details) : null,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
      },
    })
  } catch (e) {
    // Never let audit failures break the request flow
    console.error('Audit log failed:', e)
  }
}
