import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { isValidScheduleDepartment } from '$lib/assets/schedule';
import {
  addDays,
  cancelScheduleShiftOffer,
  getWeekStart,
  loadMyWeekSchedule,
  loadScheduleAssignableUsers,
  loadScheduleOpenShiftRequestsForWeek,
  loadScheduleOpenShiftsForWeek,
  loadScheduleShiftOffersForWeek,
  offerScheduleShift,
  requestScheduleOpenShift,
  requestScheduleShiftOffer,
  withdrawScheduleOpenShiftRequest,
  withdrawScheduleShiftRequest
} from '$lib/server/schedules';
import type { Actions } from './$types';

export const load: PageServerLoad = async ({ locals, url, depends }) => {
  depends('app:my-schedule');
  if (!locals.userId) {
    throw redirect(303, '/login');
  }

  const db = locals.DB;
  const weekStart = (url.searchParams.get('week') ?? '').trim() || getWeekStart();
  if (!db) {
    return {
      userId: locals.userId,
      weekStart,
      prevWeekStart: addDays(weekStart, -7),
      nextWeekStart: addDays(weekStart, 7),
      week: null,
      days: [],
      offers: [],
      openShifts: [],
      openShiftRequests: [],
      employees: []
    };
  }

  const [schedule, offers, openShifts, openShiftRequests, employees] = await Promise.all([
    loadMyWeekSchedule(db, weekStart, locals.userId, locals.businessId),
    loadScheduleShiftOffersForWeek(db, weekStart, locals.businessId),
    loadScheduleOpenShiftsForWeek(db, weekStart, locals.businessId),
    loadScheduleOpenShiftRequestsForWeek(db, weekStart, locals.businessId),
    loadScheduleAssignableUsers(db, locals.businessId)
  ]);

  const currentUser = employees.find((employee) => employee.id === locals.userId);
  const approvedDepartments = new Set(currentUser?.approvedDepartments ?? []);
  const hasPublishedWeek = Boolean(schedule.week);

  const visibleOffers = offers.filter(
    (offer) =>
      hasPublishedWeek &&
      isValidScheduleDepartment(offer.department) &&
      approvedDepartments.has(offer.department) &&
      (!offer.targetUserId ||
        offer.offeredByUserId === locals.userId ||
        offer.targetUserId === locals.userId)
  );
  const visibleOpenShifts = openShifts.filter(
    (shift) =>
      hasPublishedWeek &&
      isValidScheduleDepartment(shift.department) &&
      approvedDepartments.has(shift.department)
  );

  return {
    userId: locals.userId,
    weekStart,
    prevWeekStart: addDays(weekStart, -7),
    nextWeekStart: addDays(weekStart, 7),
    week: schedule.week,
    days: schedule.days,
    offers: visibleOffers,
    openShifts: visibleOpenShifts,
    openShiftRequests: hasPublishedWeek
      ? openShiftRequests.filter((request) => request.requestedByUserId === locals.userId)
      : [],
    employees
  };
};

export const actions: Actions = {
  offer_shift: ({ request, locals }) => offerScheduleShift(request, locals),
  cancel_offer: ({ request, locals }) => cancelScheduleShiftOffer(request, locals),
  request_offer: ({ request, locals }) => requestScheduleShiftOffer(request, locals),
  withdraw_request: ({ request, locals }) => withdrawScheduleShiftRequest(request, locals),
  request_open_shift: ({ request, locals }) => requestScheduleOpenShift(request, locals),
  withdraw_open_shift: ({ request, locals }) => withdrawScheduleOpenShiftRequest(request, locals)
};
