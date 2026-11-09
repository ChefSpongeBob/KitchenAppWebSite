import { getBusinessDate } from '#lib/timeZones.ts';

export function addReportDays(day: string, count: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

export function reportWeekStart(day: string) {
  const date = new Date(`${day}T12:00:00Z`);
  return addReportDays(day, -date.getUTCDay());
}

export function reportMonthBounds(month: string) {
  const date = new Date(`${month}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1, 0);
  return { start: `${month}-01`, end: date.toISOString().slice(0, 10) };
}

export function reportMonthForTimestamp(seconds: number, timeZone: string) {
  return getBusinessDate(timeZone, new Date(seconds * 1000)).slice(0, 7);
}
