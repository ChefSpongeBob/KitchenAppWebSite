import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { addDays, getWeekStart, loadScheduleWeek } from '$lib/server/schedules';

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.userId) {
    throw redirect(303, '/login');
  }

  const db = locals.DB;
  const weekStart = (url.searchParams.get('week') ?? '').trim() || getWeekStart();
  if (!db) {
    return {
      weekStart,
      prevWeekStart: addDays(weekStart, -7),
      nextWeekStart: addDays(weekStart, 7),
      week: null,
      days: []
    };
  }

  const schedule = await loadScheduleWeek(db, weekStart, { publishedOnly: true });
  return {
    weekStart,
    prevWeekStart: addDays(weekStart, -7),
    nextWeekStart: addDays(weekStart, 7),
    week: schedule.week,
    days: schedule.days
  };
};
