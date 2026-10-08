import { Types } from 'mongoose';
import { Setting } from './setting.model';
import { AppError } from '../../utils/AppError';
import { auditService } from '../audit/audit.service';
import { hasPermission, Role } from '../auth/permissions';

export interface QrOrderingConfig {
  enabled: boolean;
  pauseMessage?: string;
}

const CACHE_TTL_MS = 5000; // 5 seconds server-side cache
let cachedQrSetting: { data: QrOrderingConfig; expiresAt: number } | null = null;

export const settingService = {
  /**
   * Clears the in-memory cache (used by tests or updates).
   */
  clearCache(): void {
    cachedQrSetting = null;
  },

  /**
   * Fetches QR ordering runtime kill switch state.
   * Cached in memory for max 5 seconds to minimize database hits.
   */
  async getQrOrderingSetting(): Promise<QrOrderingConfig> {
    const now = Date.now();
    if (cachedQrSetting && cachedQrSetting.expiresAt > now) {
      return cachedQrSetting.data;
    }

    const doc = await Setting.findOne({ key: 'qrOrdering' });
    const settingValue: QrOrderingConfig = (doc?.value as QrOrderingConfig) || {
      enabled: true,
      pauseMessage: '',
    };

    cachedQrSetting = {
      data: settingValue,
      expiresAt: now + CACHE_TTL_MS,
    };

    return settingValue;
  },

  /**
   * Updates QR ordering status.
   * Pause: partner or manager (permission qr:pause or settings:manage).
   * Resume: partner only (permission settings:manage).
   */
  async updateQrOrderingSetting(
    enabled: boolean,
    pauseMessage: string | undefined,
    userId: string,
    userRole: Role
  ): Promise<QrOrderingConfig> {
    if (enabled) {
      // Resuming requires settings:manage (partner only)
      if (!hasPermission(userRole, 'settings:manage')) {
        throw new AppError('Only partners can resume QR self-ordering', 403, 'FORBIDDEN');
      }
    } else {
      // Pausing allows partner or manager (qr:pause or settings:manage)
      if (!hasPermission(userRole, 'qr:pause') && !hasPermission(userRole, 'settings:manage')) {
        throw new AppError('Permission required to pause QR ordering', 403, 'FORBIDDEN');
      }
    }

    const trimmedMessage = pauseMessage !== undefined ? pauseMessage.trim() : undefined;
    const updatePayload: QrOrderingConfig = {
      enabled,
      ...(trimmedMessage ? { pauseMessage: trimmedMessage } : {}),
    };

    const doc = await Setting.findOneAndUpdate(
      { key: 'qrOrdering' },
      {
        value: updatePayload,
        updatedBy: new Types.ObjectId(userId),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Refresh memory cache
    cachedQrSetting = {
      data: updatePayload,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };

    // Audit log
    await auditService.log({
      actorId: userId,
      action: enabled ? 'qr.resumed' : 'qr.paused',
      entityType: 'Setting',
      entityId: doc._id.toString(),
      metadata: {
        enabled,
        message: trimmedMessage,
      },
    });

    return updatePayload;
  },
};
