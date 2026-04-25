import type { Actions, PageServerLoad } from './$types';
import { requireAdmin } from '$lib/server/admin';
import {
  addDays,
  approveScheduleShiftOffer,
  approveScheduleTimeOffRequest,
  copyPreviousScheduleWeek,
  declineScheduleTimeOffRequest,
  declineScheduleShiftOffer,
  getWeekStart,
  loadScheduleAvailabilityByUser,
  loadScheduleAssignableUsers,
  loadScheduleSettings,
  loadScheduleShiftOffersForWeek,
  loadScheduleTimeOffRequestsForRange,
  loadScheduleWeek,
  publishScheduleWeek,
  saveScheduleAutofillPreference,
  saveScheduleWeekDraft
} from '$lib/server/schedules';

export const load: PageServerLoad = async ({ locals, url, depends }) => {
  requireAdmin(locals.userRole);
  depends('app:admin-schedule');
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
      rosterUserIds: [],
      offers: [],
      timeOffRequests: [],
      settings: {
        autofillNewWeeks: false,
        departments: ['General'],
        roleOptionsByDepartment: {
          General: ['Shift']
        }
      },
      availabilityByUser: {}
    };
  }

  const [users, schedule, offers, settings, timeOffRequests] = await Promise.all([
    loadScheduleAssignableUsers(db),
    loadScheduleWeek(db, weekStart, { ensureWeek: true, userId: locals.userId ?? null }),
    loadScheduleShiftOffersForWeek(db, weekStart),
    loadScheduleSettings(db),
    loadScheduleTimeOffRequestsForRange(db, weekStart, addDays(weekStart, 6))
  ]);

  const availabilityByUser = await loadScheduleAvailabilityByUser(
    db,
    users.map((user) => user.id)
  );

  return {
    weekStart,
    prevWeekStart: addDays(weekStart, -7),
    nextWeekStart: addDays(weekStart, 7),
    users,
    week: schedule.week,
    days: schedule.days,
    rosterUserIds: schedule.rosterUserIds,
    offers,
    timeOffRequests,
    settings,
    availabilityByUser: Object.fromEntries(availabilityByUser)
  };
};

export const actions: Actions = {
  save_week: ({ request, locals }) => saveScheduleWeekDraft(request, locals),
  save_autofill: ({ request, locals }) => saveScheduleAutofillPreference(request, locals),
  copy_previous_week: ({ request, locals }) => copyPreviousScheduleWeek(request, locals),
  publish_week: ({ request, locals }) => publishScheduleWeek(request, locals),
  approve_offer: ({ request, locals }) => approveScheduleShiftOffer(request, locals),
  decline_offer: ({ request, locals }) => declineScheduleShiftOffer(request, locals),
  approve_time_off: ({ request, locals }) => approveScheduleTimeOffRequest(request, locals),
  decline_time_off: ({ request, locals }) => declineScheduleTimeOffRequest(request, locals)
};
