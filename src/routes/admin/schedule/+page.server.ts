import type { Actions, PageServerLoad } from './$types';
import { requireAdmin } from '$lib/server/admin';
import {
  addDays,
  approveScheduleShiftOffer,
  copyPreviousScheduleWeek,
  declineScheduleShiftOffer,
  getWeekStart,
  loadScheduleAssignableUsers,
  loadScheduleSettings,
  loadScheduleShiftOffersForWeek,
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
      days: [],
      offers: [],
      settings: {
        autofillNewWeeks: false,
        roleOptionsByDepartment: {
          FOH: ['Server', 'Runner', 'Host', 'FOH MGR'],
          Sushi: ['BOH MGR', 'Roller', 'Opener', 'Sushi Prep', 'Swing'],
          Kitchen: ['BOH MGR', 'Cook', 'Dish', 'Swing']
        }
      }
    };
  }

  const [users, schedule, offers, settings] = await Promise.all([
    loadScheduleAssignableUsers(db),
    loadScheduleWeek(db, weekStart, { ensureWeek: true, userId: locals.userId ?? null }),
    loadScheduleShiftOffersForWeek(db, weekStart),
    loadScheduleSettings(db)
  ]);

  return {
    weekStart,
    prevWeekStart: addDays(weekStart, -7),
    nextWeekStart: addDays(weekStart, 7),
    users,
    week: schedule.week,
    days: schedule.days,
    offers,
    settings
  };
};

export const actions: Actions = {
  save_week: ({ request, locals }) => saveScheduleWeekDraft(request, locals),
  copy_previous_week: ({ request, locals }) => copyPreviousScheduleWeek(request, locals),
  publish_week: ({ request, locals }) => publishScheduleWeek(request, locals),
  mark_draft: ({ request, locals }) => markScheduleWeekDraft(request, locals),
  approve_offer: ({ request, locals }) => approveScheduleShiftOffer(request, locals),
  decline_offer: ({ request, locals }) => declineScheduleShiftOffer(request, locals)
};
