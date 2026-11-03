import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import {
  addDays,
  getWeekStart,
  loadScheduleDepartmentApprovalsByUser,
  loadScheduleDepartments,
  loadScheduleManagerDepartments,
  loadScheduleWeek
} from '#lib/server/schedules.ts';
import { hasBusinessCapability } from '#lib/server/permissions.ts';
import { requireBusinessId } from '#lib/server/tenant.ts';

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
  const canManage = canManageSchedule(locals);
  if (!db) {
    return {
      weekStart,
      prevWeekStart: addDays(weekStart, -7),
      nextWeekStart: addDays(weekStart, 7),
      week: null,
      days: [],
      isAdmin: canManage,
      departments: ['General'],
      visibleDepartments: ['General']
    };
  }

  const businessId = requireBusinessId(locals);
  const [schedule, approvalsByUser, departments, managerDepartments] = await Promise.all([
    loadScheduleWeek(db, weekStart, { publishedOnly: !canManage, businessId }),
    loadScheduleDepartmentApprovalsByUser(db, [locals.userId], businessId),
    loadScheduleDepartments(db, businessId),
    canManage
      ? loadScheduleManagerDepartments(db, locals, businessId)
      : Promise.resolve([])
  ]);

  const approvedDepartments = approvalsByUser.get(locals.userId) ?? [];
  const defaultDepartments =
    canManage
      ? managerDepartments
      : approvedDepartments.filter((department) => departments.includes(department));

  return {
    weekStart,
    prevWeekStart: addDays(weekStart, -7),
    nextWeekStart: addDays(weekStart, 7),
    week: schedule.week,
    days: schedule.days,
    isAdmin: canManage,
    departments,
    visibleDepartments: defaultDepartments
  };
};
