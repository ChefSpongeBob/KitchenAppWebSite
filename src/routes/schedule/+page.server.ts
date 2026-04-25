import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import {
  addDays,
  getWeekStart,
  loadScheduleDepartmentApprovalsByUser,
  loadScheduleDepartments,
  loadScheduleWeek
} from '$lib/server/schedules';

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
      isAdmin: locals.userRole === 'admin',
      departments: ['General'],
      visibleDepartments: ['General']
    };
  }

  const [schedule, approvalsByUser, departments] = await Promise.all([
    loadScheduleWeek(db, weekStart, { publishedOnly: true }),
    loadScheduleDepartmentApprovalsByUser(db, [locals.userId]),
    loadScheduleDepartments(db)
  ]);

  const approvedDepartments = approvalsByUser.get(locals.userId) ?? [];
  const defaultDepartments =
    locals.userRole === 'admin'
      ? [...departments]
      : approvedDepartments.filter((department) => departments.includes(department));

  return {
    weekStart,
    prevWeekStart: addDays(weekStart, -7),
    nextWeekStart: addDays(weekStart, 7),
    week: schedule.week,
    days: schedule.days,
    isAdmin: locals.userRole === 'admin',
    departments,
    visibleDepartments: defaultDepartments
  };
};
