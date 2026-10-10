import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { isValidScheduleDepartment } from '$lib/assets/schedule';
import {
  addDays,
  cancelUserScheduleTimeOffRequest,
  cancelScheduleShiftOffer,
  createUserScheduleTimeOffRequest,
  getWeekStart,
  loadMyWeekSchedule,
  loadScheduleAssignableUsers,
  loadScheduleOpenShiftRequestsForWeek,
  loadScheduleOpenShiftsForWeek,
  loadScheduleRoleAccessByUser,
  loadScheduleRoleDefinitions,
  loadScheduleShiftOffersForWeek,
  loadUserPendingScheduleAvailabilityRequest,
  loadUserScheduleAvailability,
  loadUserScheduleTimeOffRequests,
  offerScheduleShift,
  requestScheduleOpenShift,
  requestScheduleShiftOffer,
  saveUserScheduleAvailability,
  withdrawScheduleOpenShiftRequest,
  withdrawScheduleShiftRequest
} from '$lib/server/schedules';
import { hasBusinessCapability } from '$lib/server/permissions';
import type { Actions } from './$types';

function canManageSchedule(locals: App.Locals) {
  return hasBusinessCapability(
    locals.businessRole,
    locals.businessPermissionTemplate,
    'manage_schedule',
    locals.businessCapabilities
  );
}

export const load: PageServerLoad = async ({ locals, url, depends }) => {
  depends('app:my-schedule');
  if (!locals.userId) {
    throw redirect(303, '/login');
  }
  const userId = locals.userId;

  const db = locals.DB;
  const weekStart = (url.searchParams.get('week') ?? '').trim() || getWeekStart();
  const requestedView = (url.searchParams.get('view') ?? '').trim();
  const initialView = ['week', 'pool', 'availability', 'time-off'].includes(requestedView)
    ? requestedView
    : 'week';
  if (!db) {
    return {
      userId,
      weekStart,
      prevWeekStart: addDays(weekStart, -7),
      nextWeekStart: addDays(weekStart, 7),
      week: null,
      days: [],
      offers: [],
      openShifts: [],
      openShiftRequests: [],
      employees: [],
      availability: [],
      pendingAvailability: null,
      timeOffRequests: [],
      roleAccessByUser: {},
      roleDefinitions: [],
      initialView
    };
  }

  const canManage = canManageSchedule(locals);
  const [schedule, offers, openShifts, openShiftRequests, employees, availability, pendingAvailability, timeOffRequests] = await Promise.all([
    loadMyWeekSchedule(db, weekStart, userId, locals.businessId, { publishedOnly: !canManage }),
    loadScheduleShiftOffersForWeek(db, weekStart, locals.businessId),
    loadScheduleOpenShiftsForWeek(db, weekStart, locals.businessId),
    loadScheduleOpenShiftRequestsForWeek(db, weekStart, locals.businessId),
    loadScheduleAssignableUsers(db, locals.businessId),
    loadUserScheduleAvailability(db, userId, locals.businessId),
    loadUserPendingScheduleAvailabilityRequest(db, userId, locals.businessId ?? ''),
    loadUserScheduleTimeOffRequests(db, userId, locals.businessId)
  ]);

  const currentUser = employees.find((employee) => employee.id === userId);
  const approvedDepartments = new Set(currentUser?.approvedDepartments ?? []);
  const hasPublishedWeek = schedule.week?.status === 'published';
  const [roleAccessByUser, roleDefinitions] = await Promise.all([
    loadScheduleRoleAccessByUser(db, locals.businessId ?? '', employees.map((employee) => employee.id)),
    loadScheduleRoleDefinitions(db, locals.businessId)
  ]);
  const roleDefinitionsById = new Map(roleDefinitions.map((role) => [role.id, role]));
  const canWorkRole = (userId: string, department: string, roleName: string) => {
    const access = roleAccessByUser.get(userId);
    if (!access?.restrictToSelected) return true;
    return access.roleDefinitionIds.some((roleId) => {
      const role = roleDefinitionsById.get(roleId);
      return role?.department === department && role.roleName === roleName;
    });
  };

  const visibleOffers = offers.filter(
    (offer) =>
      hasPublishedWeek &&
      isValidScheduleDepartment(offer.department) &&
      approvedDepartments.has(offer.department) &&
      canWorkRole(userId, offer.department, offer.role) &&
      (!offer.targetUserId ||
        offer.offeredByUserId === userId ||
        offer.targetUserId === userId)
  );
  const visibleOpenShifts = openShifts.filter(
    (shift) =>
      hasPublishedWeek &&
      isValidScheduleDepartment(shift.department) &&
      approvedDepartments.has(shift.department) &&
      canWorkRole(userId, shift.department, shift.role)
  );

  return {
    userId,
    weekStart,
    prevWeekStart: addDays(weekStart, -7),
    nextWeekStart: addDays(weekStart, 7),
    week: schedule.week,
    days: schedule.days,
    offers: visibleOffers,
    openShifts: visibleOpenShifts,
    openShiftRequests: hasPublishedWeek
      ? openShiftRequests.filter((request) => request.requestedByUserId === userId)
      : [],
    employees,
    availability,
    pendingAvailability,
    timeOffRequests,
    roleAccessByUser: Object.fromEntries(roleAccessByUser),
    roleDefinitions,
    initialView
  };
};

export const actions: Actions = {
  offer_shift: ({ request, locals }) => offerScheduleShift(request, locals),
  cancel_offer: ({ request, locals }) => cancelScheduleShiftOffer(request, locals),
  request_offer: ({ request, locals }) => requestScheduleShiftOffer(request, locals),
  withdraw_request: ({ request, locals }) => withdrawScheduleShiftRequest(request, locals),
  request_open_shift: ({ request, locals }) => requestScheduleOpenShift(request, locals),
  withdraw_open_shift: ({ request, locals }) => withdrawScheduleOpenShiftRequest(request, locals),
  save_availability: ({ request, locals }) => saveUserScheduleAvailability(request, locals),
  create_time_off: ({ request, locals }) => createUserScheduleTimeOffRequest(request, locals),
  cancel_time_off: ({ request, locals }) => cancelUserScheduleTimeOffRequest(request, locals)
};
