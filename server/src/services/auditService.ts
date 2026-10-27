import { db } from '../db/index.js';

export interface AuditLogParams {
  userId?: number | null;
  action: string;
  entityType: string;
  entityId?: string | number | bigint | null;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string | null;
}

export function logAudit(params: AuditLogParams) {
  try {
    const stmt = db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      params.userId ?? null,
      params.action,
      params.entityType,
      params.entityId ? String(params.entityId) : null,
      params.oldValues ? JSON.stringify(params.oldValues) : null,
      params.newValues ? JSON.stringify(params.newValues) : null,
      params.ipAddress ?? null
    );
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
