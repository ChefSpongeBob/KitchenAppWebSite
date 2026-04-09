import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { isValidScheduleDepartment } from '$lib/assets/schedule';
import {
  addDays,
  cancelScheduleShiftOffer,
  cancelUserScheduleTimeOffRequest,
  createUserScheduleTimeOffRequest,
  getWeekStart,
  loadMyWeekSchedule,
  loadUserScheduleAvailability,
  loadUserScheduleTimeOffRequests,
  loadScheduleAssignableUsers,
  loadScheduleShiftOffersForWeek,
  offerScheduleShift,
  requestScheduleShiftOffer,
  saveUserScheduleAvailability,
  withdrawScheduleShiftRequest
} from '$lib/server/schedules';
import type { Actions } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
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
      employees: [],
      availability: [],
      timeOffRequests: []
    };
  }

  const [schedule, offers, employees, availability, timeOffRequests] = await Promise.all([
    loadMyWeekSchedule(db, weekStart, locals.userId),
    loadScheduleShiftOffersForWeek(db, weekStart),
    loadScheduleAssignableUsers(db),
    loadUserScheduleAvailability(db, locals.userId),
    loadUserScheduleTimeOffRequests(db, locals.userId)
  ]);

  const currentUser = employees.find((employee) => employee.id === locals.userId);
  const approvedDepartments = new Set(currentUser?.approvedDepartments ?? []);

  const visibleOffers = offers.filter(
    (offer) =>
      isValidScheduleDepartment(offer.department) &&
      approvedDepartments.has(offer.department) &&
      (!offer.targetUserId ||
        offer.offeredByUserId === locals.userId ||
        offer.targetUserId === locals.userId)
  );

  return {
    userId: locals.userId,
    weekStart,
    prevWeekStart: addDays(weekStart, -7),
    nextWeekStart: addDays(weekStart, 7),
    week: schedule.week,
      days: schedule.days,
      offers: visibleOffers,
      employees,
      availability,
      timeOffRequests
  };
};

export const actions: Actions = {
  save_availability: ({ request, locals }) => saveUserScheduleAvailability(request, locals),
  request_time_off: ({ request, locals }) => createUserScheduleTimeOffRequest(request, locals),
  cancel_time_off_request: ({ request, locals }) => cancelUserScheduleTimeOffRequest(request, locals),
  offer_shift: ({ request, locals }) => offerScheduleShift(request, locals),
  cancel_offer: ({ request, locals }) => cancelScheduleShiftOffer(request, locals),
  request_offer: ({ request, locals }) => requestScheduleShiftOffer(request, locals),
  withdraw_request: ({ request, locals }) => withdrawScheduleShiftRequest(request, locals)
};
