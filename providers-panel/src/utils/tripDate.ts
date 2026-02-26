/**
 * Trip date formatting utilities.
 *
 * All trip datetimes are stored in the DB as UTC.
 * The `timezone` field on the trip tells clients what IANA timezone
 * to use when displaying those datetimes to users.
 *
 * Never display trip dates in the browser/device local timezone.
 */

/**
 * Format a UTC datetime string in the trip's timezone.
 * @param utcStr  - ISO string from the API (e.g. "2025-06-01T05:00:00")
 * @param tz      - IANA timezone string (e.g. "Asia/Riyadh")
 * @param options - Intl.DateTimeFormatOptions
 */
export function formatInTripTz(
  utcStr: string,
  tz: string,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }
): string {
  if (!utcStr) return '';
  const d = new Date(utcStr.endsWith('Z') ? utcStr : utcStr + 'Z');
  return new Intl.DateTimeFormat('en-US', { ...options, timeZone: tz }).format(d);
}

/**
 * Format only the date part (no time) in the trip's timezone.
 */
export function formatDateInTripTz(utcStr: string, tz: string): string {
  return formatInTripTz(utcStr, tz, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format only the time part in the trip's timezone.
 */
export function formatTimeInTripTz(utcStr: string, tz: string): string {
  return formatInTripTz(utcStr, tz, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Returns a short label like "Jun 1 – Jun 8, 2025 (Asia/Riyadh)"
 */
export function formatTripDateRange(
  startUtc: string,
  endUtc: string,
  tz: string
): string {
  const start = formatDateInTripTz(startUtc, tz);
  const end = formatDateInTripTz(endUtc, tz);
  return `${start} – ${end}`;
}

/**
 * Returns the timezone abbreviation label, e.g. "AST" or "UTC+3"
 */
export function tzLabel(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'short',
    }).formatToParts(new Date());
    return parts.find(p => p.type === 'timeZoneName')?.value ?? tz;
  } catch {
    return tz;
  }
}
