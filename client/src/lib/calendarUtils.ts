import { siteConfig, formatFullAddress } from '@/config/siteConfig';

export interface CalendarEventDetails {
  code: string;
  customerName: string;
  guests: number;
  dateStr: string; // YYYY-MM-DD
  timeStr: string; // HH:mm
  stayDurationMinutes?: number;
}

/**
 * Generates an RFC 5545 compliant iCalendar (.ics) string in Asia/Kolkata timezone
 * and triggers a browser file download.
 */
export const downloadIcsCalendar = (details: CalendarEventDetails): void => {
  const dateParts = details.dateStr.split('-');
  const year = dateParts[0] || '2026';
  const month = dateParts[1] || '01';
  const day = dateParts[2] || '01';

  const timeParts = details.timeStr.split(':');
  const hour = timeParts[0] || '12';
  const minute = timeParts[1] || '00';

  // Format to iCalendar local datetime: YYYYMMDDTHHMMSS
  const pad = (n: string | number) => String(n).padStart(2, '0');

  const startFormatted = `${year}${pad(month)}${pad(day)}T${pad(hour)}${pad(minute)}00`;

  // Calculate end time (default 90 min)
  const startDate = new Date(
    parseInt(year, 10),
    parseInt(month, 10) - 1,
    parseInt(day, 10),
    parseInt(hour, 10),
    parseInt(minute, 10)
  );

  const duration = details.stayDurationMinutes || 90;
  const endDate = new Date(startDate.getTime() + duration * 60 * 1000);

  const endFormatted = `${endDate.getFullYear()}${pad(endDate.getMonth() + 1)}${pad(endDate.getDate())}T${pad(endDate.getHours())}${pad(endDate.getMinutes())}00`;

  const nowFormatted = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const summary = `Reservation at ${siteConfig.name} (${details.code})`;
  const description = `Table reservation for ${details.guests} guests under ${details.customerName}. Booking Code: ${details.code}. Phone: ${siteConfig.phone}.`;
  const location = `${siteConfig.name}, ${formatFullAddress()}`;

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Gen-Z Cafe//Reservation System//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:genzcafe-${details.code}@genzcafe.in`,
    `DTSTAMP:${nowFormatted}`,
    `DTSTART;TZID=Asia/Kolkata:${startFormatted}`,
    `DTEND;TZID=Asia/Kolkata:${endFormatted}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  const icsContent = icsLines.join('\r\n');
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `gen-z-cafe-${details.code}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
