import { describe, it, expect } from 'vitest';
import {
  siteConfig,
  formatFullAddress,
  telLink,
  whatsappLink,
  isCafeOpenNow,
  getHoursSummary,
} from '@/config/siteConfig';
import {
  isOpenNow,
  formatTime12h,
  formatHoursSummary,
  WeekdayHours,
} from '@/lib/timeUtils';

describe('siteConfig and timeUtils', () => {
  it('provides single-source-of-truth configuration values', () => {
    expect(siteConfig.name).toBe('Gen-Z Cafe');
    expect(siteConfig.tagline).toBe('Your Daily Hangout');
    expect(siteConfig.phone).toBeDefined();
    expect(siteConfig.whatsapp).toBeDefined();
    expect(siteConfig.email).toBeDefined();
    expect(siteConfig.hours.monday.open).toBe('10:00');
    expect(siteConfig.hours.monday.close).toBe('23:00');
  });

  it('formats full address correctly', () => {
    const address = formatFullAddress();
    expect(address).toContain(siteConfig.address.line1);
    expect(address).toContain(siteConfig.address.city);
    expect(address).toContain(siteConfig.address.pincode);
  });

  it('generates valid telephone links', () => {
    const link = telLink();
    expect(link.startsWith('tel:+91')).toBe(true);
    expect(link).not.toContain(' ');
  });

  it('generates valid whatsapp links with encoded message', () => {
    const defaultLink = whatsappLink();
    expect(defaultLink.startsWith('https://wa.me/')).toBe(true);
    expect(defaultLink).toContain('text=');

    const customLink = whatsappLink('Hello from testing');
    expect(customLink).toContain('text=Hello%20from%20testing');
  });

  it('formats 24-hour time to 12-hour AM/PM string', () => {
    expect(formatTime12h('10:00')).toBe('10:00 AM');
    expect(formatTime12h('12:00')).toBe('12:00 PM');
    expect(formatTime12h('15:30')).toBe('3:30 PM');
    expect(formatTime12h('23:00')).toBe('11:00 PM');
    expect(formatTime12h('00:00')).toBe('12:00 AM');
  });

  it('formats hours summary string', () => {
    const summary = getHoursSummary();
    expect(summary).toBe('Daily: 10:00 AM - 11:00 PM');
    expect(formatHoursSummary(siteConfig.hours)).toBe('Daily: 10:00 AM - 11:00 PM');
  });

  it('checks isCafeOpenNow returns boolean', () => {
    expect(typeof isCafeOpenNow()).toBe('boolean');
  });

  it('accurately computes IST opening status for specific mock dates', () => {
    const testHours: WeekdayHours = {
      monday: { open: '10:00', close: '23:00' },
      tuesday: { open: '10:00', close: '23:00' },
      wednesday: { open: '10:00', close: '23:00' },
      thursday: { open: '10:00', close: '23:00' },
      friday: { open: '10:00', close: '23:00' },
      saturday: { open: '10:00', close: '23:00' },
      sunday: { open: '10:00', close: '23:00' },
    };

    // 2026-10-05 is a Monday
    // 14:00 IST = 08:30 UTC
    const mondayAfternoonUtc = new Date('2026-10-05T08:30:00Z');
    expect(isOpenNow(testHours, mondayAfternoonUtc)).toBe(true);

    // 08:00 IST = 02:30 UTC (Before 10:00 AM opening)
    const mondayMorningUtc = new Date('2026-10-05T02:30:00Z');
    expect(isOpenNow(testHours, mondayMorningUtc)).toBe(false);

    // 23:30 IST = 18:00 UTC (After 11:00 PM closing)
    const mondayLateNightUtc = new Date('2026-10-05T18:00:00Z');
    expect(isOpenNow(testHours, mondayLateNightUtc)).toBe(false);

    // Closed day check
    const hoursWithHoliday: WeekdayHours = {
      ...testHours,
      monday: { open: '10:00', close: '23:00', isClosed: true },
    };
    expect(isOpenNow(hoursWithHoliday, mondayAfternoonUtc)).toBe(false);
  });
});
