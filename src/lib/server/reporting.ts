import { error } from '@sveltejs/kit';
import { getBusinessDate, isCalendarDate, normalizeTimeZone } from '#lib/timeZones.ts';

export type ReportOptions = {
  start?: string | null;
  end?: string | null;
  timeZone?: string;
  export?: boolean;
};

export const REPORT_EXPORT_LIMIT = 10_000;
const DAY = 86_400;
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string, kind: 'hour' | 'timestamp') {
  const key = `${timeZone}:${kind}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'shortOffset',
      ...(kind === 'timestamp' ? { year: 'numeric', month: '2-digit', day: '2-digit', second: '2-digit' } : {})
    });
    if (formatters.size >= 16) formatters.delete(formatters.keys().next().value!);
    formatters.set(key, formatter);
  }
  return formatter;
}

export function reportRowLimit(params: ReportOptions, previewLimit = 1000) {
  return (params.export ? REPORT_EXPORT_LIMIT : previewLimit) + 1;
}

export function reportRows<T extends object>(rows: T[], params: ReportOptions, previewLimit = 1000) {
  const limit = params.export ? REPORT_EXPORT_LIMIT : previewLimit;
  if (params.export && rows.length > limit) {
    error(413, 'This report is too large. Choose a shorter date range and download again.');
  }
  let estimatedBytes = 0;
  for (const row of rows) {
    for (const value of Object.values(row)) estimatedBytes += String(value ?? '').length * 3 + 3;
    if (estimatedBytes > 5 * 1024 * 1024) error(413, 'This report is too large. Choose a shorter date range and download again.');
  }
  return { rows: rows.slice(0, limit), hasMore: rows.length > limit };
}

export function reportRange(params: ReportOptions, fallbackDays: number, now = new Date()) {
  const timeZone = normalizeTimeZone(params.timeZone ?? 'UTC') ?? 'UTC';
  const today = getBusinessDate(timeZone, now);
  const fallback = new Date(`${today}T00:00:00Z`);
  fallback.setUTCDate(fallback.getUTCDate() - fallbackDays);
  const startDate = params.start || fallback.toISOString().slice(0, 10);
  const endDate = params.end || today;
  if (!isCalendarDate(startDate) || !isCalendarDate(endDate) || startDate > endDate) {
    error(400, 'Choose valid start and end dates in order.');
  }
  if ((Date.parse(endDate) - Date.parse(startDate)) / 1000 > 732 * DAY) {
    error(400, 'Choose a report range of two years or less.');
  }
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  });
  function parts(seconds: number) {
    const values = Object.fromEntries(formatter.formatToParts(new Date(seconds * 1000)).map(p => [p.type, p.value]));
    return { date: `${values.year.padStart(4, '0')}-${values.month}-${values.day}`, values };
  }
  function startOfDay(date: string) {
    const utc = Date.parse(`${date}T00:00:00Z`) / 1000;
    let low = utc - 2 * DAY;
    let high = utc + 2 * DAY;
    // Find the local date boundary, including 23/25-hour days and skipped midnights.
    while (high - low > 1) {
      const middle = Math.floor((low + high) / 2);
      if (parts(middle).date < date) low = middle;
      else high = middle;
    }
    return high;
  }
  const next = new Date(`${endDate}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const startTs = startOfDay(startDate);
  const endTs = startOfDay(next.toISOString().slice(0, 10));
  function offsetAt(seconds: number) {
    const { values } = parts(seconds);
    return Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day),
      Number(values.hour), Number(values.minute), Number(values.second)) / 1000 - seconds;
  }
  return { startDate, endDate, timeZone, startTs, endTs, offsetAt, dateAt: (seconds: number) => parts(seconds).date };
}

// Explicit offset transitions keep repeated DST hours distinct without per-reading Intl calls.
export function reportHourAt(range: ReturnType<typeof reportRange>) {
  const changes: { at: number; offset: number }[] = [];
  let previous = range.startTs;
  let offset = range.offsetAt(previous);
  const initial = offset;
  while (previous < range.endTs) {
    const next = Math.min(previous + DAY, range.endTs);
    const nextOffset = range.offsetAt(next);
    if (nextOffset !== offset) {
      let low = previous;
      let high = next;
      while (high - low > 1) {
        const middle = Math.floor((low + high) / 2);
        if (range.offsetAt(middle) === offset) low = middle;
        else high = middle;
      }
      changes.push({ at: high, offset: nextOffset });
      offset = nextOffset;
    }
    previous = next;
  }
  return (seconds: number) => {
    let current = initial;
    for (const change of changes) { if (seconds < change.at) break; current = change.offset; }
    return Math.floor((seconds + current) / 3600) * 3600 - current;
  };
}

export function reportHourLabel(seconds: number, timeZone: string) {
  return formatterFor(timeZone, 'hour').format(new Date(seconds * 1000));
}

export function reportTimestamp(value: number | null, timeZone: string) {
  if (value == null) return '';
  const values = Object.fromEntries(formatterFor(timeZone, 'timestamp').formatToParts(new Date(value * 1000)).map(p => [p.type, p.value]));
  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second} ${values.timeZoneName}`;
}
