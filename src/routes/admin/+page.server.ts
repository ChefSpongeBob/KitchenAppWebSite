import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
  loadAdminAssignableUsers,
  approveUser,
  approveWhiteboard,
  cleanupExpiredRejectedWhiteboardIdeas,
  createTodo,
  deleteUser,
  deleteTodo,
  deleteWhiteboard,
  denyUser,
  loadAdminAnnouncement,
  loadAdminEmployeeSpotlight,
  loadAdminNodeNames,
  loadAdminTodos,
  loadAdminWhiteboardIdeas,
  rejectWhiteboard,
  makeUserAdmin,
  requireAdmin,
  saveAnnouncement,
  saveEmployeeSpotlight,
  toggleSpecialsAccess,
  usersHasIsActiveColumn
} from '$lib/server/admin';
import {
  appFeatureDefinitions,
  canRoleAccessFeature,
  type AppFeatureKey,
  type AppFeatureMode,
  buildFeatureAccess,
  defaultAppFeatureModes
} from '$lib/features/appFeatures';
import { isFirstOpenTourComplete, markFirstOpenTourComplete } from '$lib/server/userPreferences';

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

function unixTimestamp(date: Date) {
  return Math.floor(date.getTime() / 1000);
}

function dayLabel(dayIso: string) {
  return new Date(`${dayIso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export const load: PageServerLoad = async ({ locals, url }) => {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  const guidedQuery = url.searchParams.get('guided') === '1';
  const guidedAuto = db && locals.userId
    ? !(await isFirstOpenTourComplete(db, locals.userId, 'admin_dashboard'))
    : false;
  const guided = guidedQuery || guidedAuto;
  const featureModes = locals.featureModes ?? defaultAppFeatureModes;
  const featureAccess = buildFeatureAccess(featureModes, 'admin');
  const windowDays = parseWindow(url.searchParams.get('window'));
  const todayDate = startOfDay();
  const startDate = addDays(todayDate, -(windowDays - 1));
  const endExclusiveDate = addDays(todayDate, 1);
  const prevStartDate = addDays(startDate, -windowDays);
  const prevEndExclusiveDate = startDate;
  const startIso = isoDate(startDate);
  const endIso = isoDate(todayDate);
  const startTs = unixTimestamp(startDate);
  const endExclusiveTs = unixTimestamp(endExclusiveDate);
  const prevStartTs = unixTimestamp(prevStartDate);
  const prevEndExclusiveTs = unixTimestamp(prevEndExclusiveDate);
  const dayKeys = Array.from({ length: windowDays }, (_, index) => isoDate(addDays(startDate, index)));

  if (!db) {
    return {
      guided,
      todos: [],
      users: [],
      nodeNames: [],
      whiteboardIdeas: [],
      announcement: { content: '', updatedAt: 0 },
      employeeSpotlight: { employeeName: '', shoutout: '', updatedAt: 0 },
      featureAccess,
      featureModes,
      analytics: {
        windowDays,
        staffingSeries: dayKeys.map((day) => ({ day, label: dayLabel(day), staffed: 0, target: 0 })),
        todoSeries: dayKeys.map((day) => ({ day, label: dayLabel(day), created: 0, completed: 0, open: 0 })),
        tempSeries: dayKeys.map((day) => ({ day, label: dayLabel(day), avgTemp: 0, highCount: 0 })),
        featureStatus: appFeatureDefinitions.map((feature) => ({
          key: feature.key,
          label: feature.label,
          mode: featureModes[feature.key],
          live: featureModes[feature.key] !== 'off'
        })),
        kpis: {
          staffing: { value: 0, delta: 0 },
          throughput: { value: 0, delta: 0 },
          anomalies: { value: 0, delta: 0 },
          nodes: { value: 0, delta: 0 }
        },
        commandFeed: [
          { title: 'Database', detail: 'Database is not configured.', tone: 'warn' as const },
          { title: 'App Editor', detail: 'Feature controls are ready.', tone: 'ok' as const }
        ]
      },
      summary: {
        pendingUsers: 0,
        pendingIdeas: 0,
        staffedEmployees: 0,
        todoActive: 0,
        todoCompleted: 0,
        nodesOperational: 0,
        nodesTracked: 0
      }
    };
  }

  const businessId = locals.businessId ?? '';
  await cleanupExpiredRejectedWhiteboardIdeas(db, businessId);

  const [todos, users, nodeNames, whiteboardIdeas, announcement, employeeSpotlight, hasIsActive] = await Promise.all([
    featureAccess.todo ? loadAdminTodos(db, businessId) : Promise.resolve([]),
    locals.businessId ? loadAdminAssignableUsers(db, locals.businessId) : Promise.resolve([]),
    featureAccess.temps ? loadAdminNodeNames(db, businessId) : Promise.resolve([]),
    featureAccess.whiteboard ? loadAdminWhiteboardIdeas(db, businessId) : Promise.resolve([]),
    featureAccess.announcements
      ? loadAdminAnnouncement(db, businessId)
      : Promise.resolve({ content: '', updatedAt: 0 }),
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

  const todoActive = todos.filter((todo) => !todo.completed_at).length;
  const todoCompleted = todos.length - todoActive;
  const pendingIdeas = whiteboardIdeas.filter((idea) => idea.status === 'pending').length;
  const nodesTracked = nodeNames.length;
  let staffedEmployees = 0;
  if (featureAccess.scheduling) {
    const today = isoDate();
    try {
      staffedEmployees =
        (
          await db
            .prepare(
              `
              SELECT COUNT(DISTINCT s.user_id) AS count
              FROM schedule_shifts s
              JOIN users u ON u.id = s.user_id
              WHERE s.shift_date = ?
                AND s.business_id = ?
                ${hasIsActive ? 'AND COALESCE(u.is_active, 1) = 1' : ''}
              `
            )
            .bind(today, businessId)
            .first<{ count: number }>()
        )?.count ?? 0;
    } catch {
      staffedEmployees = 0;
    }
  }

  const telemetryCutoff = Math.floor(Date.now() / 1000) - 15 * 60;
  let nodesOperational = 0;
  if (featureAccess.temps) {
    try {
      nodesOperational =
        (
          await db
            .prepare(`SELECT COUNT(DISTINCT sensor_id) AS count FROM temps WHERE ts >= ? AND business_id = ?`)
            .bind(telemetryCutoff, businessId)
            .first<{ count: number }>()
        )?.count ?? 0;
    } catch {
      nodesOperational = 0;
    }
  }

  const staffingByDay = new Map<string, number>(dayKeys.map((day) => [day, 0]));
  const staffingTarget = users.length;
  if (featureAccess.scheduling) {
    try {
      const rows = await db
        .prepare(
          `
          SELECT s.shift_date AS day, COUNT(DISTINCT s.user_id) AS staffed
          FROM schedule_shifts s
          JOIN users u ON u.id = s.user_id
          WHERE s.shift_date BETWEEN ? AND ?
            AND s.business_id = ?
            ${hasIsActive ? 'AND COALESCE(u.is_active, 1) = 1' : ''}
          GROUP BY s.shift_date
          `
        )
        .bind(startIso, endIso, businessId)
        .all<{ day: string; staffed: number }>();
      for (const row of rows.results ?? []) {
        if (staffingByDay.has(row.day)) staffingByDay.set(row.day, row.staffed ?? 0);
      }
    } catch {
      // Keep defaults when schedule tables are unavailable.
    }
  }
  const staffingSeries = dayKeys.map((day) => ({
    day,
    label: dayLabel(day),
    staffed: staffingByDay.get(day) ?? 0,
    target: staffingTarget
  }));

  const todoCreatedByDay = new Map<string, number>(dayKeys.map((day) => [day, 0]));
  const todoCompletedByDay = new Map<string, number>(dayKeys.map((day) => [day, 0]));
  let startingOpenTodos = 0;
  let completedPreviousWindow = 0;
  if (featureAccess.todo) {
    try {
      const [createdRows, completedRows, createdBefore, completedBefore, completedPrev] = await Promise.all([
        db
          .prepare(
            `
            SELECT date(created_at, 'unixepoch') AS day, COUNT(*) AS count
            FROM todos
            WHERE created_at >= ? AND created_at < ?
              AND business_id = ?
            GROUP BY date(created_at, 'unixepoch')
            `
          )
          .bind(startTs, endExclusiveTs, businessId)
          .all<{ day: string; count: number }>(),
        db
          .prepare(
            `
            SELECT date(completed_at, 'unixepoch') AS day, COUNT(*) AS count
            FROM todos
            WHERE completed_at IS NOT NULL
              AND completed_at >= ? AND completed_at < ?
              AND business_id = ?
            GROUP BY date(completed_at, 'unixepoch')
            `
          )
          .bind(startTs, endExclusiveTs, businessId)
          .all<{ day: string; count: number }>(),
        db
          .prepare(`SELECT COUNT(*) AS count FROM todos WHERE created_at < ? AND business_id = ?`)
          .bind(startTs, businessId)
          .first<{ count: number }>(),
        db
          .prepare(`SELECT COUNT(*) AS count FROM todos WHERE completed_at IS NOT NULL AND completed_at < ? AND business_id = ?`)
          .bind(startTs, businessId)
          .first<{ count: number }>(),
        db
          .prepare(
            `
            SELECT COUNT(*) AS count
            FROM todos
            WHERE completed_at IS NOT NULL
              AND completed_at >= ? AND completed_at < ?
              AND business_id = ?
            `
          )
          .bind(prevStartTs, prevEndExclusiveTs, businessId)
          .first<{ count: number }>()
      ]);

      for (const row of createdRows.results ?? []) {
        if (todoCreatedByDay.has(row.day)) todoCreatedByDay.set(row.day, row.count ?? 0);
      }
      for (const row of completedRows.results ?? []) {
        if (todoCompletedByDay.has(row.day)) todoCompletedByDay.set(row.day, row.count ?? 0);
      }

      const createdBeforeCount = createdBefore?.count ?? 0;
      const completedBeforeCount = completedBefore?.count ?? 0;
      startingOpenTodos = Math.max(createdBeforeCount - completedBeforeCount, 0);
      completedPreviousWindow = completedPrev?.count ?? 0;
    } catch {
      // Keep defaults when todo table is unavailable.
    }
  }
  let runningOpen = startingOpenTodos;
  const todoSeries = dayKeys.map((day) => {
    const created = todoCreatedByDay.get(day) ?? 0;
    const completed = todoCompletedByDay.get(day) ?? 0;
    runningOpen = Math.max(runningOpen + created - completed, 0);
    return {
      day,
      label: dayLabel(day),
      created,
      completed,
      open: runningOpen
    };
  });
  const completedCurrentWindow = todoSeries.reduce((sum, point) => sum + point.completed, 0);

  const tempByDay = new Map<string, { avgTemp: number; highCount: number }>(
    dayKeys.map((day) => [day, { avgTemp: 0, highCount: 0 }])
  );
  let previousWindowAnomalies = 0;
  if (featureAccess.temps) {
    try {
      const [tempRows, prevAnomalies] = await Promise.all([
        db
          .prepare(
            `
            SELECT
              date(ts, 'unixepoch') AS day,
              AVG(temperature) AS avg_temp,
              SUM(CASE WHEN temperature >= 42 THEN 1 ELSE 0 END) AS high_count
            FROM temps
            WHERE ts >= ? AND ts < ?
              AND business_id = ?
            GROUP BY date(ts, 'unixepoch')
            `
          )
          .bind(startTs, endExclusiveTs, businessId)
          .all<{ day: string; avg_temp: number; high_count: number }>(),
        db
          .prepare(
            `
            SELECT SUM(CASE WHEN temperature >= 42 THEN 1 ELSE 0 END) AS count
            FROM temps
            WHERE ts >= ? AND ts < ?
              AND business_id = ?
            `
          )
          .bind(prevStartTs, prevEndExclusiveTs, businessId)
          .first<{ count: number | null }>()
      ]);

      for (const row of tempRows.results ?? []) {
        if (!tempByDay.has(row.day)) continue;
        tempByDay.set(row.day, {
          avgTemp: Number((row.avg_temp ?? 0).toFixed(1)),
          highCount: row.high_count ?? 0
        });
      }
      previousWindowAnomalies = prevAnomalies?.count ?? 0;
    } catch {
      // Keep defaults when temps table is unavailable.
    }
  }
  const tempSeries = dayKeys.map((day) => ({
    day,
    label: dayLabel(day),
    avgTemp: tempByDay.get(day)?.avgTemp ?? 0,
    highCount: tempByDay.get(day)?.highCount ?? 0
  }));
  const anomalyCurrentWindow = tempSeries.reduce((sum, point) => sum + point.highCount, 0);

  const yesterdayIso = isoDate(addDays(todayDate, -1));
  const staffedYesterday = staffingByDay.get(yesterdayIso) ?? 0;
  const nodeDelta = nodesOperational - Math.max(nodesTracked === 0 ? 0 : staffedYesterday, 0);
  const hiddenFeatures = appFeatureDefinitions.filter((feature) => featureModes[feature.key] === 'off').length;
  const adminOnlyFeatures = appFeatureDefinitions.filter((feature) => featureModes[feature.key] === 'admin').length;

  const commandFeed = [
    featureAccess.scheduling
      ? {
          title: 'Schedule Coverage',
          detail: `${staffedEmployees} staffed today against ${staffingTarget} available.`,
          tone: staffedEmployees < Math.max(1, Math.ceil(staffingTarget * 0.55)) ? ('warn' as const) : ('ok' as const)
        }
      : { title: 'Schedule Module', detail: 'Scheduling is hidden in App Editor.', tone: 'muted' as const },
    featureAccess.todo
      ? {
          title: 'ToDo Throughput',
          detail: `${completedCurrentWindow} completed in the last ${windowDays} day${windowDays === 1 ? '' : 's'}.`,
          tone: completedCurrentWindow === 0 ? ('warn' as const) : ('ok' as const)
        }
      : { title: 'ToDo Module', detail: 'ToDo is hidden in App Editor.', tone: 'muted' as const },
    featureAccess.temps
      ? {
          title: 'Temp Stability',
          detail: `${anomalyCurrentWindow} high-temp readings this window.`,
          tone: anomalyCurrentWindow > 0 ? ('warn' as const) : ('ok' as const)
        }
      : { title: 'Temps Module', detail: 'Temps is hidden in App Editor.', tone: 'muted' as const },
    {
      title: 'Feature Controls',
      detail: `${hiddenFeatures} hidden, ${adminOnlyFeatures} admin-only.`,
      tone: hiddenFeatures > 0 ? ('warn' as const) : ('ok' as const)
    }
  ];

  return {
    guided,
    todos,
    users,
    nodeNames,
    whiteboardIdeas,
    announcement,
    employeeSpotlight,
    featureAccess,
    featureModes,
    analytics: {
      windowDays,
      staffingSeries,
      todoSeries,
      tempSeries,
      featureStatus: appFeatureDefinitions.map((feature) => ({
        key: feature.key,
        label: feature.label,
        mode: featureModes[feature.key],
        live: featureModes[feature.key] !== 'off'
      })),
      kpis: {
        staffing: { value: staffedEmployees, delta: staffedEmployees - staffedYesterday },
        throughput: { value: completedCurrentWindow, delta: completedCurrentWindow - completedPreviousWindow },
        anomalies: { value: anomalyCurrentWindow, delta: anomalyCurrentWindow - previousWindowAnomalies },
        nodes: { value: nodesOperational, delta: nodeDelta }
      },
      commandFeed
    },
    summary: {
      pendingUsers,
      pendingIdeas,
      staffedEmployees,
      todoActive,
      todoCompleted,
      nodesOperational,
      nodesTracked
    }
  };
};

function adminFeatureEnabled(locals: App.Locals, featureKey: AppFeatureKey) {
  const featureModes = locals.featureModes ?? defaultAppFeatureModes;
  return canRoleAccessFeature(featureModes[featureKey] as AppFeatureMode, 'admin');
}

function blockedFeatureError(featureName: string) {
  return fail(403, { error: `${featureName} is currently hidden in App Editor.` });
}

export const actions: Actions = {
  complete_guided_tour: async ({ locals }) => {
    if (!locals.DB || !locals.userId) {
      return fail(401, { error: 'Session expired. Sign in again.' });
    }
    await markFirstOpenTourComplete(locals.DB, locals.userId, 'admin_dashboard');
    return { ok: true };
  },
  create_todo: ({ request, locals }) =>
    adminFeatureEnabled(locals, 'todo') ? createTodo(request, locals) : blockedFeatureError('ToDo'),
  delete_todo: ({ request, locals }) =>
    adminFeatureEnabled(locals, 'todo') ? deleteTodo(request, locals) : blockedFeatureError('ToDo'),
  approve_whiteboard: ({ request, locals }) =>
    adminFeatureEnabled(locals, 'whiteboard')
      ? approveWhiteboard(request, locals)
      : blockedFeatureError('Whiteboard'),
  reject_whiteboard: ({ request, locals }) =>
    adminFeatureEnabled(locals, 'whiteboard')
      ? import('$lib/server/admin').then(({ rejectWhiteboard }) => rejectWhiteboard(request, locals))
      : blockedFeatureError('Whiteboard'),
  delete_whiteboard: ({ request, locals }) =>
    adminFeatureEnabled(locals, 'whiteboard')
      ? deleteWhiteboard(request, locals)
      : blockedFeatureError('Whiteboard'),
  save_announcement: ({ request, locals }) =>
    adminFeatureEnabled(locals, 'announcements')
      ? saveAnnouncement(request, locals)
      : blockedFeatureError('Announcements'),
  save_employee_spotlight: ({ request, locals }) =>
    adminFeatureEnabled(locals, 'employee_spotlight')
      ? saveEmployeeSpotlight(request, locals)
      : blockedFeatureError('Employee Spotlight'),
  make_user_admin: ({ request, locals }) => makeUserAdmin(request, locals),
  approve_user: ({ request, locals }) => approveUser(request, locals),
  deny_user: ({ request, locals }) => denyUser(request, locals),
  delete_user: ({ request, locals }) => deleteUser(request, locals),
  toggle_specials_access: ({ request, locals }) => toggleSpecialsAccess(request, locals)
};
