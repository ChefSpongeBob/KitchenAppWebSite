import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import {
  addDays,
  getWeekStart,
  loadScheduleDepartmentApprovalsByUser,
  loadScheduleDepartments,
  loadScheduleManagerDepartments,
  loadScheduleWeek
} from '$lib/server/schedules';
import { hasBusinessCapability } from '$lib/server/permissions';

function canManageSchedule(locals: App.Locals) {
  return hasBusinessCapability(
    locals.businessRole,
    locals.businessPermissionTemplate,
    'manage_schedule',
    locals.businessCapabilities
  );
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
      isAdmin: canManageSchedule(locals),
      departments: ['General'],
      visibleDepartments: ['General']
    };
  }

  const [schedule, approvalsByUser, departments, managerDepartments] = await Promise.all([
    loadScheduleWeek(db, weekStart, { publishedOnly: true, businessId: locals.businessId }),
    loadScheduleDepartmentApprovalsByUser(db, [locals.userId], locals.businessId),
    loadScheduleDepartments(db, locals.businessId),
    canManageSchedule(locals)
      ? loadScheduleManagerDepartments(db, locals, locals.businessId ?? '')
      : Promise.resolve([])
  ]);

  const approvedDepartments = approvalsByUser.get(locals.userId) ?? [];
  const defaultDepartments =
    canManageSchedule(locals)
      ? managerDepartments
      : approvedDepartments.filter((department) => departments.includes(department));

  return {
    weekStart,
    prevWeekStart: addDays(weekStart, -7),
    nextWeekStart: addDays(weekStart, 7),
    week: schedule.week,
    days: schedule.days,
    isAdmin: canManageSchedule(locals),
    departments,
    visibleDepartments: defaultDepartments
  };
};
