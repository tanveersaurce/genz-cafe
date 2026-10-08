/**
 * Utilities for time and timezone calculations for Gen-Z Cafe.
 * Enforces Indian Standard Time (Asia/Kolkata, UTC+5:30) for cafe operational hours.
 */

export interface DayHours {
  open: string; // "10:00" in 24hr format
  close: string; // "23:00" in 24hr format
  isClosed?: boolean;
}

export type WeekdayKey =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export type WeekdayHours = Record<WeekdayKey, DayHours>;

export const WEEKDAYS_ORDER: WeekdayKey[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export const DAY_INDEX_TO_WEEKDAY: Record<number, WeekdayKey> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
};

/**
 * Returns the current day, hour, and minute in Indian Standard Time (IST).
 */
export function getISTDateTime(date = new Date()): {
  dayKey: WeekdayKey;
  hour: number;
  minute: number;
} {
  // Use Intl.DateTimeFormat to compute IST time precisely regardless of device timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour12: false,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
  });

  const parts = formatter.formatToParts(date);
  const partMap: Record<string, string> = {};
  for (const p of parts) {
    partMap[p.type] = p.value;
  }

  const weekdayShort = (partMap.weekday || '').toLowerCase();
  const shortToKey: Record<string, WeekdayKey> = {
    sun: 'sunday',
    mon: 'monday',
    tue: 'tuesday',
    wed: 'wednesday',
    thu: 'thursday',
    fri: 'friday',
    sat: 'saturday',
  };

  const dayKey = shortToKey[weekdayShort] || 'monday';
  // Note: hour might format as "24" in some 24hr implementations when midnight strikes, normalize to 0-23
  let hour = parseInt(partMap.hour || '0', 10);
  if (hour === 24) hour = 0;
  const minute = parseInt(partMap.minute || '0', 10);

  return { dayKey, hour, minute };
}

/**
 * Determines whether the cafe is open right now in Indian Standard Time (IST).
 * Supports overnight shifts if closing time is less than opening time.
 */
export function isOpenNow(hours: WeekdayHours, testDate?: Date): boolean {
  const { dayKey, hour, minute } = getISTDateTime(testDate);
  const todaySchedule = hours[dayKey];

  if (!todaySchedule || todaySchedule.isClosed) {
    return false;
  }

  const [openHour, openMin] = todaySchedule.open.split(':').map((v) => parseInt(v, 10));
  const [closeHour, closeMin] = todaySchedule.close.split(':').map((v) => parseInt(v, 10));

  const currentMinutes = hour * 60 + minute;
  const openMinutes = (openHour ?? 0) * 60 + (openMin ?? 0);
  const closeMinutes = (closeHour ?? 0) * 60 + (closeMin ?? 0);

  if (closeMinutes > openMinutes) {
    // Normal same-day operating window (e.g. 10:00 to 23:00)
    return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  } else {
    // Overnight window (e.g. 18:00 to 02:00 next day)
    return currentMinutes >= openMinutes || currentMinutes < closeMinutes;
  }
}

/**
 * Converts 24h format "10:00" to friendly 12h display "10:00 AM".
 */
export function formatTime12h(time24: string): string {
  const [hStr, mStr] = time24.split(':');
  const h = parseInt(hStr || '0', 10);
  const m = parseInt(mStr || '0', 10);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  const displayM = m < 10 ? `0${m}` : `${m}`;
  return `${displayH}:${displayM} ${period}`;
}

export const formatTime12 = formatTime12h;

/**
 * Formats full week hours into a concise overview string.
 */
export function formatHoursSummary(hours: WeekdayHours): string {
  const mondaySchedule = hours.monday;
  const isAllSame = WEEKDAYS_ORDER.every(
    (day) =>
      hours[day].open === mondaySchedule.open &&
      hours[day].close === mondaySchedule.close &&
      hours[day].isClosed === mondaySchedule.isClosed
  );

  if (isAllSame && !mondaySchedule.isClosed) {
    return `Daily: ${formatTime12h(mondaySchedule.open)} - ${formatTime12h(mondaySchedule.close)}`;
  }

  return `${formatTime12h(mondaySchedule.open)} - ${formatTime12h(mondaySchedule.close)}`;
}
