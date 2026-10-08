import crypto from 'crypto';
import { DateTime } from 'luxon';
import { reservationSettings } from '../../config/reservationSettings';
import { AppError } from '../../utils/AppError';

export const IST_ZONE = 'Asia/Kolkata';

// Unambiguous alphabet without confusing characters (0, O, 1, I)
const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Returns current instant as a Luxon DateTime in IST.
 */
export const getIstNow = (serverDate = new Date()): DateTime => {
  return DateTime.fromJSDate(serverDate, { zone: IST_ZONE });
};

/**
 * Converts a JS Date into a Luxon DateTime in IST.
 */
export const toIstDateTime = (date: Date): DateTime => {
  return DateTime.fromJSDate(date, { zone: IST_ZONE });
};

/**
 * Converts a Date or DateTime into standard "YYYY-MM-DD" in Indian Standard Time.
 */
export const formatLocalDate = (dateOrDt: Date | DateTime): string => {
  if (dateOrDt instanceof Date) {
    return DateTime.fromJSDate(dateOrDt, { zone: IST_ZONE }).toFormat('yyyy-MM-dd');
  }
  return dateOrDt.setZone(IST_ZONE).toFormat('yyyy-MM-dd');
};

/**
 * Generates all valid booking start times ("HH:mm") within operational hours.
 * Starts at openTime (10:00) and ends at closeTime - lastBookingBeforeCloseMinutes (21:30).
 */
export const generateDailySlotTimes = (): string[] => {
  const [openH, openM] = reservationSettings.openTime.split(':').map((v) => parseInt(v, 10));
  const [closeH, closeM] = reservationSettings.closeTime.split(':').map((v) => parseInt(v, 10));

  // Compute reference DateTime on an arbitrary day in IST
  let cursor = DateTime.fromObject(
    { year: 2026, month: 1, day: 1, hour: openH, minute: openM },
    { zone: IST_ZONE }
  );

  const closeTime = DateTime.fromObject(
    { year: 2026, month: 1, day: 1, hour: closeH, minute: closeM },
    { zone: IST_ZONE }
  );

  const lastBookingTime = closeTime.minus({
    minutes: reservationSettings.lastBookingBeforeCloseMinutes,
  });

  const slots: string[] = [];
  while (cursor <= lastBookingTime) {
    slots.push(cursor.toFormat('HH:mm'));
    cursor = cursor.plus({ minutes: reservationSettings.slotIntervalMinutes });
  }

  return slots;
};

/**
 * Converts localDate ("YYYY-MM-DD") and slotTime ("19:00") into full UTC startAt, endAt,
 * localDate, and array of slotStart timestamps (each 30-min interval occupied during the stay).
 */
export const calculateBookingInterval = (
  dateStr: string,
  timeStr: string,
  stayDurationMinutes: number = reservationSettings.stayDurationMinutes
): {
  startAt: Date;
  endAt: Date;
  localDate: string;
  slotStarts: Date[];
} => {
  // Validate date format YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new AppError('Invalid date format. Expected YYYY-MM-DD.', 400, 'INVALID_DATE');
  }

  // Validate time format HH:mm
  if (!/^\d{2}:\d{2}$/.test(timeStr)) {
    throw new AppError('Invalid time format. Expected HH:mm.', 400, 'INVALID_TIME');
  }

  const [year, month, day] = dateStr.split('-').map((v) => parseInt(v, 10));
  const [hour, minute] = timeStr.split(':').map((v) => parseInt(v, 10));

  const startDt = DateTime.fromObject(
    { year, month, day, hour, minute, second: 0, millisecond: 0 },
    { zone: IST_ZONE }
  );

  if (!startDt.isValid) {
    throw new AppError('Invalid calendar date or time.', 400, 'INVALID_DATETIME');
  }

  const endDt = startDt.plus({ minutes: stayDurationMinutes });

  // Generate 30-min discrete slot intervals during the stay window
  // e.g. 19:00 stay duration 90 min => [19:00, 19:30, 20:00]. 20:30 is NOT locked.
  const slotStarts: Date[] = [];
  let slotCursor = startDt;
  while (slotCursor < endDt) {
    slotStarts.push(slotCursor.toUTC().toJSDate());
    slotCursor = slotCursor.plus({ minutes: reservationSettings.slotIntervalMinutes });
  }

  return {
    startAt: startDt.toUTC().toJSDate(),
    endAt: endDt.toUTC().toJSDate(),
    localDate: startDt.toFormat('yyyy-MM-dd'),
    slotStarts,
  };
};

/**
 * Validates advance booking window, lead time, and opening hours.
 */
export const validateBookingTimeRules = (
  startAt: Date,
  now: Date = new Date(),
  options: { isStaffOverride?: boolean } = {}
): void => {
  const startDt = DateTime.fromJSDate(startAt, { zone: IST_ZONE });
  const nowDt = DateTime.fromJSDate(now, { zone: IST_ZONE });

  // 1. Must not be in the past
  if (startDt <= nowDt) {
    throw new AppError('Reservation cannot be booked for a past time.', 400, 'TIME_IN_PAST');
  }

  // 2. Lead time enforcement (unless staff override)
  if (!options.isStaffOverride) {
    const minLeadDt = nowDt.plus({ minutes: reservationSettings.minLeadMinutes });
    if (startDt < minLeadDt) {
      throw new AppError(
        `Bookings require at least ${reservationSettings.minLeadMinutes} minutes advance notice.`,
        400,
        'INSUFFICIENT_LEAD_TIME'
      );
    }
  }

  // 3. Max advance days enforcement
  const maxAdvanceDt = nowDt.plus({ days: reservationSettings.maxAdvanceDays }).endOf('day');
  if (startDt > maxAdvanceDt) {
    throw new AppError(
      `Bookings are only accepted up to ${reservationSettings.maxAdvanceDays} days in advance.`,
      400,
      'EXCEEDS_MAX_ADVANCE'
    );
  }

  // 4. Must align with slot interval (minutes 0 or 30)
  if (startDt.minute % reservationSettings.slotIntervalMinutes !== 0 || startDt.second !== 0) {
    throw new AppError(
      `Booking times must be aligned to ${reservationSettings.slotIntervalMinutes}-minute intervals.`,
      400,
      'INVALID_SLOT_ALIGNMENT'
    );
  }

  // 5. Operating hours check
  const [openH, openM] = reservationSettings.openTime.split(':').map((v) => parseInt(v, 10));
  const [closeH, closeM] = reservationSettings.closeTime.split(':').map((v) => parseInt(v, 10));

  const dayOpenDt = startDt.set({ hour: openH, minute: openM, second: 0 });
  const dayCloseDt = startDt.set({ hour: closeH, minute: closeM, second: 0 });
  const lastBookingDt = dayCloseDt.minus({
    minutes: reservationSettings.lastBookingBeforeCloseMinutes,
  });

  if (startDt < dayOpenDt || startDt > lastBookingDt) {
    throw new AppError(
      `Bookings are only accepted between ${reservationSettings.openTime} and ${lastBookingDt.toFormat('HH:mm')} IST.`,
      400,
      'OUTSIDE_OPERATING_HOURS'
    );
  }
};

/**
 * Normalizes Indian phone numbers to E.164 (+91XXXXXXXXXX).
 * Accepts:
 *   - 10 digits: "9876543210" -> "+919876543210"
 *   - Leading zero: "09876543210" -> "+919876543210"
 *   - Country code 91: "919876543210" -> "+919876543210"
 *   - Full E.164: "+919876543210" -> "+919876543210"
 */
export const normalizeIndianPhone = (rawPhone: string): string => {
  if (!rawPhone || typeof rawPhone !== 'string') {
    throw new AppError('Phone number is required.', 400, 'INVALID_PHONE');
  }

  // Strip spaces, dashes, parentheses
  const cleaned = rawPhone.replace(/[\s\-()]/g, '');

  let tenDigit = '';
  if (/^[6-9]\d{9}$/.test(cleaned)) {
    tenDigit = cleaned;
  } else if (/^0[6-9]\d{9}$/.test(cleaned)) {
    tenDigit = cleaned.slice(1);
  } else if (/^91[6-9]\d{9}$/.test(cleaned)) {
    tenDigit = cleaned.slice(2);
  } else if (/^\+91[6-9]\d{9}$/.test(cleaned)) {
    tenDigit = cleaned.slice(3);
  } else {
    throw new AppError(
      'Invalid Indian mobile phone number. Must be a valid 10-digit number starting with 6, 7, 8, or 9.',
      400,
      'INVALID_PHONE'
    );
  }

  return `+91${tenDigit}`;
};

/**
 * Masks phone number for safe logging and audit records (+91 98***00000).
 */
export const maskPhone = (phone: string): string => {
  if (!phone || phone.length < 10) return '***';
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10) {
    const last10 = digits.slice(-10);
    return `+91 ${last10.slice(0, 2)}***${last10.slice(-4)}`;
  }
  return `${phone.slice(0, 3)}***`;
};

/**
 * Generates an unambiguous booking reference code: "GZ-" + 6 random characters.
 * Example: "GZ-7K9MWX"
 */
export const generateReservationCode = (): string => {
  let result = 'GZ-';
  for (let i = 0; i < 6; i++) {
    const randomIndex = crypto.randomInt(0, CODE_ALPHABET.length);
    result += CODE_ALPHABET[randomIndex];
  }
  return result;
};
