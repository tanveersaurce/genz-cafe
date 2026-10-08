/**
 * Static configuration for QR Self-Ordering at Gen-Z Cafe (Client Mirror).
 */
export const qrOrderingSettings = {
  maxLinesPerSubmission: 20,
  maxQtyPerLine: 10,
  maxSubmissionsPerTablePer10Min: 3,
  maxPendingCustomerSubmissionsPerTable: 3,
  undoWindowSeconds: 60,
  orderCutoffBeforeCloseMinutes: 15,
  statusLinkValidHoursAfterClose: 2,
  customerPhoneRetentionDays: 90,
  nameMinChars: 2,
  nameMaxChars: 30,
} as const;

export type QrOrderingSettings = typeof qrOrderingSettings;
