import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { isValidScheduleDepartment } from '$lib/assets/schedule';
import {
  addDays,
  cancelScheduleShiftOffer,
  getWeekStart,
  loadMyWeekSchedule,
  loadScheduleAssignableUsers,
  loadScheduleShiftOffersForWeek,
  offerScheduleShift,
  requestScheduleShiftOffer,
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
      employees: []
    };
  }

  const [schedule, offers, employees] = await Promise.all([
    loadMyWeekSchedule(db, weekStart, locals.userId),
    loadScheduleShiftOffersForWeek(db, weekStart),
    loadScheduleAssignableUsers(db)
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
    employees
  };
};

export const actions: Actions = {
  offer_shift: ({ request, locals }) => offerScheduleShift(request, locals),
  cancel_offer: ({ request, locals }) => cancelScheduleShiftOffer(request, locals),
  request_offer: ({ request, locals }) => requestScheduleShiftOffer(request, locals),
  withdraw_request: ({ request, locals }) => withdrawScheduleShiftRequest(request, locals)
};
