export function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function normalizeTimeZone(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 80 || !/^[A-Za-z][A-Za-z0-9_+\-/]*$/.test(value.trim())) return null;
  try { return new Intl.DateTimeFormat('en-US', { timeZone: value.trim() }).resolvedOptions().timeZone; }
  catch { return null; }
}

export function getBusinessDate(timeZone = 'UTC', now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: normalizeTimeZone(timeZone) ?? 'UTC', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now);
  const value = (type: string) => parts.find(part => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function getBusinessWeekStart(timeZone = 'UTC', now = new Date()) {
  const day = new Date(`${getBusinessDate(timeZone, now)}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day.toISOString().slice(0, 10);
}

export function businessTimeZoneOptions() {
  const common = [
    ['America/New_York', 'Eastern (New York)'], ['America/Chicago', 'Central (Chicago)'],
    ['America/Denver', 'Mountain (Denver)'], ['America/Phoenix', 'Arizona (Phoenix)'],
    ['America/Los_Angeles', 'Pacific (Los Angeles)'], ['America/Anchorage', 'Alaska (Anchorage)'],
    ['America/Adak', 'Aleutian (Adak)'], ['Pacific/Honolulu', 'Hawaii (Honolulu)'],
    ['America/Puerto_Rico', 'Puerto Rico'], ['Pacific/Guam', 'Guam'],
    ['Pacific/Pago_Pago', 'American Samoa'], ['UTC', 'UTC']
  ].map(([value, label]) => ({ value, label }));
  const known = new Set(common.map(option => option.value));
  const others = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  return [...common, ...others.filter(value => !known.has(value)).map(value => ({ value, label: value.replaceAll('_', ' ') }))];
}
