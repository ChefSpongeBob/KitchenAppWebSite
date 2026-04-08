import type { Actions, PageServerLoad } from './$types';
import { requireAdmin } from '$lib/server/admin';
import {
  addDays,
  copyPreviousScheduleWeek,
  getWeekStart,
  loadScheduleAssignableUsers,
  loadScheduleWeek,
  markScheduleWeekDraft,
  publishScheduleWeek,
  saveScheduleWeekDraft
} from '$lib/server/schedules';

export const load: PageServerLoad = async ({ locals, url }) => {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  const weekStart = (url.searchParams.get('week') ?? '').trim() || getWeekStart();

  if (!db) {
    return {
      weekStart,
      prevWeekStart: addDays(weekStart, -7),
      nextWeekStart: addDays(weekStart, 7),
      users: [],
      week: null,
      days: []
    };
  }

  const [users, schedule] = await Promise.all([
    loadScheduleAssignableUsers(db),
    loadScheduleWeek(db, weekStart, { ensureWeek: true, userId: locals.userId ?? null })
  ]);

  return {
    weekStart,
    prevWeekStart: addDays(weekStart, -7),
    nextWeekStart: addDays(weekStart, 7),
    users,
    week: schedule.week,
    days: schedule.days
  };
};

export const actions: Actions = {
  save_week: ({ request, locals }) => saveScheduleWeekDraft(request, locals),
  copy_previous_week: ({ request, locals }) => copyPreviousScheduleWeek(request, locals),
  publish_week: ({ request, locals }) => publishScheduleWeek(request, locals),
  mark_draft: ({ request, locals }) => markScheduleWeekDraft(request, locals)
};
