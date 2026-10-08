import { CustomerSubmission } from '../modules/orders/models/customerSubmission.model';
import { qrOrderingSettings } from '../config/qrOrderingSettings';
import { logger } from '../utils/logger';

export const phoneRetentionService = {
  /**
   * Idempotent daily cleanup job to purge customer phone numbers
   * older than customerPhoneRetentionDays (default 90 days).
   * Ensures data privacy compliance and minimal PII retention.
   */
  async purgeExpiredCustomerPhones(now = new Date()): Promise<{ purgedCount: number }> {
    const retentionMs = qrOrderingSettings.customerPhoneRetentionDays * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(now.getTime() - retentionMs);

    const result = await CustomerSubmission.updateMany(
      {
        createdAt: { $lt: cutoffDate },
        customerPhone: { $ne: null },
      },
      {
        $set: { customerPhone: null },
      }
    );

    if (result.modifiedCount > 0) {
      logger.info(
        { purgedCount: result.modifiedCount, cutoffDate: cutoffDate.toISOString() },
        'Purged expired customer phone numbers from CustomerSubmission'
      );
    }

    return { purgedCount: result.modifiedCount };
  },

  /**
   * Initializes background daily cron/interval for phone retention.
   * Single-instance assumption matching recurring expense scheduler.
   */
  startScheduler(): NodeJS.Timeout {
    // Run once on startup (non-blocking)
    void this.purgeExpiredCustomerPhones();

    // Check once every 24 hours
    const interval = setInterval(
      () => {
        void this.purgeExpiredCustomerPhones();
      },
      24 * 60 * 60 * 1000
    );

    return interval;
  },
};
