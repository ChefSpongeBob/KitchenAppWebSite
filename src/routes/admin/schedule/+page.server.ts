import type { Actions, PageServerLoad } from './$types';
import { requireAdmin } from '$lib/server/admin';
import {
  addDays,
  applyScheduleTemplateToWeek,
  buildWeekDays,
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
  loadScheduleManagerDepartments,
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
  const allowedDepartments = await loadScheduleManagerDepartments(db, locals, locals.businessId ?? '');
  const allowedDepartmentSet = new Set(allowedDepartments);
  const hasAllDepartmentAccess = settings.departments.every((department) => allowedDepartmentSet.has(department));
  const visibleUsers = users.filter((user) =>
    user.approvedDepartments.some((department) => allowedDepartmentSet.has(department))
  );
  const visibleShifts = schedule.shifts.filter((shift) => allowedDepartmentSet.has(shift.department));
  const visibleUserIds = new Set(visibleUsers.map((user) => user.id));
  const visibleSettings = {
    ...settings,
    departments: settings.departments.filter((department) => allowedDepartmentSet.has(department)),
    roleOptionsByDepartment: Object.fromEntries(
      Object.entries(settings.roleOptionsByDepartment).filter(([department]) =>
        allowedDepartmentSet.has(department)
      )
    )
  };

  const availabilityByUser = await loadScheduleAvailabilityByUser(
    db,
    visibleUsers.map((user) => user.id),
    locals.businessId
  );

  return {
    weekStart,
    prevWeekStart: addDays(weekStart, -7),
    nextWeekStart: addDays(weekStart, 7),
    users: visibleUsers,
    week: schedule.week
      ? {
          status: schedule.week.status
        }
      : null,
    days: buildWeekDays(weekStart, visibleShifts),
    rosterUserIds: schedule.rosterUserIds.filter((userId) => visibleUserIds.has(userId)),
    offers: offers.filter((offer) => allowedDepartmentSet.has(offer.department)).map((offer) => ({
      shiftId: offer.shiftId,
      shiftDate: offer.shiftDate,
      department: offer.department,
      role: offer.role,
      detail: offer.detail,
      startTime: offer.startTime,
      endLabel: offer.endLabel,
      offeredByUserName: offer.offeredByUserName,
      offeredByUserEmail: offer.offeredByUserEmail,
      targetUserId: offer.targetUserId,
      targetUserName: offer.targetUserName,
      targetUserEmail: offer.targetUserEmail,
      requestedByUserId: offer.requestedByUserId,
      requestedByUserName: offer.requestedByUserName,
      requestedByUserEmail: offer.requestedByUserEmail
    })),
    openShifts: openShifts.filter((shift) => allowedDepartmentSet.has(shift.department)).map((shift) => ({
      id: shift.id,
      shiftDate: shift.shiftDate,
      department: shift.department,
      role: shift.role,
      startTime: shift.startTime,
      endLabel: shift.endLabel
    })),
    openShiftRequests: openShiftRequests.filter((request) => allowedDepartmentSet.has(request.department)).map((request) => ({
      requestId: request.requestId,
      requestedByUserName: request.requestedByUserName,
      requestedByUserEmail: request.requestedByUserEmail,
      status: request.status,
      shiftDate: request.shiftDate,
      department: request.department,
      role: request.role,
      detail: request.detail,
      startTime: request.startTime,
      endLabel: request.endLabel
    })),
    timeOffRequests: timeOffRequests.filter((request) => visibleUserIds.has(request.userId)).map((request) => ({
      id: request.id,
      userId: request.userId,
      userName: request.userName,
      userEmail: request.userEmail,
      startDate: request.startDate,
      endDate: request.endDate,
      note: request.note,
      status: request.status
    })),
    templates: templates.filter((template) =>
      allowedDepartmentSet.has(template.department) || (hasAllDepartmentAccess && !template.department)
    ).map((template) => ({
      id: template.id,
      name: template.name,
      shiftCount: template.shiftCount
    })),
    laborTargets: laborTargets.map((target) => ({
      dayDate: target.dayDate,
      projectedSales: target.projectedSales,
      targetLaborPercent: target.targetLaborPercent,
      averageHourlyRate: target.averageHourlyRate
    })),
    settings: visibleSettings,
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
