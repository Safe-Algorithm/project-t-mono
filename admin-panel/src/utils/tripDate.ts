/**
 * Trip date formatting utilities.
 *
 * All trip datetimes are stored in the DB as UTC.
 * The `timezone` field on the trip tells clients what IANA timezone
 * to use when displaying those datetimes to users.
 *
 * Never display trip dates in the browser/device local timezone.
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

export function formatDateInTripTz(utcStr: string, tz: string): string {
  return formatInTripTz(utcStr, tz, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatTripDateRange(startUtc: string, endUtc: string, tz: string): string {
  return `${formatDateInTripTz(startUtc, tz)} – ${formatDateInTripTz(endUtc, tz)}`;
}

export function tzLabel(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(new Date());
    return parts.find(p => p.type === 'timeZoneName')?.value ?? tz;
  } catch {
    return tz;
  }
}
