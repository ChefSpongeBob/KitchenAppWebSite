import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { scheduleDepartments } from '$lib/assets/schedule';
import {
  addDays,
  getWeekStart,
  loadScheduleDepartmentApprovalsByUser,
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
      visibleDepartments: [...scheduleDepartments]
    };
  }

  const [schedule, approvalsByUser] = await Promise.all([
    loadScheduleWeek(db, weekStart, { publishedOnly: true }),
    loadScheduleDepartmentApprovalsByUser(db, [locals.userId])
  ]);

  const approvedDepartments = approvalsByUser.get(locals.userId) ?? [];
  const defaultDepartments =
    locals.userRole === 'admin'
      ? [...scheduleDepartments]
      : approvedDepartments.filter((department) => scheduleDepartments.includes(department));

  return {
    weekStart,
    prevWeekStart: addDays(weekStart, -7),
    nextWeekStart: addDays(weekStart, 7),
    week: schedule.week,
    days: schedule.days,
    isAdmin: locals.userRole === 'admin',
    visibleDepartments: defaultDepartments
  };
};
