import { Types } from 'mongoose';
import { AuditLog } from './audit.model';
import { logger } from '../../utils/logger';

export interface AuditLogParams {
  actorId?: Types.ObjectId | string | null;
  actorName?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

export const auditService = {
  /**
   * Records an audit event asynchronously.
   * Catches any errors so audit failures never disrupt primary business transactions.
   */
  async log(params: AuditLogParams): Promise<void> {
    try {
      const sanitizedMetadata = params.metadata ? { ...params.metadata } : {};

      // Defensive stripping of potential secret fields
      const sensitiveKeys = ['password', 'passwordHash', 'token', 'refreshToken', 'pin', 'pinHash', 'secret'];
      for (const key of sensitiveKeys) {
        if (key in sanitizedMetadata) {
          delete sanitizedMetadata[key];
        }
      }

      await AuditLog.create({
        actorId: params.actorId ? new Types.ObjectId(params.actorId.toString()) : null,
        actorName: params.actorName,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        metadata: sanitizedMetadata,
        ip: params.ip,
        userAgent: params.userAgent,
      });
    } catch (error) {
      logger.error({ err: error, action: params.action }, 'Failed to record audit log entry');
    }
  },
};
