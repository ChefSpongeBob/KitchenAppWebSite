import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import {
  addDays,
  loadScheduleDepartmentApprovalsByUser,
  loadScheduleDepartments,
  loadScheduleManagerDepartments,
  loadScheduleWeek
} from '#lib/server/schedules.ts';
import { hasBusinessCapability } from '#lib/server/permissions.ts';
import { requireBusinessId } from '#lib/server/tenant.ts';
import { getBusinessWeekStart, isCalendarDate } from '#lib/timeZones.ts';

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
  const weekStart = (url.searchParams.get('week') ?? '').trim() || getBusinessWeekStart(locals.businessTimeZone);
  if (!isCalendarDate(weekStart)) error(400, 'Select a valid schedule week.');
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
  const visibleDepartmentSet = new Set(defaultDepartments);

  return {
    weekStart,
    prevWeekStart: addDays(weekStart, -7),
    nextWeekStart: addDays(weekStart, 7),
    week: schedule.week,
    days: schedule.days.map((day) => ({
      ...day,
      shifts: day.shifts.filter((shift) => visibleDepartmentSet.has(shift.department))
    })),
    isAdmin: canManage,
    departments,
    visibleDepartments: defaultDepartments
  };
};
