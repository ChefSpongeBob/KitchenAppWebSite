import type { Actions, PageServerLoad } from './$types';
import { requireAdmin } from '$lib/server/admin';
import {
  addDays,
  applyScheduleTemplateToWeek,
  approveScheduleShiftOffer,
  approveScheduleOpenShiftRequest,
  approveScheduleTimeOffRequest,
  copyPreviousScheduleWeek,
  createScheduleOpenShift,
  deleteScheduleOpenShift,
  declineScheduleTimeOffRequest,
  declineScheduleShiftOffer,
  declineScheduleOpenShiftRequest,
  getWeekStart,
  loadScheduleAvailabilityByUser,
  loadScheduleAssignableUsers,
  loadScheduleLaborTargets,
  loadScheduleOpenShiftRequestsForWeek,
  loadScheduleOpenShiftsForWeek,
  loadScheduleSettings,
  loadScheduleShiftOffersForWeek,
  loadScheduleTemplates,
  loadScheduleTimeOffRequestsForRange,
  loadScheduleWeek,
  publishScheduleWeek,
  saveScheduleLaborTargets,
  saveScheduleTemplateFromWeek,
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
      openShifts: [],
      openShiftRequests: [],
      timeOffRequests: [],
      templates: [],
      laborTargets: [],
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

  const [users, schedule, offers, openShifts, openShiftRequests, settings, timeOffRequests, templates, laborTargets] = await Promise.all([
    loadScheduleAssignableUsers(db, locals.businessId),
    loadScheduleWeek(db, weekStart, { ensureWeek: true, userId: locals.userId ?? null, businessId: locals.businessId }),
    loadScheduleShiftOffersForWeek(db, weekStart, locals.businessId),
    loadScheduleOpenShiftsForWeek(db, weekStart, locals.businessId),
    loadScheduleOpenShiftRequestsForWeek(db, weekStart, locals.businessId),
    loadScheduleSettings(db, locals.businessId),
    loadScheduleTimeOffRequestsForRange(db, weekStart, addDays(weekStart, 6), locals.businessId),
    loadScheduleTemplates(db, locals.businessId),
    loadScheduleLaborTargets(db, weekStart, locals.businessId)
  ]);

  const availabilityByUser = await loadScheduleAvailabilityByUser(
    db,
    users.map((user) => user.id),
    locals.businessId
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
    openShifts,
    openShiftRequests,
    timeOffRequests,
    templates,
    laborTargets,
    settings,
    availabilityByUser: Object.fromEntries(availabilityByUser)
  };
};

export const actions: Actions = {
  save_week: ({ request, locals }) => saveScheduleWeekDraft(request, locals),
  save_autofill: ({ request, locals }) => saveScheduleAutofillPreference(request, locals),
  copy_previous_week: ({ request, locals }) => copyPreviousScheduleWeek(request, locals),
  publish_week: ({ request, locals }) => publishScheduleWeek(request, locals),
  create_open_shift: ({ request, locals }) => createScheduleOpenShift(request, locals),
  delete_open_shift: ({ request, locals }) => deleteScheduleOpenShift(request, locals),
  approve_offer: ({ request, locals }) => approveScheduleShiftOffer(request, locals),
  decline_offer: ({ request, locals }) => declineScheduleShiftOffer(request, locals),
  approve_open_shift: ({ request, locals }) => approveScheduleOpenShiftRequest(request, locals),
  decline_open_shift: ({ request, locals }) => declineScheduleOpenShiftRequest(request, locals),
  approve_time_off: ({ request, locals }) => approveScheduleTimeOffRequest(request, locals),
  decline_time_off: ({ request, locals }) => declineScheduleTimeOffRequest(request, locals),
  save_labor_targets: ({ request, locals }) => saveScheduleLaborTargets(request, locals),
  save_template: ({ request, locals }) => saveScheduleTemplateFromWeek(request, locals),
  apply_template: ({ request, locals }) => applyScheduleTemplateToWeek(request, locals)
};
