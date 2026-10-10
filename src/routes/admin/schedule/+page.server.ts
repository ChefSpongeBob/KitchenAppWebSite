import type { Actions, PageServerLoad } from './$types';
import {
  loadAdminUsers,
  requireAdmin,
  toggleScheduleDepartmentApproval,
  updateUserBusinessPermissions,
  updateUserCapabilityOverrides
} from '$lib/server/admin';
import {
  ALL_BUSINESS_CAPABILITIES,
  hasBusinessCapability,
  normalizeBusinessRole
} from '$lib/server/permissions';
import {
  addDays,
  applyScheduleTemplateToWeek,
  buildWeekDays,
  approveScheduleShiftOffer,
  approveScheduleAvailabilityRequest,
  approveScheduleOpenShiftRequest,
  approveScheduleTimeOffRequest,
  copyPreviousScheduleWeek,
  createScheduleDepartment,
  createScheduleOpenShift,
  createScheduleRoleDefinition,
  deleteScheduleDepartment,
  deleteScheduleOpenShift,
  deleteScheduleRoleDefinition,
  declineScheduleAvailabilityRequest,
  declineScheduleTimeOffRequest,
  declineScheduleShiftOffer,
  declineScheduleOpenShiftRequest,
  getWeekStart,
  loadScheduleAvailabilityByUser,
  loadScheduleAssignableUsers,
  loadScheduleLaborTargets,
  loadScheduleManagerDepartments,
  loadScheduleOpenShiftRequestsForWeek,
  loadScheduleOpenShiftsForWeek,
  loadPendingScheduleAvailabilityRequests,
  loadScheduleRoleDefinitions,
  loadScheduleRoleAccessByUser,
  loadScheduleSettings,
  loadScheduleShiftOffersForWeek,
  loadScheduleTemplates,
  loadScheduleTimeOffRequestsForRange,
  loadScheduleWeek,
  publishScheduleWeek,
  saveScheduleLaborTargets,
  saveScheduleTemplateFromWeek,
  saveScheduleAutofillPreference,
  saveUserScheduleRoleAccess,
  saveScheduleWeekDraft
} from '$lib/server/schedules';

export const load: PageServerLoad = async ({ locals, url, depends }) => {
  requireAdmin(locals.userRole);
  depends('app:admin-schedule');
  const db = locals.DB;
  const weekStart = (url.searchParams.get('week') ?? '').trim() || getWeekStart();
  const requestedTool = (url.searchParams.get('tool') ?? '').trim();
  const initialTool = ['approvals', 'team', 'open-shifts', 'labor', 'templates', 'setup'].includes(requestedTool)
    ? requestedTool
    : 'builder';

  if (!db) {
    return {
      weekStart,
      prevWeekStart: addDays(weekStart, -7),
      nextWeekStart: addDays(weekStart, 7),
      users: [],
      week: null,
      days: [],
      rosterUserIds: [],
      offers: [],
      openShifts: [],
      openShiftRequests: [],
      timeOffRequests: [],
      pendingAvailability: [],
      templates: [],
      laborTargets: [],
      roleDefinitions: [],
      teamUsers: [],
      roleAccessByUser: {},
      canManagePermissions: false,
      actorIsOwner: false,
      currentUserId: locals.userId ?? null,
      editableCapabilities: [],
      initialTool,
      settings: {
        autofillNewWeeks: false,
        departments: [],
        roleOptionsByDepartment: {}
      },
      availabilityByUser: {}
    };
  }

  const [users, schedule, offers, openShifts, openShiftRequests, settings, timeOffRequests, templates, laborTargets, roleDefinitions, adminUsers] = await Promise.all([
    loadScheduleAssignableUsers(db, locals.businessId),
    loadScheduleWeek(db, weekStart, { userId: locals.userId ?? null, businessId: locals.businessId }),
    loadScheduleShiftOffersForWeek(db, weekStart, locals.businessId),
    loadScheduleOpenShiftsForWeek(db, weekStart, locals.businessId),
    loadScheduleOpenShiftRequestsForWeek(db, weekStart, locals.businessId),
    loadScheduleSettings(db, locals.businessId),
    loadScheduleTimeOffRequestsForRange(db, weekStart, addDays(weekStart, 6), locals.businessId),
    loadScheduleTemplates(db, locals.businessId),
    loadScheduleLaborTargets(db, weekStart, locals.businessId),
    loadScheduleRoleDefinitions(db, locals.businessId),
    loadAdminUsers(db, locals.businessId ?? '')
  ]);
  const allowedDepartments = await loadScheduleManagerDepartments(db, locals, locals.businessId ?? '');
  const allowedDepartmentSet = new Set(allowedDepartments);
  const hasAllDepartmentAccess = settings.departments.every((department) => allowedDepartmentSet.has(department));
  const visibleUsers = users.filter((user) =>
    user.approvedDepartments.some((department) => allowedDepartmentSet.has(department))
  );
  const visibleShifts = schedule.shifts.filter((shift) => allowedDepartmentSet.has(shift.department));
  const visibleUserIds = new Set(visibleUsers.map((user) => user.id));
  const teamUsers = adminUsers.filter(
    (user) =>
      hasAllDepartmentAccess ||
      user.approved_departments.some((department) => allowedDepartmentSet.has(department))
  );
  const visibleSettings = {
    ...settings,
    departments: settings.departments.filter((department) => allowedDepartmentSet.has(department)),
    roleOptionsByDepartment: Object.fromEntries(
      Object.entries(settings.roleOptionsByDepartment).filter(([department]) =>
        allowedDepartmentSet.has(department)
      )
    )
  };

  const [availabilityByUser, pendingAvailability, roleAccessByUser] = await Promise.all([
    loadScheduleAvailabilityByUser(
      db,
      visibleUsers.map((user) => user.id),
      locals.businessId
    ),
    loadPendingScheduleAvailabilityRequests(db, locals.businessId ?? '', Array.from(visibleUserIds)),
    loadScheduleRoleAccessByUser(db, locals.businessId ?? '', teamUsers.map((user) => user.id))
  ]);

  const actorIsOwner = normalizeBusinessRole(locals.businessRole) === 'owner';
  const canManagePermissions = hasBusinessCapability(
    locals.businessRole,
    locals.businessPermissionTemplate,
    'manage_permissions',
    locals.businessCapabilities
  );

  return {
    weekStart,
    prevWeekStart: addDays(weekStart, -7),
    nextWeekStart: addDays(weekStart, 7),
    users: visibleUsers,
    week: schedule.week
      ? {
          status: schedule.week.status
        }
      : null,
    days: buildWeekDays(weekStart, visibleShifts),
    rosterUserIds: schedule.rosterUserIds.filter((userId) => visibleUserIds.has(userId)),
    offers: offers.filter((offer) => allowedDepartmentSet.has(offer.department)).map((offer) => ({
      shiftId: offer.shiftId,
      shiftDate: offer.shiftDate,
      department: offer.department,
      role: offer.role,
      detail: offer.detail,
      startTime: offer.startTime,
      endLabel: offer.endLabel,
      offeredByUserName: offer.offeredByUserName,
      offeredByUserEmail: offer.offeredByUserEmail,
      targetUserId: offer.targetUserId,
      targetUserName: offer.targetUserName,
      targetUserEmail: offer.targetUserEmail,
      requestedByUserId: offer.requestedByUserId,
      requestedByUserName: offer.requestedByUserName,
      requestedByUserEmail: offer.requestedByUserEmail
    })),
    openShifts: openShifts.filter((shift) => allowedDepartmentSet.has(shift.department)).map((shift) => ({
      id: shift.id,
      shiftDate: shift.shiftDate,
      department: shift.department,
      role: shift.role,
      startTime: shift.startTime,
      endLabel: shift.endLabel
    })),
    openShiftRequests: openShiftRequests.filter((request) => allowedDepartmentSet.has(request.department)).map((request) => ({
      requestId: request.requestId,
      requestedByUserName: request.requestedByUserName,
      requestedByUserEmail: request.requestedByUserEmail,
      status: request.status,
      shiftDate: request.shiftDate,
      department: request.department,
      role: request.role,
      detail: request.detail,
      startTime: request.startTime,
      endLabel: request.endLabel
    })),
    timeOffRequests: timeOffRequests.filter((request) => visibleUserIds.has(request.userId)).map((request) => ({
      id: request.id,
      userId: request.userId,
      userName: request.userName,
      userEmail: request.userEmail,
      startDate: request.startDate,
      endDate: request.endDate,
      note: request.note,
      status: request.status
    })),
    pendingAvailability,
    templates: templates.filter((template) =>
      allowedDepartmentSet.has(template.department) || (hasAllDepartmentAccess && !template.department)
    ).map((template) => ({
      id: template.id,
      name: template.name,
      shiftCount: template.shiftCount
    })),
    laborTargets: laborTargets.map((target) => ({
      dayDate: target.dayDate,
      projectedSales: target.projectedSales,
      targetLaborPercent: target.targetLaborPercent,
      averageHourlyRate: target.averageHourlyRate
    })),
    settings: visibleSettings,
    availabilityByUser: Object.fromEntries(availabilityByUser),
    roleDefinitions: roleDefinitions.filter((role) => allowedDepartmentSet.has(role.department)),
    teamUsers,
    roleAccessByUser: Object.fromEntries(roleAccessByUser),
    canManagePermissions,
    actorIsOwner,
    currentUserId: locals.userId ?? null,
    editableCapabilities: actorIsOwner
      ? ALL_BUSINESS_CAPABILITIES
      : (locals.businessCapabilities ?? []).filter(
          (capability) => capability !== 'admin_access' && capability !== 'manage_permissions'
        ),
    initialTool
  };
};

export const actions: Actions = {
  save_week: ({ request, locals }) => saveScheduleWeekDraft(request, locals),
  save_autofill: ({ request, locals }) => saveScheduleAutofillPreference(request, locals),
  copy_previous_week: ({ request, locals }) => copyPreviousScheduleWeek(request, locals),
  publish_week: ({ request, locals }) => publishScheduleWeek(request, locals),
  create_open_shift: ({ request, locals }) => createScheduleOpenShift(request, locals),
  delete_open_shift: ({ request, locals }) => deleteScheduleOpenShift(request, locals),
  approve_offer: ({ request, locals }) => approveScheduleShiftOffer(request, locals),
  decline_offer: ({ request, locals }) => declineScheduleShiftOffer(request, locals),
  approve_open_shift: ({ request, locals }) => approveScheduleOpenShiftRequest(request, locals),
  decline_open_shift: ({ request, locals }) => declineScheduleOpenShiftRequest(request, locals),
  approve_time_off: ({ request, locals }) => approveScheduleTimeOffRequest(request, locals),
  decline_time_off: ({ request, locals }) => declineScheduleTimeOffRequest(request, locals),
  approve_availability: ({ request, locals }) => approveScheduleAvailabilityRequest(request, locals),
  decline_availability: ({ request, locals }) => declineScheduleAvailabilityRequest(request, locals),
  save_labor_targets: ({ request, locals }) => saveScheduleLaborTargets(request, locals),
  save_template: ({ request, locals }) => saveScheduleTemplateFromWeek(request, locals),
  apply_template: ({ request, locals }) => applyScheduleTemplateToWeek(request, locals),
  create_department: ({ request, locals }) => createScheduleDepartment(request, locals),
  create_role: ({ request, locals }) => createScheduleRoleDefinition(request, locals),
  delete_department: ({ request, locals }) => deleteScheduleDepartment(request, locals),
  delete_role: ({ request, locals }) => deleteScheduleRoleDefinition(request, locals),
  update_permissions: ({ request, locals }) => updateUserBusinessPermissions(request, locals),
  update_capabilities: ({ request, locals }) => updateUserCapabilityOverrides(request, locals),
  toggle_schedule_department: ({ request, locals }) => toggleScheduleDepartmentApproval(request, locals),
  save_schedule_roles: ({ request, locals }) => saveUserScheduleRoleAccess(request, locals)
};
