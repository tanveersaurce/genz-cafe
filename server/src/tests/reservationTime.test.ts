import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import {
  IST_ZONE,
  generateDailySlotTimes,
  calculateBookingInterval,
  validateBookingTimeRules,
  normalizeIndianPhone,
  maskPhone,
  generateReservationCode,
} from '../modules/reservations/reservationTime';
import { AppError } from '../utils/AppError';

describe('reservationTime utility module', () => {
  it('generates correct daily booking slots from 10:00 to 21:30', () => {
    const slots = generateDailySlotTimes();
    expect(slots[0]).toBe('10:00');
    expect(slots[slots.length - 1]).toBe('21:30');
    expect(slots).toContain('14:00');
    expect(slots).toContain('20:30');
    // Total slots from 10:00 to 21:30 (11.5 hours * 2 = 23 + 1 = 24 slots)
    expect(slots.length).toBe(24);
  });

  it('calculates 90-minute booking intervals and exactly 3 discrete 30-min slot locks', () => {
    const { startAt, endAt, localDate, slotStarts } = calculateBookingInterval('2026-10-10', '19:00', 90);

    expect(localDate).toBe('2026-10-10');
    expect(slotStarts.length).toBe(3);

    // Verify 19:00 IST in UTC is 13:30 UTC
    const startDt = DateTime.fromJSDate(startAt, { zone: IST_ZONE });
    const endDt = DateTime.fromJSDate(endAt, { zone: IST_ZONE });

    expect(startDt.toFormat('yyyy-MM-dd HH:mm')).toBe('2026-10-10 19:00');
    expect(endDt.toFormat('yyyy-MM-dd HH:mm')).toBe('2026-10-10 20:30');

    // Slot locks should be 19:00, 19:30, 20:00. 20:30 is NOT locked!
    const slotDts = slotStarts.map((s) => DateTime.fromJSDate(s, { zone: IST_ZONE }).toFormat('HH:mm'));
    expect(slotDts).toEqual(['19:00', '19:30', '20:00']);
  });

  it('enforces lead time, max advance days, and operating hours', () => {
    // Reference now: 2026-10-10 12:00 IST
    const nowDt = DateTime.fromObject({ year: 2026, month: 10, day: 10, hour: 12, minute: 0 }, { zone: IST_ZONE });
    const now = nowDt.toJSDate();

    // 1. Valid booking at 14:00 IST same day (2 hours ahead > 60 min lead)
    const validBooking = DateTime.fromObject({ year: 2026, month: 10, day: 10, hour: 14, minute: 0 }, { zone: IST_ZONE }).toJSDate();
    expect(() => validateBookingTimeRules(validBooking, now)).not.toThrow();

    // 2. Lead time violation: 12:30 IST (only 30 min ahead < 60 min lead)
    const tooSoon = DateTime.fromObject({ year: 2026, month: 10, day: 10, hour: 12, minute: 30 }, { zone: IST_ZONE }).toJSDate();
    expect(() => validateBookingTimeRules(tooSoon, now)).toThrow(AppError);
    expect(() => validateBookingTimeRules(tooSoon, now)).toThrow(/advance notice/i);

    // 3. Staff override bypasses lead time
    expect(() => validateBookingTimeRules(tooSoon, now, { isStaffOverride: true })).not.toThrow();

    // 4. Past time rejected even for staff
    const inPast = DateTime.fromObject({ year: 2026, month: 10, day: 10, hour: 11, minute: 30 }, { zone: IST_ZONE }).toJSDate();
    expect(() => validateBookingTimeRules(inPast, now, { isStaffOverride: true })).toThrow(/past time/i);

    // 5. Exceeds 30 days advance
    const tooFar = nowDt.plus({ days: 32, hours: 2 }).toJSDate();
    expect(() => validateBookingTimeRules(tooFar, now)).toThrow(/up to 30 days/i);

    // 6. Misaligned minutes (e.g. 14:15)
    const misaligned = DateTime.fromObject({ year: 2026, month: 10, day: 10, hour: 14, minute: 15 }, { zone: IST_ZONE }).toJSDate();
    expect(() => validateBookingTimeRules(misaligned, now)).toThrow(/aligned to 30-minute/i);

    // 7. Outside operating hours (08:00 IST before 10:00 opening)
    const beforeOpen = DateTime.fromObject({ year: 2026, month: 10, day: 11, hour: 8, minute: 0 }, { zone: IST_ZONE }).toJSDate();
    expect(() => validateBookingTimeRules(beforeOpen, now)).toThrow(/between 10:00 and 21:30/i);

    // 8. Outside operating hours (22:00 IST after 21:30 cutoff)
    const afterCutoff = DateTime.fromObject({ year: 2026, month: 10, day: 11, hour: 22, minute: 0 }, { zone: IST_ZONE }).toJSDate();
    expect(() => validateBookingTimeRules(afterCutoff, now)).toThrow(/between 10:00 and 21:30/i);
  });

  it('normalizes Indian phone numbers across multiple formats', () => {
    expect(normalizeIndianPhone('9876543210')).toBe('+919876543210');
    expect(normalizeIndianPhone('09876543210')).toBe('+919876543210');
    expect(normalizeIndianPhone('919876543210')).toBe('+919876543210');
    expect(normalizeIndianPhone('+919876543210')).toBe('+919876543210');
    expect(normalizeIndianPhone('+91 98765-43210')).toBe('+919876543210');
    expect(normalizeIndianPhone('(0) 98765 43210')).toBe('+919876543210');

    // Invalid numbers starting with 0-5 or wrong length
    expect(() => normalizeIndianPhone('1234567890')).toThrow(/Invalid Indian mobile phone/i);
    expect(() => normalizeIndianPhone('98765')).toThrow(/Invalid Indian mobile phone/i);
    expect(() => normalizeIndianPhone('')).toThrow(/Phone number is required/i);
  });

  it('masks phone numbers safely for logging and audit logs', () => {
    expect(maskPhone('+919876543210')).toBe('+91 98***3210');
    expect(maskPhone('9876543210')).toBe('+91 98***3210');
  });

  it('generates unambiguous booking codes matching GZ-XXXXXX format without confusing characters', () => {
    const code = generateReservationCode();
    expect(code).toMatch(/^GZ-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
    expect(code).not.toContain('0');
    expect(code).not.toContain('O');
    expect(code).not.toContain('1');
    expect(code).not.toContain('I');
  });
});
