/**
 * Central reservation rules and operational parameters for Gen-Z Cafe.
 * All time boundaries are evaluated in Indian Standard Time (Asia/Kolkata, UTC+5:30).
 *
 * NOTE: Operating hours here must remain aligned with client siteConfig.ts
 * until an administrative Settings module is introduced.
 */
export const reservationSettings = {
  // DUMMY: confirm with cafe
  slotIntervalMinutes: 30,

  // DUMMY: confirm with cafe
  stayDurationMinutes: 90, // how long a booking occupies a table (3 x 30-min slots)

  // DUMMY: confirm with cafe
  openTime: '10:00', // Daily opening in IST (24h format)

  // DUMMY: confirm with cafe
  closeTime: '23:00', // Daily closing in IST (24h format)

  // DUMMY: confirm with cafe
  lastBookingBeforeCloseMinutes: 90, // Latest slot starts 90 min before close (21:30 IST)

  // DUMMY: confirm with cafe
  minLeadMinutes: 60, // No bookings starting sooner than 1 hour from current server time

  // DUMMY: confirm with cafe
  maxAdvanceDays: 30, // Bookings allowed up to 30 days in advance

  // DUMMY: confirm with cafe
  maxGuestsPerBooking: 20, // Maximum allowed party size for any booking

  // DUMMY: confirm with cafe
  autoConfirmMaxGuests: 6, // Parties > 6 require manual staff review ("pending")

  // DUMMY: confirm with cafe
  maxActiveBookingsPerPhone: 2, // Maximum active upcoming bookings per phone number

  // DUMMY: confirm with cafe
  customerCancelCutoffMinutes: 120, // Customers can self-cancel only up to 2 hours before startAt
} as const;

export type ReservationSettings = typeof reservationSettings;
