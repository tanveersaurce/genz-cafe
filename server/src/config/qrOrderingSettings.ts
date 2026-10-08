/**
 * Static configuration for QR Self-Ordering at Gen-Z Cafe.
 * Values marked '// DUMMY: confirm with cafe' are customizable business rules.
 */
export const qrOrderingSettings = {
  // DUMMY: confirm with cafe
  maxLinesPerSubmission: 20,

  // DUMMY: confirm with cafe
  maxQtyPerLine: 10,

  // DUMMY: confirm with cafe
  maxSubmissionsPerTablePer10Min: 3,

  // DUMMY: confirm with cafe - submissions whose KOT status is still "new"
  maxPendingCustomerSubmissionsPerTable: 3,

  // DUMMY: confirm with cafe - customer cancellation grace period
  undoWindowSeconds: 60,

  // DUMMY: confirm with cafe - ordering cutoff before cafe closeTime
  orderCutoffBeforeCloseMinutes: 15,

  // DUMMY: confirm with cafe - how long status URL remains valid after order closed
  statusLinkValidHoursAfterClose: 2,

  // DUMMY: confirm with cafe - customer phone retention window for privacy
  customerPhoneRetentionDays: 90,

  // DUMMY: confirm with cafe
  nameMinChars: 2,

  // DUMMY: confirm with cafe
  nameMaxChars: 30,
} as const;

export type QrOrderingSettings = typeof qrOrderingSettings;
