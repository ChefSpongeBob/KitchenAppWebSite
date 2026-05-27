import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import {
  addDays,
  getWeekStart,
  loadScheduleDepartmentApprovalsByUser,
  loadScheduleDepartments,
  loadScheduleWeek
} from '$lib/server/schedules';

function canManageSchedule(role: string | null | undefined) {
  return role === 'owner' || role === 'admin' || role === 'manager';
}

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
      days: [],
      isAdmin: canManageSchedule(locals.userRole),
      departments: ['General'],
      visibleDepartments: ['General']
    };
  }

  const [schedule, approvalsByUser, departments] = await Promise.all([
    loadScheduleWeek(db, weekStart, { publishedOnly: true, businessId: locals.businessId }),
    loadScheduleDepartmentApprovalsByUser(db, [locals.userId], locals.businessId),
    loadScheduleDepartments(db, locals.businessId)
  ]);

  const approvedDepartments = approvalsByUser.get(locals.userId) ?? [];
  const defaultDepartments =
    canManageSchedule(locals.userRole)
      ? [...departments]
      : approvedDepartments.filter((department) => departments.includes(department));

  return {
    weekStart,
    prevWeekStart: addDays(weekStart, -7),
    nextWeekStart: addDays(weekStart, 7),
    week: schedule.week,
    days: schedule.days,
    isAdmin: canManageSchedule(locals.userRole),
    departments,
    visibleDepartments: defaultDepartments
  };
};
