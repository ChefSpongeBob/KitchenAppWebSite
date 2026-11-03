import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
  approveWhiteboard,
  cleanupExpiredRejectedWhiteboardIdeas,
  createAdminReminder,
  createTodo,
  deleteAdminReminder,
  deleteAnnouncementHistory,
  deleteTodo,
  deleteWhiteboard,
  loadAdminAnnouncement,
  loadAdminAnnouncementHistory,
  loadAdminAssignableUsers,
  loadAdminEmployeeSpotlight,
  loadAdminReminders,
  loadAdminTodos,
  loadAdminWhiteboardIdeas,
  rejectWhiteboard,
  requireAdmin,
  saveAnnouncement,
  saveEmployeeSpotlight,
  updateAdminReminder,
  usersHasIsActiveColumn
} from '#lib/server/admin.ts';
import {
  canRoleAccessFeature,
  type AppFeatureKey,
  type AppFeatureMode,
  buildFeatureAccess,
  defaultAppFeatureModes
} from '#lib/features/appFeatures.ts';
import { isFirstOpenTourComplete, markFirstOpenTourComplete } from '#lib/server/userPreferences.ts';
import { requireBusinessId } from '#lib/server/tenant.ts';
import { hasBusinessCapability, type BusinessCapability } from '#lib/server/permissions.ts';
import {
  countPendingScheduleRequests,
  loadScheduleAssignableUsers,
  loadScheduleManagerDepartments,
  loadScheduleSettings
} from '#lib/server/schedules.ts';
import {
  loadLatestTemperatureSnapshots,
  temperatureExceptionsFromSnapshots
} from '#lib/server/temperatureMonitoring.ts';

function isoDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseWindow(value: string | null) {
  if (value === '1') return 1;
  if (value === '30') return 30;
  return 7;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dayLabel(dayIso: string) {
  return new Date(`${dayIso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function emptyDashboard(guided: boolean, featureAccess: ReturnType<typeof buildFeatureAccess>, windowDays: number) {
  const today = startOfDay();
  const dayKeys = Array.from({ length: windowDays }, (_, index) =>
    isoDate(addDays(today, index - (windowDays - 1)))
  );
  return {
    guided,
    todos: [],
    savedReminders: [],
    users: [],
    whiteboardIdeas: [],
    announcement: { content: '', updatedAt: 0 },
    announcementHistory: [],
    employeeSpotlight: { employeeName: '', shoutout: '', updatedAt: 0 },
    featureAccess,
    workspaceAccess: {
      vendors: false,
      reports: false
    },
    analytics: {
      windowDays,
      staffingSeries: dayKeys.map((day) => ({ day, label: dayLabel(day), staffed: 0, target: 0 }))
    },
    temperatureAnomalies: [],
    summary: {
      pendingUsers: 0,
      pendingIdeas: 0,
      staffedEmployees: 0,
      todoActive: 0,
      todoCompleted: 0,
      nodesOperational: 0,
      nodesTracked: 0,
      schedulePending: 0,
      temperatureAnomalies: 0
    }
  };
}

export const load: PageServerLoad = async ({ locals, url }) => {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  const guidedRequested = url.searchParams.get('guided') === '1';
  const guidedComplete = db && locals.userId
    ? await isFirstOpenTourComplete(db, locals.userId, 'admin_dashboard')
    : true;
  const guided = guidedRequested && !guidedComplete;
  const featureModes = locals.featureModes ?? defaultAppFeatureModes;
  const featureAccess = buildFeatureAccess(
    featureModes,
    locals.businessRole ?? locals.userRole,
    locals.businessPermissionTemplate,
    locals.businessCapabilities
  );
  const windowDays = parseWindow(url.searchParams.get('window'));
  if (!db) return emptyDashboard(guided, featureAccess, windowDays);

  const businessId = requireBusinessId(locals);
  await cleanupExpiredRejectedWhiteboardIdeas(db, businessId);

  const [
    todos,
    savedReminders,
    users,
    temperatureSnapshots,
    whiteboardIdeas,
    announcement,
    announcementHistory,
    employeeSpotlight,
    hasIsActive,
  ] = await Promise.all([
    featureAccess.todo ? loadAdminTodos(db, businessId) : Promise.resolve([]),
    loadAdminReminders(db, businessId),
    loadAdminAssignableUsers(db, businessId),
    featureAccess.temps ? loadLatestTemperatureSnapshots(db, businessId, 500) : Promise.resolve([]),
    featureAccess.whiteboard ? loadAdminWhiteboardIdeas(db, businessId) : Promise.resolve([]),
    featureAccess.announcements
      ? loadAdminAnnouncement(db, businessId)
      : Promise.resolve({ content: '', updatedAt: 0 }),
    featureAccess.announcements ? loadAdminAnnouncementHistory(db, businessId) : Promise.resolve([]),
    featureAccess.employee_spotlight
      ? loadAdminEmployeeSpotlight(db, businessId)
      : Promise.resolve({ employeeName: '', shoutout: '', updatedAt: 0 }),
    usersHasIsActiveColumn(db)
  ]);

  const pendingUsers = hasIsActive
    ? (
        await db
          .prepare(
            `
            SELECT COUNT(*) AS count
            FROM business_users bu
            JOIN users u ON u.id = bu.user_id
            WHERE bu.business_id = ?
              AND (COALESCE(u.is_active, 1) != 1 OR COALESCE(bu.is_active, 1) != 1)
            `
          )
          .bind(businessId)
          .first<{ count: number }>()
      )?.count ?? 0
    : 0;

  const today = startOfDay();
  const startDate = addDays(today, -(windowDays - 1));
  const startIso = isoDate(startDate);
  const endIso = isoDate(today);
  const dayKeys = Array.from({ length: windowDays }, (_, index) => isoDate(addDays(startDate, index)));
  const staffingByDay = new Map<string, number>(dayKeys.map((day) => [day, 0]));
  let visibleScheduleUsers: Awaited<ReturnType<typeof loadScheduleAssignableUsers>> = [];
  let schedulePending = 0;

  if (featureAccess.scheduling) {
    const [scheduleUsers, allowedDepartments, scheduleSettings] = await Promise.all([
      loadScheduleAssignableUsers(db, businessId),
      loadScheduleManagerDepartments(db, locals, businessId),
      loadScheduleSettings(db, businessId)
    ]);
    const allowedDepartmentSet = new Set(allowedDepartments);
    visibleScheduleUsers = scheduleUsers.filter((user) =>
      user.approvedDepartments.some((department) => allowedDepartmentSet.has(department))
    );
    const hasAllDepartmentAccess = scheduleSettings.departments.every((department) =>
      allowedDepartmentSet.has(department)
    );
    const visibleUserIds = hasAllDepartmentAccess
      ? users.map((user) => user.id)
      : visibleScheduleUsers.map((user) => user.id);
    schedulePending = await countPendingScheduleRequests(db, businessId, visibleUserIds);

    if (allowedDepartments.length > 0) {
      const departmentPlaceholders = allowedDepartments.map(() => '?').join(', ');
      const rows = await db
        .prepare(
          `
          SELECT s.shift_date AS day, COUNT(DISTINCT s.user_id) AS staffed
          FROM schedule_shifts s
          JOIN users u ON u.id = s.user_id
          WHERE s.shift_date BETWEEN ? AND ?
            AND s.business_id = ?
            AND s.department IN (${departmentPlaceholders})
            ${hasIsActive ? 'AND COALESCE(u.is_active, 1) = 1' : ''}
          GROUP BY s.shift_date
          `
        )
        .bind(startIso, endIso, businessId, ...allowedDepartments)
        .all<{ day: string; staffed: number }>();
      for (const row of rows.results ?? []) {
        if (staffingByDay.has(row.day)) staffingByDay.set(row.day, row.staffed ?? 0);
      }
    }
  }

  const staffingTarget = visibleScheduleUsers.length;
  const staffingSeries = dayKeys.map((day) => ({
    day,
    label: dayLabel(day),
    staffed: staffingByDay.get(day) ?? 0,
    target: staffingTarget
  }));
  const staffedEmployees = staffingByDay.get(endIso) ?? 0;

  const nodesOperational = temperatureSnapshots.filter(
    (snapshot) => snapshot.connection_status === 'online'
  ).length;
  const temperatureAnomalies = temperatureExceptionsFromSnapshots(temperatureSnapshots);

  const todoActive = todos.filter((todo) => !todo.completed_at).length;
  const todoCompleted = todos.length - todoActive;
  const pendingIdeas = whiteboardIdeas.filter((idea) => idea.status === 'pending').length;

  return {
    guided,
    todos,
    savedReminders,
    users,
    whiteboardIdeas,
    announcement,
    announcementHistory,
    employeeSpotlight,
    featureAccess,
    workspaceAccess: {
      vendors:
        featureAccess.vendors &&
        hasBusinessCapability(
          locals.businessRole,
          locals.businessPermissionTemplate,
          'manage_vendors',
          locals.businessCapabilities
        ),
      reports: hasBusinessCapability(
        locals.businessRole,
        locals.businessPermissionTemplate,
        'view_reports',
        locals.businessCapabilities
      )
    },
    analytics: {
      windowDays,
      staffingSeries
    },
    temperatureAnomalies,
    summary: {
      pendingUsers,
      pendingIdeas,
      staffedEmployees,
      todoActive,
      todoCompleted,
      nodesOperational,
      nodesTracked: temperatureSnapshots.length,
      schedulePending,
      temperatureAnomalies: temperatureAnomalies.length
    }
  };
};

function adminFeatureEnabled(locals: App.Locals, featureKey: AppFeatureKey) {
  const featureModes = locals.featureModes ?? defaultAppFeatureModes;
  return canRoleAccessFeature(
    featureModes[featureKey] as AppFeatureMode,
    locals.businessRole ?? locals.userRole,
    featureKey,
    locals.businessPermissionTemplate,
    locals.businessCapabilities
  );
}

function actionCapabilityFailure(locals: App.Locals, capability: BusinessCapability) {
  return hasBusinessCapability(
    locals.businessRole,
    locals.businessPermissionTemplate,
    capability,
    locals.businessCapabilities
  )
    ? null
    : fail(403, { error: 'Permission access required.' });
}

function blockedFeatureError(featureName: string) {
  return fail(403, { error: `${featureName} is currently hidden in App Editor.` });
}

export const actions: Actions = {
  complete_guided_tour: async ({ locals }) => {
    if (!locals.DB || !locals.userId) return fail(401, { error: 'Session expired. Sign in again.' });
    await markFirstOpenTourComplete(locals.DB, locals.userId, 'admin_dashboard');
    return { ok: true };
  },
  create_todo: ({ request, locals }) =>
    actionCapabilityFailure(locals, 'manage_content') ??
    (adminFeatureEnabled(locals, 'todo') ? createTodo(request, locals) : blockedFeatureError('ToDo')),
  delete_todo: ({ request, locals }) =>
    actionCapabilityFailure(locals, 'manage_content') ??
    (adminFeatureEnabled(locals, 'todo') ? deleteTodo(request, locals) : blockedFeatureError('ToDo')),
  create_reminder: ({ request, locals }) =>
    actionCapabilityFailure(locals, 'manage_workspace') ?? createAdminReminder(request, locals),
  update_reminder: ({ request, locals }) =>
    actionCapabilityFailure(locals, 'manage_workspace') ?? updateAdminReminder(request, locals),
  delete_reminder: ({ request, locals }) =>
    actionCapabilityFailure(locals, 'manage_workspace') ?? deleteAdminReminder(request, locals),
  approve_whiteboard: ({ request, locals }) =>
    actionCapabilityFailure(locals, 'manage_content') ??
    (adminFeatureEnabled(locals, 'whiteboard')
      ? approveWhiteboard(request, locals)
      : blockedFeatureError('Whiteboard')),
  reject_whiteboard: ({ request, locals }) =>
    actionCapabilityFailure(locals, 'manage_content') ??
    (adminFeatureEnabled(locals, 'whiteboard')
      ? rejectWhiteboard(request, locals)
      : blockedFeatureError('Whiteboard')),
  delete_whiteboard: ({ request, locals }) =>
    actionCapabilityFailure(locals, 'manage_content') ??
    (adminFeatureEnabled(locals, 'whiteboard')
      ? deleteWhiteboard(request, locals)
      : blockedFeatureError('Whiteboard')),
  save_announcement: ({ request, locals }) =>
    actionCapabilityFailure(locals, 'manage_announcements') ??
    (adminFeatureEnabled(locals, 'announcements')
      ? saveAnnouncement(request, locals)
      : blockedFeatureError('Announcements')),
  delete_announcement_history: ({ request, locals }) =>
    actionCapabilityFailure(locals, 'manage_announcements') ?? deleteAnnouncementHistory(request, locals),
  save_employee_spotlight: ({ request, locals }) =>
    actionCapabilityFailure(locals, 'manage_people') ??
    (adminFeatureEnabled(locals, 'employee_spotlight')
      ? saveEmployeeSpotlight(request, locals)
      : blockedFeatureError('Employee Spotlight'))
};
