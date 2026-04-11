import { fail } from '@sveltejs/kit';
import {
  scheduleDepartments,
  isValidScheduleDepartment,
  scheduleRolesByDepartment,
  weekdayIndexFromDate,
  type ScheduleDepartment
} from '$lib/assets/schedule';

type DB = App.Platform['env']['DB'];

export type ScheduleWeek = {
  id: string;
  weekStart: string;
  status: 'draft' | 'published';
  publishedAt: number | null;
  updatedAt: number;
};

export type ScheduleShift = {
  id: string;
  weekId: string;
  shiftDate: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  department: string;
  role: string;
  detail: string;
  startTime: string;
  endLabel: string;
  notes: string;
  sortOrder: number;
};

export type ScheduleShiftOffer = {
  id: string;
  shiftId: string;
  weekId: string;
  shiftDate: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  department: string;
  role: string;
  detail: string;
  startTime: string;
  endLabel: string;
  notes: string;
  offeredByUserId: string;
  offeredByUserName: string | null;
  offeredByUserEmail: string;
  targetUserId: string | null;
  targetUserName: string | null;
  targetUserEmail: string | null;
  requestedByUserId: string | null;
  requestedByUserName: string | null;
  requestedByUserEmail: string | null;
  managerNote: string;
  createdAt: number;
  updatedAt: number;
};

export type ScheduleAssignableUser = {
  id: string;
  displayName: string | null;
  email: string;
  approvedDepartments: ScheduleDepartment[];
};

export type ScheduleRoleOptionsByDepartment = Record<string, string[]>;

export type ScheduleSettings = {
  autofillNewWeeks: boolean;
  departments: ScheduleDepartment[];
  roleOptionsByDepartment: ScheduleRoleOptionsByDepartment;
};

export type ScheduleRoleDefinition = {
  id: string;
  department: ScheduleDepartment;
  roleName: string;
  sortOrder: number;
};

export type UserScheduleAvailability = {
  weekday: number;
  isAvailable: boolean;
  startTime: string;
  endTime: string;
};

export type ScheduleTimeOffRequest = {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  startDate: string;
  endDate: string;
  note: string;
  status: 'pending' | 'approved' | 'declined';
  managerNote: string;
  createdAt: number;
  updatedAt: number;
  resolvedAt: number | null;
  resolvedByUserId: string | null;
};

export type ScheduleDay = {
  date: string;
  label: string;
  shifts: ScheduleShift[];
};

export type ScheduleWeekTeamMember = {
  weekId: string;
  userId: string;
  sortOrder: number;
};

type ScheduleDraftRow = {
  shiftDate: string;
  userId: string;
  department: string;
  role: string;
  detail?: string;
  startTime: string;
  endLabel?: string;
  notes?: string;
};

let scheduleSchemaEnsured = false;
let scheduleSchemaPromise: Promise<void> | null = null;

function defaultRoleOptionsByDepartment(): ScheduleRoleOptionsByDepartment {
  return Object.fromEntries(
    Object.entries(scheduleRolesByDepartment).map(([department, roles]) => [department, [...roles]])
  );
}

async function loadScheduleDepartmentsFromTable(db: DB): Promise<ScheduleDepartment[]> {
  const rows = await db
    .prepare(
      `
      SELECT name
      FROM schedule_departments
      WHERE is_active = 1
      ORDER BY sort_order ASC, name ASC
      `
    )
    .all<{ name: string }>();

  const departments = (rows.results ?? [])
    .map((row) => String(row.name ?? '').trim())
    .filter((department) => department.length > 0);

  return departments.length > 0 ? departments : [...scheduleDepartments];
}

export async function loadScheduleDepartments(db: DB): Promise<ScheduleDepartment[]> {
  await ensureScheduleSchema(db);
  return loadScheduleDepartmentsFromTable(db);
}

async function seedDefaultScheduleDepartments(db: DB) {
  const existing = await db
    .prepare(`SELECT COUNT(*) AS count FROM schedule_departments`)
    .first<{ count: number }>();
  if ((existing?.count ?? 0) > 0) return;

  const now = Math.floor(Date.now() / 1000);
  for (const [index, department] of scheduleDepartments.entries()) {
    await db
      .prepare(
        `
        INSERT INTO schedule_departments (
          id, name, sort_order, is_active, created_at, updated_at
        )
        VALUES (?, ?, ?, 1, ?, ?)
        `
      )
      .bind(crypto.randomUUID(), department, index, now, now)
      .run();
  }
}

async function seedDefaultScheduleRoles(db: DB) {
  const existing = await db
    .prepare(`SELECT COUNT(*) AS count FROM schedule_role_definitions`)
    .first<{ count: number }>();
  if ((existing?.count ?? 0) > 0) return;

  const now = Math.floor(Date.now() / 1000);
  for (const department of scheduleDepartments) {
    const roles = scheduleRolesByDepartment[department];
    for (const [index, roleName] of roles.entries()) {
      await db
        .prepare(
          `
          INSERT INTO schedule_role_definitions (
            id, department, role_name, sort_order, is_active, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, 1, ?, ?)
          `
        )
        .bind(crypto.randomUUID(), department, roleName, index, now, now)
        .run();
    }
  }
}

async function ensureOptionalColumn(db: DB, tableName: string, columnName: string, definition: string) {
  try {
    await db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`).run();
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (message.includes('duplicate column name') || message.includes('already exists')) {
      return;
    }
    throw error;
  }
}

async function seedInitialScheduleDepartmentApprovals(db: DB) {
  const existing = await db
    .prepare(`SELECT COUNT(*) AS count FROM user_schedule_departments`)
    .first<{ count: number }>();
  if ((existing?.count ?? 0) > 0) return;

  const departments = await loadScheduleDepartmentsFromTable(db);

  const activeUsers = await db
    .prepare(
      `
      SELECT id
      FROM users
      WHERE COALESCE(is_active, 1) = 1
      `
    )
    .all<{ id: string }>();

  const now = Math.floor(Date.now() / 1000);
  for (const user of activeUsers.results ?? []) {
    for (const department of departments) {
      await db
        .prepare(
          `
          INSERT INTO user_schedule_departments (user_id, department, updated_at)
          VALUES (?, ?, ?)
          `
        )
        .bind(user.id, department, now)
        .run();
    }
  }
}

function formatAssignableUserLabel(user: Pick<ScheduleAssignableUser, 'displayName' | 'email'>) {
  return user.displayName ?? user.email;
}

export async function loadScheduleDepartmentApprovalsByUser(db: DB, userIds?: string[]) {
  await ensureScheduleSchema(db);

  const requestedUserIds = userIds ? Array.from(new Set(userIds.filter((userId) => userId.length > 0))) : null;
  if (requestedUserIds && requestedUserIds.length === 0) {
    return new Map<string, ScheduleDepartment[]>();
  }

  const placeholders = requestedUserIds?.map(() => '?').join(', ');
  const rows = await db
    .prepare(
      `
      SELECT user_id, department
      FROM user_schedule_departments
      ${requestedUserIds ? `WHERE user_id IN (${placeholders})` : ''}
      ORDER BY department ASC
      `
    )
    .bind(...(requestedUserIds ?? []))
    .all<{ user_id: string; department: string }>();

  const approvals = new Map<string, ScheduleDepartment[]>();
  if (requestedUserIds) {
    for (const userId of requestedUserIds) {
      approvals.set(userId, []);
    }
  }

  for (const row of rows.results ?? []) {
    if (!isValidScheduleDepartment(row.department)) continue;
    const userApprovals = approvals.get(row.user_id) ?? [];
    userApprovals.push(row.department);
    approvals.set(row.user_id, userApprovals);
  }

  return approvals;
}

export async function loadScheduleAvailabilityByUser(db: DB, userIds?: string[]) {
  await ensureScheduleSchema(db);

  const requestedUserIds = userIds ? Array.from(new Set(userIds.filter((userId) => userId.length > 0))) : null;
  if (requestedUserIds && requestedUserIds.length === 0) {
    return new Map<string, UserScheduleAvailability[]>();
  }

  const placeholders = requestedUserIds?.map(() => '?').join(', ');
  const rows = await db
    .prepare(
      `
      SELECT user_id, weekday, is_available, start_time, end_time
      FROM user_schedule_availability
      ${requestedUserIds ? `WHERE user_id IN (${placeholders})` : ''}
      ORDER BY weekday ASC
      `
    )
    .bind(...(requestedUserIds ?? []))
    .all<{
      user_id: string;
      weekday: number;
      is_available: number;
      start_time: string;
      end_time: string;
    }>();

  const availability = new Map<string, UserScheduleAvailability[]>();
  if (requestedUserIds) {
    for (const userId of requestedUserIds) {
      availability.set(userId, []);
    }
  }

  for (const row of rows.results ?? []) {
    const userAvailability = availability.get(row.user_id) ?? [];
    userAvailability.push({
      weekday: row.weekday,
      isAvailable: row.is_available === 1,
      startTime: row.start_time,
      endTime: row.end_time
    });
    availability.set(row.user_id, userAvailability);
  }

  return availability;
}

async function loadScheduleAssignableUsersById(db: DB, userIds: string[]) {
  const requestedUserIds = Array.from(new Set(userIds.filter((userId) => userId.length > 0)));
  if (requestedUserIds.length === 0) {
    return new Map<string, ScheduleAssignableUser>();
  }

  const placeholders = requestedUserIds.map(() => '?').join(', ');
  const [rows, approvalsByUser] = await Promise.all([
    db
      .prepare(
        `
        SELECT id, display_name, email
        FROM users
        WHERE COALESCE(is_active, 1) = 1
          AND id IN (${placeholders})
        ORDER BY COALESCE(display_name, email) ASC
        `
      )
      .bind(...requestedUserIds)
      .all<{ id: string; display_name: string | null; email: string }>(),
    loadScheduleDepartmentApprovalsByUser(db, requestedUserIds)
  ]);

  const users = new Map<string, ScheduleAssignableUser>();
  for (const row of rows.results ?? []) {
    users.set(row.id, {
      id: row.id,
      displayName: row.display_name,
      email: row.email,
      approvedDepartments: approvalsByUser.get(row.id) ?? []
    });
  }

  return users;
}

type ScheduleAssignmentCandidate = {
  userId: string;
  department: ScheduleDepartment;
  shiftDate?: string;
};

async function validateScheduleAssignments(db: DB, assignments: ScheduleAssignmentCandidate[]) {
  const usersById = await loadScheduleAssignableUsersById(
    db,
    assignments.map((assignment) => assignment.userId)
  );

  for (const assignment of assignments) {
    const user = usersById.get(assignment.userId);
    const dateLabel = assignment.shiftDate ? ` on ${assignment.shiftDate}` : '';
    if (!user) {
      return `The selected employee${dateLabel} is no longer active.`;
    }
    if (!user.approvedDepartments.includes(assignment.department)) {
      return `${formatAssignableUserLabel(user)} is not approved for ${assignment.department}${dateLabel}.`;
    }
  }

  return null;
}

function isoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getWeekStart(date = new Date()) {
  const base = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = base.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  base.setDate(base.getDate() + diff);
  return isoDate(base);
}

export function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return isoDate(date);
}

export function formatDisplayDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
}

export function formatTimeLabel(value: string) {
  if (!value) return '';
  const [hours, minutes] = value.split(':').map((part) => Number(part));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value;
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  });
}

export function buildWeekDays(weekStart: string, shifts: ScheduleShift[]) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    return {
      date,
      label: formatDisplayDate(date),
      shifts: shifts
        .filter((shift) => shift.shiftDate === date)
        .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.sortOrder - b.sortOrder)
    } satisfies ScheduleDay;
  });
}

export async function ensureScheduleSchema(db: DB) {
  if (scheduleSchemaEnsured) return;
  if (scheduleSchemaPromise) {
    await scheduleSchemaPromise;
    return;
  }

  scheduleSchemaPromise = (async () => {
    await db
      .prepare(
        `
        CREATE TABLE IF NOT EXISTS schedule_weeks (
          id TEXT PRIMARY KEY,
          week_start TEXT NOT NULL UNIQUE,
          status TEXT NOT NULL DEFAULT 'draft',
          published_at INTEGER,
          updated_at INTEGER NOT NULL,
          updated_by TEXT,
          FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
        )
        `
        )
      .run();

    await db
      .prepare(
        `
        CREATE TABLE IF NOT EXISTS schedule_shift_offers (
          id TEXT PRIMARY KEY,
          shift_id TEXT NOT NULL UNIQUE,
          offered_by_user_id TEXT NOT NULL,
          target_user_id TEXT,
          requested_by_user_id TEXT,
          manager_note TEXT NOT NULL DEFAULT '',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (shift_id) REFERENCES schedule_shifts(id) ON DELETE CASCADE,
          FOREIGN KEY (offered_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL,
          FOREIGN KEY (requested_by_user_id) REFERENCES users(id) ON DELETE SET NULL
        )
        `
      )
      .run();

    await ensureOptionalColumn(db, 'schedule_shift_offers', 'target_user_id', 'TEXT');

    await db
      .prepare(
        `
        CREATE TABLE IF NOT EXISTS schedule_shifts (
          id TEXT PRIMARY KEY,
          week_id TEXT NOT NULL,
          shift_date TEXT NOT NULL,
          user_id TEXT NOT NULL,
          department TEXT NOT NULL,
          role TEXT NOT NULL,
          detail TEXT NOT NULL DEFAULT '',
          start_time TEXT NOT NULL,
          end_label TEXT NOT NULL DEFAULT '',
          notes TEXT NOT NULL DEFAULT '',
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (week_id) REFERENCES schedule_weeks(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        `
      )
      .run();

    await db
      .prepare(
        `
        CREATE TABLE IF NOT EXISTS schedule_week_team (
          week_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (week_id, user_id),
          FOREIGN KEY (week_id) REFERENCES schedule_weeks(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        `
      )
      .run();

    await db
      .prepare(
        `
        CREATE TABLE IF NOT EXISTS user_schedule_departments (
          user_id TEXT NOT NULL,
          department TEXT NOT NULL,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (user_id, department),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        `
      )
      .run();

    await db
      .prepare(
        `
        CREATE TABLE IF NOT EXISTS schedule_departments (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          sort_order INTEGER NOT NULL DEFAULT 0,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
        `
      )
      .run();

    await db
      .prepare(
        `
        CREATE TABLE IF NOT EXISTS schedule_role_definitions (
          id TEXT PRIMARY KEY,
          department TEXT NOT NULL,
          role_name TEXT NOT NULL,
          sort_order INTEGER NOT NULL DEFAULT 0,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          UNIQUE (department, role_name)
        )
        `
      )
      .run();

    await db
      .prepare(
        `
        CREATE TABLE IF NOT EXISTS schedule_preferences (
          id TEXT PRIMARY KEY,
          autofill_new_weeks INTEGER NOT NULL DEFAULT 0,
          updated_at INTEGER NOT NULL,
          updated_by TEXT,
          FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
        )
        `
      )
      .run();

    await db
      .prepare(
        `
        CREATE TABLE IF NOT EXISTS user_schedule_availability (
          user_id TEXT NOT NULL,
          weekday INTEGER NOT NULL,
          is_available INTEGER NOT NULL DEFAULT 0,
          start_time TEXT NOT NULL DEFAULT '',
          end_time TEXT NOT NULL DEFAULT '',
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (user_id, weekday),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        `
      )
      .run();

    await db
      .prepare(
        `
        CREATE TABLE IF NOT EXISTS user_schedule_time_off_requests (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          start_date TEXT NOT NULL,
          end_date TEXT NOT NULL,
          note TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'pending',
          manager_note TEXT NOT NULL DEFAULT '',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          resolved_at INTEGER,
          resolved_by_user_id TEXT,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (resolved_by_user_id) REFERENCES users(id) ON DELETE SET NULL
        )
        `
      )
      .run();

    await db
      .prepare(
        `
        CREATE INDEX IF NOT EXISTS idx_schedule_weeks_week_start
        ON schedule_weeks(week_start, status)
        `
      )
      .run();

    await db
      .prepare(
        `
        CREATE INDEX IF NOT EXISTS idx_schedule_shifts_week_date
        ON schedule_shifts(week_id, shift_date, start_time, sort_order)
        `
      )
      .run();

    await db
      .prepare(
        `
        CREATE INDEX IF NOT EXISTS idx_schedule_shifts_user_date
        ON schedule_shifts(user_id, shift_date, start_time)
        `
      )
      .run();

    await db
      .prepare(
        `
        CREATE INDEX IF NOT EXISTS idx_schedule_week_team_week_sort
        ON schedule_week_team(week_id, sort_order, user_id)
        `
      )
      .run();

    await db
      .prepare(
        `
        CREATE INDEX IF NOT EXISTS idx_schedule_shift_offers_week_request
        ON schedule_shift_offers(shift_id, target_user_id, requested_by_user_id, updated_at)
        `
      )
      .run();

    await db
      .prepare(
        `
        CREATE INDEX IF NOT EXISTS idx_user_schedule_departments_department
        ON user_schedule_departments(department, user_id)
        `
      )
      .run();

    await db
      .prepare(
        `
        CREATE INDEX IF NOT EXISTS idx_schedule_departments_order
        ON schedule_departments(sort_order, name)
        `
      )
      .run();

    await db
      .prepare(
        `
        CREATE INDEX IF NOT EXISTS idx_schedule_role_definitions_department
        ON schedule_role_definitions(department, sort_order, role_name)
        `
      )
      .run();

    await db
      .prepare(
        `
        CREATE INDEX IF NOT EXISTS idx_user_schedule_availability_user
        ON user_schedule_availability(user_id, weekday)
        `
      )
      .run();

    await db
      .prepare(
        `
        CREATE INDEX IF NOT EXISTS idx_user_schedule_time_off_requests_user
        ON user_schedule_time_off_requests(user_id, start_date, end_date, status)
        `
      )
      .run();

    await seedDefaultScheduleDepartments(db);
    await seedInitialScheduleDepartmentApprovals(db);
    await seedDefaultScheduleRoles(db);

    scheduleSchemaEnsured = true;
  })();

  try {
    await scheduleSchemaPromise;
  } catch (error) {
    scheduleSchemaPromise = null;
    throw error;
  }
}

export async function getOrCreateScheduleWeek(db: DB, weekStart: string, userId?: string | null) {
  await ensureScheduleSchema(db);

  let week = await db
    .prepare(
      `
      SELECT id, week_start, status, published_at, updated_at
      FROM schedule_weeks
      WHERE week_start = ?
      LIMIT 1
      `
    )
    .bind(weekStart)
    .first<{
      id: string;
      week_start: string;
      status: 'draft' | 'published';
      published_at: number | null;
      updated_at: number;
    }>();

  if (!week) {
    const now = Math.floor(Date.now() / 1000);
    const id = crypto.randomUUID();
    await db
      .prepare(
        `
        INSERT INTO schedule_weeks (id, week_start, status, published_at, updated_at, updated_by)
        VALUES (?, ?, 'draft', NULL, ?, ?)
        `
      )
      .bind(id, weekStart, now, userId ?? null)
      .run();

    week = {
      id,
      week_start: weekStart,
      status: 'draft',
      published_at: null,
      updated_at: now
    };
  }

  return {
    id: week.id,
    weekStart: week.week_start,
    status: week.status,
    publishedAt: week.published_at,
    updatedAt: week.updated_at
  } satisfies ScheduleWeek;
}

export async function loadScheduleRoleOptionsByDepartment(db: DB): Promise<ScheduleRoleOptionsByDepartment> {
  await ensureScheduleSchema(db);

  const [departments, defaults] = await Promise.all([
    loadScheduleDepartments(db),
    Promise.resolve(defaultRoleOptionsByDepartment())
  ]);
  const rows = await db
    .prepare(
      `
      SELECT department, role_name
      FROM schedule_role_definitions
      WHERE is_active = 1
      ORDER BY department ASC, sort_order ASC, role_name ASC
      `
    )
    .all<{ department: string; role_name: string }>();

  const configured: ScheduleRoleOptionsByDepartment = Object.fromEntries(
    departments.map((department) => [department, [] as string[]])
  );

  for (const row of rows.results ?? []) {
    if (!configured[row.department]) {
      configured[row.department] = [];
    }
    configured[row.department].push(row.role_name);
  }

  return Object.fromEntries(
    departments.map((department) => [
      department,
      configured[department].length > 0 ? configured[department] : [...(defaults[department] ?? [])]
    ])
  );
}

export async function loadScheduleSettings(db: DB): Promise<ScheduleSettings> {
  await ensureScheduleSchema(db);

  const [roleOptionsByDepartment, preferences] = await Promise.all([
    loadScheduleRoleOptionsByDepartment(db),
    db
      .prepare(
        `
        SELECT autofill_new_weeks
        FROM schedule_preferences
        WHERE id = 'default'
        LIMIT 1
        `
      )
      .first<{ autofill_new_weeks: number }>()
  ]);

  return {
    autofillNewWeeks: (preferences?.autofill_new_weeks ?? 0) === 1,
    departments: await loadScheduleDepartments(db),
    roleOptionsByDepartment
  };
}

export async function loadScheduleRoleDefinitions(db: DB): Promise<ScheduleRoleDefinition[]> {
  await ensureScheduleSchema(db);

  const rows = await db
    .prepare(
      `
      SELECT id, department, role_name, sort_order
      FROM schedule_role_definitions
      WHERE is_active = 1
      ORDER BY department ASC, sort_order ASC, role_name ASC
      `
    )
    .all<{ id: string; department: string; role_name: string; sort_order: number }>();

  return (rows.results ?? [])
    .map((row) => ({
      id: row.id,
      department: row.department,
      roleName: row.role_name,
      sortOrder: row.sort_order
    }));
}

function roleIsAllowed(
  roleOptionsByDepartment: ScheduleRoleOptionsByDepartment,
  department: ScheduleDepartment,
  role: string
) {
  return roleOptionsByDepartment[department].includes(role);
}

export async function loadScheduleWeek(
  db: DB,
  weekStart: string,
  options?: { publishedOnly?: boolean; userId?: string | null; ensureWeek?: boolean }
) {
  await ensureScheduleSchema(db);

  const publishedClause = options?.publishedOnly ? `AND status = 'published'` : '';
  let week = await db
    .prepare(
      `
      SELECT id, week_start, status, published_at, updated_at
      FROM schedule_weeks
      WHERE week_start = ?
      ${publishedClause}
      LIMIT 1
      `
    )
    .bind(weekStart)
    .first<{
      id: string;
      week_start: string;
      status: 'draft' | 'published';
      published_at: number | null;
      updated_at: number;
    }>();

  if (!week && !options?.publishedOnly && options?.ensureWeek) {
    const created = await getOrCreateScheduleWeek(db, weekStart, options.userId ?? null);
    week = {
      id: created.id,
      week_start: created.weekStart,
      status: created.status,
      published_at: created.publishedAt,
      updated_at: created.updatedAt
    };
  }

  if (!week) {
    return {
      week: null,
      shifts: [] as ScheduleShift[],
      days: buildWeekDays(weekStart, []),
      rosterUserIds: [] as string[]
    };
  }

  const rows = await db
    .prepare(
      `
      SELECT
        s.id,
        s.week_id,
        s.shift_date,
        s.user_id,
        u.display_name AS user_name,
        u.email AS user_email,
        s.department,
        s.role,
        s.detail,
        s.start_time,
        s.end_label,
        s.notes,
        s.sort_order
      FROM schedule_shifts s
      JOIN users u ON u.id = s.user_id
      WHERE s.week_id = ?
      ORDER BY s.shift_date ASC, s.start_time ASC, s.sort_order ASC, COALESCE(u.display_name, u.email) ASC
      `
    )
    .bind(week.id)
    .all<{
      id: string;
      week_id: string;
      shift_date: string;
      user_id: string;
      user_name: string | null;
      user_email: string;
      department: string;
      role: string;
      detail: string | null;
      start_time: string;
      end_label: string | null;
      notes: string | null;
      sort_order: number | null;
    }>();

  const shifts = (rows.results ?? []).map((row) => ({
    id: row.id,
    weekId: row.week_id,
    shiftDate: row.shift_date,
    userId: row.user_id,
    userName: row.user_name,
    userEmail: row.user_email,
    department: row.department,
    role: row.role,
    detail: row.detail ?? '',
    startTime: row.start_time,
    endLabel: row.end_label ?? '',
    notes: row.notes ?? '',
    sortOrder: row.sort_order ?? 0
  })) satisfies ScheduleShift[];

  const teamRows = await db
    .prepare(
      `
      SELECT user_id
      FROM schedule_week_team
      WHERE week_id = ?
      ORDER BY sort_order ASC, user_id ASC
      `
    )
    .bind(week.id)
    .all<{ user_id: string }>();

  const rosterUserIds = (teamRows.results ?? []).map((row) => String(row.user_id ?? '').trim()).filter(Boolean);
  const shiftUserIds = Array.from(new Set(shifts.map((shift) => shift.userId).filter(Boolean)));
  const mergedRosterUserIds = Array.from(new Set([...rosterUserIds, ...shiftUserIds]));

  return {
    week: {
      id: week.id,
      weekStart: week.week_start,
      status: week.status,
      publishedAt: week.published_at,
      updatedAt: week.updated_at
    } satisfies ScheduleWeek,
    shifts,
    days: buildWeekDays(week.week_start, shifts),
    rosterUserIds: mergedRosterUserIds
  };
}

export async function loadMyWeekSchedule(db: DB, weekStart: string, userId: string) {
  const result = await loadScheduleWeek(db, weekStart, { publishedOnly: true });
  return {
    week: result.week,
    shifts: result.shifts.filter((shift) => shift.userId === userId),
    days: buildWeekDays(weekStart, result.shifts.filter((shift) => shift.userId === userId))
  };
}

export async function loadTodayShifts(db: DB, userId: string, date = isoDate(new Date())) {
  await ensureScheduleSchema(db);
  const weekStart = getWeekStart(new Date(`${date}T00:00:00`));
  const schedule = await loadMyWeekSchedule(db, weekStart, userId);
  return schedule.shifts
    .filter((shift) => shift.shiftDate === date)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export async function loadScheduleShiftOffersForWeek(db: DB, weekStart: string) {
  await ensureScheduleSchema(db);
  const week = await loadScheduleWeek(db, weekStart, { publishedOnly: false });
  if (!week.week) return [];

  const rows = await db
    .prepare(
      `
      SELECT
        o.id,
        o.shift_id,
        o.offered_by_user_id,
        o.target_user_id,
        o.requested_by_user_id,
        o.manager_note,
        o.created_at,
        o.updated_at,
        s.week_id,
        s.shift_date,
        s.user_id,
        s.department,
        s.role,
        s.detail,
        s.start_time,
        s.end_label,
        s.notes,
        u.display_name AS user_name,
        u.email AS user_email,
        offered.display_name AS offered_by_user_name,
        offered.email AS offered_by_user_email,
        targeted.display_name AS target_user_name,
        targeted.email AS target_user_email,
        requested.display_name AS requested_by_user_name,
        requested.email AS requested_by_user_email
      FROM schedule_shift_offers o
      JOIN schedule_shifts s ON s.id = o.shift_id
      JOIN users u ON u.id = s.user_id
      JOIN users offered ON offered.id = o.offered_by_user_id
      LEFT JOIN users targeted ON targeted.id = o.target_user_id
      LEFT JOIN users requested ON requested.id = o.requested_by_user_id
      WHERE s.week_id = ?
      ORDER BY s.shift_date ASC, s.start_time ASC, COALESCE(u.display_name, u.email) ASC
      `
    )
    .bind(week.week.id)
    .all<{
      id: string;
      shift_id: string;
      offered_by_user_id: string;
      target_user_id: string | null;
      requested_by_user_id: string | null;
      manager_note: string | null;
      created_at: number;
      updated_at: number;
      week_id: string;
      shift_date: string;
      user_id: string;
      department: string;
      role: string;
      detail: string | null;
      start_time: string;
      end_label: string | null;
      notes: string | null;
      user_name: string | null;
      user_email: string;
      offered_by_user_name: string | null;
      offered_by_user_email: string;
      target_user_name: string | null;
      target_user_email: string | null;
      requested_by_user_name: string | null;
      requested_by_user_email: string | null;
    }>();

  return (rows.results ?? []).map((row) => ({
    id: row.id,
    shiftId: row.shift_id,
    weekId: row.week_id,
    shiftDate: row.shift_date,
    userId: row.user_id,
    userName: row.user_name,
    userEmail: row.user_email,
    department: row.department,
    role: row.role,
    detail: row.detail ?? '',
    startTime: row.start_time,
    endLabel: row.end_label ?? '',
    notes: row.notes ?? '',
    offeredByUserId: row.offered_by_user_id,
    offeredByUserName: row.offered_by_user_name,
    offeredByUserEmail: row.offered_by_user_email,
    targetUserId: row.target_user_id,
    targetUserName: row.target_user_name,
    targetUserEmail: row.target_user_email,
    requestedByUserId: row.requested_by_user_id,
    requestedByUserName: row.requested_by_user_name,
    requestedByUserEmail: row.requested_by_user_email,
    managerNote: row.manager_note ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  })) satisfies ScheduleShiftOffer[];
}

export async function loadScheduleAssignableUsers(db: DB) {
  await ensureScheduleSchema(db);
  const rows = await db
    .prepare(
      `
      SELECT id, display_name, email
      FROM users
      WHERE COALESCE(is_active, 1) = 1
      ORDER BY COALESCE(display_name, email) ASC
      `
    )
    .all<{ id: string; display_name: string | null; email: string }>();

  const approvalsByUser = await loadScheduleDepartmentApprovalsByUser(
    db,
    (rows.results ?? []).map((row) => row.id)
  );

  return (rows.results ?? []).map((row) => ({
    id: row.id,
    displayName: row.display_name,
    email: row.email,
    approvedDepartments: approvalsByUser.get(row.id) ?? []
  }));
}

export async function loadUserScheduleAvailability(db: DB, userId: string) {
  const availability = await loadScheduleAvailabilityByUser(db, [userId]);
  const rows = availability.get(userId) ?? [];
  return Array.from({ length: 7 }, (_, weekday) => {
    const existing = rows.find((entry) => entry.weekday === weekday);
    return (
      existing ?? {
        weekday,
        isAvailable: false,
        startTime: '09:00',
        endTime: '17:00'
      }
    );
  });
}

export async function loadUserScheduleTimeOffRequests(db: DB, userId: string) {
  await ensureScheduleSchema(db);

  const rows = await db
    .prepare(
      `
      SELECT
        r.id,
        r.user_id,
        u.display_name AS user_name,
        u.email AS user_email,
        r.start_date,
        r.end_date,
        r.note,
        r.status,
        r.manager_note,
        r.created_at,
        r.updated_at,
        r.resolved_at,
        r.resolved_by_user_id
      FROM user_schedule_time_off_requests r
      JOIN users u ON u.id = r.user_id
      WHERE r.user_id = ?
      ORDER BY
        CASE r.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
        r.start_date ASC,
        r.created_at DESC
      `
    )
    .bind(userId)
    .all<{
      id: string;
      user_id: string;
      user_name: string | null;
      user_email: string;
      start_date: string;
      end_date: string;
      note: string | null;
      status: 'pending' | 'approved' | 'declined';
      manager_note: string | null;
      created_at: number;
      updated_at: number;
      resolved_at: number | null;
      resolved_by_user_id: string | null;
    }>();

  return (rows.results ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    userEmail: row.user_email,
    startDate: row.start_date,
    endDate: row.end_date,
    note: row.note ?? '',
    status: row.status,
    managerNote: row.manager_note ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
    resolvedByUserId: row.resolved_by_user_id
  })) satisfies ScheduleTimeOffRequest[];
}

export async function loadScheduleTimeOffRequestsForRange(db: DB, startDate: string, endDate: string) {
  await ensureScheduleSchema(db);

  const rows = await db
    .prepare(
      `
      SELECT
        r.id,
        r.user_id,
        u.display_name AS user_name,
        u.email AS user_email,
        r.start_date,
        r.end_date,
        r.note,
        r.status,
        r.manager_note,
        r.created_at,
        r.updated_at,
        r.resolved_at,
        r.resolved_by_user_id
      FROM user_schedule_time_off_requests r
      JOIN users u ON u.id = r.user_id
      WHERE r.start_date <= ?
        AND r.end_date >= ?
      ORDER BY
        CASE r.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
        r.start_date ASC,
        COALESCE(u.display_name, u.email) ASC
      `
    )
    .bind(endDate, startDate)
    .all<{
      id: string;
      user_id: string;
      user_name: string | null;
      user_email: string;
      start_date: string;
      end_date: string;
      note: string | null;
      status: 'pending' | 'approved' | 'declined';
      manager_note: string | null;
      created_at: number;
      updated_at: number;
      resolved_at: number | null;
      resolved_by_user_id: string | null;
    }>();

  return (rows.results ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    userEmail: row.user_email,
    startDate: row.start_date,
    endDate: row.end_date,
    note: row.note ?? '',
    status: row.status,
    managerNote: row.manager_note ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
    resolvedByUserId: row.resolved_by_user_id
  })) satisfies ScheduleTimeOffRequest[];
}

async function loadOwnedShift(db: DB, shiftId: string) {
  return db
    .prepare(
      `
      SELECT
        s.id,
        s.week_id,
        s.shift_date,
        s.user_id,
        s.department,
        s.start_time,
        w.week_start
      FROM schedule_shifts s
      JOIN schedule_weeks w ON w.id = s.week_id
      WHERE s.id = ?
      LIMIT 1
      `
    )
    .bind(shiftId)
    .first<{
      id: string;
      week_id: string;
      shift_date: string;
      user_id: string;
      department: string;
      start_time: string;
      week_start: string;
    }>();
}

async function loadAssignableUserById(db: DB, userId: string) {
  const users = await loadScheduleAssignableUsersById(db, [userId]);
  return users.get(userId) ?? null;
}

export async function saveUserScheduleAvailability(request: Request, locals: App.Locals) {
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  if (!locals.userId) return fail(403, { error: 'Sign in required.' });

  await ensureScheduleSchema(db);
  const form = await request.formData();
  const payload = String(form.get('availability') ?? '').trim();
  if (!payload) {
    return fail(400, { error: 'No availability data was submitted.' });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return fail(400, { error: 'Availability data could not be read.' });
  }

  if (!Array.isArray(parsed) || parsed.length !== 7) {
    return fail(400, { error: 'Availability must include all seven days.' });
  }

  const rows: UserScheduleAvailability[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object') {
      return fail(400, { error: 'Availability entries must be valid objects.' });
    }
    const row = entry as Record<string, unknown>;
    const weekday = Number(row.weekday);
    const isAvailable = Number(row.isAvailable) === 1 || row.isAvailable === true;
    const startTime = String(row.startTime ?? '').trim();
    const endTime = String(row.endTime ?? '').trim();

    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      return fail(400, { error: 'Availability day is invalid.' });
    }

    if (isAvailable) {
      if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
        return fail(400, { error: 'Available days need a start and end time.' });
      }
      if (startTime >= endTime) {
        return fail(400, { error: 'Availability end time must be after the start time.' });
      }
    }

    rows.push({
      weekday,
      isAvailable,
      startTime: isAvailable ? startTime : '',
      endTime: isAvailable ? endTime : ''
    });
  }

  const now = Math.floor(Date.now() / 1000);
  await db.prepare(`DELETE FROM user_schedule_availability WHERE user_id = ?`).bind(locals.userId).run();

  for (const row of rows) {
    await db
      .prepare(
        `
        INSERT INTO user_schedule_availability (
          user_id, weekday, is_available, start_time, end_time, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
        `
      )
      .bind(locals.userId, row.weekday, row.isAvailable ? 1 : 0, row.startTime, row.endTime, now)
      .run();
  }

  return { success: true, message: 'Availability updated.' };
}

export async function createUserScheduleTimeOffRequest(request: Request, locals: App.Locals) {
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  if (!locals.userId) return fail(403, { error: 'Sign in required.' });

  await ensureScheduleSchema(db);
  const form = await request.formData();
  const startDate = String(form.get('start_date') ?? '').trim();
  const endDate = String(form.get('end_date') ?? '').trim();
  const note = String(form.get('note') ?? '').trim();

  if (!startDate || !endDate) {
    return fail(400, { error: 'Start and end dates are required.' });
  }
  if (endDate < startDate) {
    return fail(400, { error: 'End date must be on or after the start date.' });
  }

  const existing = await db
    .prepare(
      `
      SELECT id
      FROM user_schedule_time_off_requests
      WHERE user_id = ?
        AND status = 'pending'
        AND start_date = ?
        AND end_date = ?
      LIMIT 1
      `
    )
    .bind(locals.userId, startDate, endDate)
    .first<{ id: string }>();
  if (existing) {
    return fail(400, { error: 'That time off request is already pending.' });
  }

  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `
      INSERT INTO user_schedule_time_off_requests (
        id, user_id, start_date, end_date, note, status, manager_note,
        created_at, updated_at, resolved_at, resolved_by_user_id
      )
      VALUES (?, ?, ?, ?, ?, 'pending', '', ?, ?, NULL, NULL)
      `
    )
    .bind(crypto.randomUUID(), locals.userId, startDate, endDate, note, now, now)
    .run();

  return { success: true, message: 'Time off request submitted.' };
}

export async function cancelUserScheduleTimeOffRequest(request: Request, locals: App.Locals) {
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  if (!locals.userId) return fail(403, { error: 'Sign in required.' });

  await ensureScheduleSchema(db);
  const form = await request.formData();
  const requestId = String(form.get('request_id') ?? '').trim();
  if (!requestId) return fail(400, { error: 'Missing request id.' });

  const existing = await db
    .prepare(
      `
      SELECT id
      FROM user_schedule_time_off_requests
      WHERE id = ?
        AND user_id = ?
        AND status = 'pending'
      LIMIT 1
      `
    )
    .bind(requestId, locals.userId)
    .first<{ id: string }>();

  if (!existing) {
    return fail(404, { error: 'That pending time off request could not be found.' });
  }

  await db.prepare(`DELETE FROM user_schedule_time_off_requests WHERE id = ?`).bind(requestId).run();
  return { success: true, message: 'Pending time off request removed.' };
}

export async function offerScheduleShift(request: Request, locals: App.Locals) {
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  if (!locals.userId) return fail(403, { error: 'Sign in required.' });

  await ensureScheduleSchema(db);
  const form = await request.formData();
  const shiftId = String(form.get('shift_id') ?? '').trim();
  const targetUserId = String(form.get('target_user_id') ?? '').trim();
  if (!shiftId) return fail(400, { error: 'Missing shift id.' });

  const shift = await loadOwnedShift(db, shiftId);
  if (!shift || shift.user_id !== locals.userId) {
    return fail(404, { error: 'That shift could not be offered.' });
  }

  if (targetUserId) {
    if (targetUserId === locals.userId) {
      return fail(400, { error: 'You cannot offer a shift to yourself.' });
    }

    const targetUser = await loadAssignableUserById(db, targetUserId);
    if (!targetUser) {
      return fail(400, { error: 'That employee could not be selected.' });
    }
    const departments = await loadScheduleDepartments(db);
    if (!isValidScheduleDepartment(shift.department, departments)) {
      return fail(400, { error: 'That shift has an invalid department.' });
    }
    if (!targetUser.approvedDepartments.includes(shift.department)) {
      return fail(400, {
        error: `${formatAssignableUserLabel(targetUser)} is not approved for ${shift.department}.`
      });
    }
  }

  const existing = await db
    .prepare(`SELECT id FROM schedule_shift_offers WHERE shift_id = ? LIMIT 1`)
    .bind(shiftId)
    .first<{ id: string }>();
  if (existing) return fail(400, { error: 'That shift is already up for grabs.' });

  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `
      INSERT INTO schedule_shift_offers (
        id, shift_id, offered_by_user_id, target_user_id, requested_by_user_id, manager_note, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, NULL, '', ?, ?)
      `
    )
    .bind(crypto.randomUUID(), shiftId, locals.userId, targetUserId || null, now, now)
    .run();

  return { success: true };
}

export async function cancelScheduleShiftOffer(request: Request, locals: App.Locals) {
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  if (!locals.userId) return fail(403, { error: 'Sign in required.' });

  await ensureScheduleSchema(db);
  const form = await request.formData();
  const shiftId = String(form.get('shift_id') ?? '').trim();
  if (!shiftId) return fail(400, { error: 'Missing shift id.' });

  const offer = await db
    .prepare(`SELECT offered_by_user_id FROM schedule_shift_offers WHERE shift_id = ? LIMIT 1`)
    .bind(shiftId)
    .first<{ offered_by_user_id: string }>();
  if (!offer || offer.offered_by_user_id !== locals.userId) {
    return fail(404, { error: 'That shift offer could not be cancelled.' });
  }

  await db.prepare(`DELETE FROM schedule_shift_offers WHERE shift_id = ?`).bind(shiftId).run();
  return { success: true };
}

export async function requestScheduleShiftOffer(request: Request, locals: App.Locals) {
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  if (!locals.userId) return fail(403, { error: 'Sign in required.' });

  await ensureScheduleSchema(db);
  const form = await request.formData();
  const shiftId = String(form.get('shift_id') ?? '').trim();
  if (!shiftId) return fail(400, { error: 'Missing shift id.' });

  const offer = await db
    .prepare(
      `
      SELECT
        o.offered_by_user_id,
        o.target_user_id,
        o.requested_by_user_id,
        s.user_id,
        s.department
      FROM schedule_shift_offers o
      JOIN schedule_shifts s ON s.id = o.shift_id
      WHERE o.shift_id = ?
      LIMIT 1
      `
    )
    .bind(shiftId)
    .first<{
      offered_by_user_id: string;
      target_user_id: string | null;
      requested_by_user_id: string | null;
      user_id: string;
      department: string;
    }>();

  if (!offer) return fail(404, { error: 'That shift is no longer available.' });
  if (offer.offered_by_user_id === locals.userId || offer.user_id === locals.userId) {
    return fail(400, { error: 'You cannot claim your own shift.' });
  }
  if (offer.target_user_id && offer.target_user_id !== locals.userId) {
    return fail(400, { error: 'That shift was offered to someone else.' });
  }
  if (offer.requested_by_user_id && offer.requested_by_user_id !== locals.userId) {
    return fail(400, { error: 'That shift already has a pending request.' });
  }
  const departments = await loadScheduleDepartments(db);
  if (!isValidScheduleDepartment(offer.department, departments)) {
    return fail(400, { error: 'That shift has an invalid department.' });
  }

  const requester = await loadAssignableUserById(db, locals.userId);
  if (!requester) {
    return fail(400, { error: 'Your account is not active for scheduling right now.' });
  }
  if (!requester.approvedDepartments.includes(offer.department)) {
    return fail(400, { error: `You are not approved for ${offer.department} shifts.` });
  }

  await db
    .prepare(`UPDATE schedule_shift_offers SET requested_by_user_id = ?, updated_at = ? WHERE shift_id = ?`)
    .bind(locals.userId, Math.floor(Date.now() / 1000), shiftId)
    .run();

  return { success: true };
}

export async function withdrawScheduleShiftRequest(request: Request, locals: App.Locals) {
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  if (!locals.userId) return fail(403, { error: 'Sign in required.' });

  await ensureScheduleSchema(db);
  const form = await request.formData();
  const shiftId = String(form.get('shift_id') ?? '').trim();
  if (!shiftId) return fail(400, { error: 'Missing shift id.' });

  const offer = await db
    .prepare(`SELECT requested_by_user_id FROM schedule_shift_offers WHERE shift_id = ? LIMIT 1`)
    .bind(shiftId)
    .first<{ requested_by_user_id: string | null }>();
  if (!offer || offer.requested_by_user_id !== locals.userId) {
    return fail(404, { error: 'That shift request could not be withdrawn.' });
  }

  await db
    .prepare(`UPDATE schedule_shift_offers SET requested_by_user_id = NULL, updated_at = ? WHERE shift_id = ?`)
    .bind(Math.floor(Date.now() / 1000), shiftId)
    .run();

  return { success: true };
}

export async function approveScheduleShiftOffer(request: Request, locals: App.Locals) {
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  if (!locals.userId || locals.userRole !== 'admin') return fail(403, { error: 'Admin access required.' });

  await ensureScheduleSchema(db);
  const form = await request.formData();
  const shiftId = String(form.get('shift_id') ?? '').trim();
  if (!shiftId) return fail(400, { error: 'Missing shift id.' });

  const offer = await db
    .prepare(
      `
      SELECT o.requested_by_user_id, s.week_id, s.department
      FROM schedule_shift_offers o
      JOIN schedule_shifts s ON s.id = o.shift_id
      WHERE o.shift_id = ?
      LIMIT 1
      `
    )
    .bind(shiftId)
    .first<{ requested_by_user_id: string | null; week_id: string; department: string }>();

  if (!offer?.requested_by_user_id) {
    return fail(400, { error: 'That shift does not have a pending taker yet.' });
  }
  const departments = await loadScheduleDepartments(db);
  if (!isValidScheduleDepartment(offer.department, departments)) {
    return fail(400, { error: 'That shift has an invalid department.' });
  }

  const requestedUser = await loadAssignableUserById(db, offer.requested_by_user_id);
  if (!requestedUser) {
    return fail(400, { error: 'That requested employee is no longer active.' });
  }
  if (!requestedUser.approvedDepartments.includes(offer.department)) {
    return fail(400, {
      error: `${formatAssignableUserLabel(requestedUser)} is not approved for ${offer.department}.`
    });
  }

  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(`UPDATE schedule_shifts SET user_id = ?, updated_at = ? WHERE id = ?`)
    .bind(offer.requested_by_user_id, now, shiftId)
    .run();
  await db.prepare(`DELETE FROM schedule_shift_offers WHERE shift_id = ?`).bind(shiftId).run();
  await db
    .prepare(`UPDATE schedule_weeks SET updated_at = ?, updated_by = ? WHERE id = ?`)
    .bind(now, locals.userId, offer.week_id)
    .run();

  return { success: true, message: 'Shift request approved.' };
}

export async function declineScheduleShiftOffer(request: Request, locals: App.Locals) {
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  if (!locals.userId || locals.userRole !== 'admin') return fail(403, { error: 'Admin access required.' });

  await ensureScheduleSchema(db);
  const form = await request.formData();
  const shiftId = String(form.get('shift_id') ?? '').trim();
  if (!shiftId) return fail(400, { error: 'Missing shift id.' });

  const existing = await db
    .prepare(`SELECT id FROM schedule_shift_offers WHERE shift_id = ? AND requested_by_user_id IS NOT NULL LIMIT 1`)
    .bind(shiftId)
    .first<{ id: string }>();
  if (!existing) return fail(404, { error: 'That pending request could not be found.' });

  await db
    .prepare(`UPDATE schedule_shift_offers SET requested_by_user_id = NULL, updated_at = ? WHERE shift_id = ?`)
    .bind(Math.floor(Date.now() / 1000), shiftId)
    .run();

  return { success: true, message: 'Shift request declined.' };
}

export async function approveScheduleTimeOffRequest(request: Request, locals: App.Locals) {
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  if (!locals.userId || locals.userRole !== 'admin') return fail(403, { error: 'Admin access required.' });

  await ensureScheduleSchema(db);
  const form = await request.formData();
  const requestId = String(form.get('request_id') ?? '').trim();
  const managerNote = String(form.get('manager_note') ?? '').trim();
  if (!requestId) return fail(400, { error: 'Missing request id.' });

  const existing = await db
    .prepare(`SELECT id FROM user_schedule_time_off_requests WHERE id = ? LIMIT 1`)
    .bind(requestId)
    .first<{ id: string }>();
  if (!existing) return fail(404, { error: 'That time off request could not be found.' });

  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `
      UPDATE user_schedule_time_off_requests
      SET status = 'approved',
          manager_note = ?,
          updated_at = ?,
          resolved_at = ?,
          resolved_by_user_id = ?
      WHERE id = ?
      `
    )
    .bind(managerNote, now, now, locals.userId, requestId)
    .run();

  return { success: true, message: 'Time off approved.' };
}

export async function declineScheduleTimeOffRequest(request: Request, locals: App.Locals) {
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  if (!locals.userId || locals.userRole !== 'admin') return fail(403, { error: 'Admin access required.' });

  await ensureScheduleSchema(db);
  const form = await request.formData();
  const requestId = String(form.get('request_id') ?? '').trim();
  const managerNote = String(form.get('manager_note') ?? '').trim();
  if (!requestId) return fail(400, { error: 'Missing request id.' });

  const existing = await db
    .prepare(`SELECT id FROM user_schedule_time_off_requests WHERE id = ? LIMIT 1`)
    .bind(requestId)
    .first<{ id: string }>();
  if (!existing) return fail(404, { error: 'That time off request could not be found.' });

  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `
      UPDATE user_schedule_time_off_requests
      SET status = 'declined',
          manager_note = ?,
          updated_at = ?,
          resolved_at = ?,
          resolved_by_user_id = ?
      WHERE id = ?
      `
    )
    .bind(managerNote, now, now, locals.userId, requestId)
    .run();

  return { success: true, message: 'Time off declined.' };
}

export async function saveScheduleShift(request: Request, locals: App.Locals) {
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  if (!locals.userId || locals.userRole !== 'admin') return fail(403, { error: 'Admin access required.' });

  await ensureScheduleSchema(db);

  const form = await request.formData();
  const id = String(form.get('id') ?? '').trim();
  const weekStart = String(form.get('week_start') ?? '').trim() || getWeekStart();
  const shiftDate = String(form.get('shift_date') ?? '').trim();
  const userId = String(form.get('user_id') ?? '').trim();
  const department = String(form.get('department') ?? '').trim() as ScheduleDepartment;
  const role = String(form.get('role') ?? '').trim();
  const detail = String(form.get('detail') ?? '').trim();
  const startTime = String(form.get('start_time') ?? '').trim();
  const endLabel = String(form.get('end_label') ?? '').trim();
  const notes = String(form.get('notes') ?? '').trim();

  if (!shiftDate || !userId || !department || !role || !startTime) {
    return fail(400, { error: 'Date, user, department, role, and start time are required.' });
  }

  const departments = await loadScheduleDepartments(db);
  if (!isValidScheduleDepartment(department, departments)) {
    return fail(400, { error: 'Invalid department.' });
  }

  const roleOptionsByDepartment = await loadScheduleRoleOptionsByDepartment(db);
  if (!roleIsAllowed(roleOptionsByDepartment, department, role)) {
    return fail(400, { error: 'Invalid role for that department.' });
  }

  const assignmentError = await validateScheduleAssignments(db, [{ userId, department, shiftDate }]);
  if (assignmentError) {
    return fail(400, { error: assignmentError });
  }

  const week = await getOrCreateScheduleWeek(db, weekStart, locals.userId);
  const now = Math.floor(Date.now() / 1000);

  if (id) {
    await db
      .prepare(
        `
        UPDATE schedule_shifts
        SET
          shift_date = ?,
          user_id = ?,
          department = ?,
          role = ?,
          detail = ?,
          start_time = ?,
          end_label = ?,
          notes = ?,
          updated_at = ?
        WHERE id = ? AND week_id = ?
        `
      )
      .bind(shiftDate, userId, department, role, detail, startTime, endLabel, notes, now, id, week.id)
      .run();
  } else {
    const maxSort = await db
      .prepare(`SELECT COALESCE(MAX(sort_order), -1) AS max_sort FROM schedule_shifts WHERE week_id = ? AND shift_date = ?`)
      .bind(week.id, shiftDate)
      .first<{ max_sort: number }>();

    await db
      .prepare(
        `
        INSERT INTO schedule_shifts (
          id, week_id, shift_date, user_id, department, role, detail,
          start_time, end_label, notes, sort_order, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .bind(
        crypto.randomUUID(),
        week.id,
        shiftDate,
        userId,
        department,
        role,
        detail,
        startTime,
        endLabel,
        notes,
        (maxSort?.max_sort ?? -1) + 1,
        now,
        now
      )
      .run();
  }

  await db
    .prepare(`UPDATE schedule_weeks SET updated_at = ?, updated_by = ? WHERE id = ?`)
    .bind(now, locals.userId, week.id)
    .run();

  return { success: true };
}

export async function saveScheduleWeekDraft(request: Request, locals: App.Locals) {
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  if (!locals.userId || locals.userRole !== 'admin') return fail(403, { error: 'Admin access required.' });

  await ensureScheduleSchema(db);

  const form = await request.formData();
  const weekStart = String(form.get('week_start') ?? '').trim() || getWeekStart();
  const payload = String(form.get('payload') ?? '').trim();
  if (!payload) return fail(400, { error: 'No schedule data was submitted.' });
  const teamPayload = String(form.get('team_payload') ?? '').trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return fail(400, { error: 'Schedule data could not be read.' });
  }

  if (!Array.isArray(parsed)) {
    return fail(400, { error: 'Schedule data must be a list of shifts.' });
  }

  const rows: ScheduleDraftRow[] = [];
  const rosterUserIdsFromPayload: string[] = [];
  const departments = await loadScheduleDepartments(db);
  const roleOptionsByDepartment = await loadScheduleRoleOptionsByDepartment(db);
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const shiftDate = String(row.shiftDate ?? '').trim();
    const userId = String(row.userId ?? '').trim();
    const department = String(row.department ?? '').trim();
    const role = String(row.role ?? '').trim();
    const detail = String(row.detail ?? '').trim();
    const startTime = String(row.startTime ?? '').trim();
    const endLabel = String(row.endLabel ?? '').trim();
    const notes = String(row.notes ?? '').trim();

    if (!shiftDate && !userId && !department && !role && !startTime && !detail && !endLabel && !notes) {
      continue;
    }

    if (!shiftDate || !userId || !department || !role || !startTime) {
      return fail(400, { error: 'Every shift needs a date, employee, department, role, and start time.' });
    }

    if (!isValidScheduleDepartment(department, departments)) {
      return fail(400, { error: `Invalid department on ${shiftDate}.` });
    }

    if (!roleIsAllowed(roleOptionsByDepartment, department, role)) {
      return fail(400, { error: `Invalid role for ${department} on ${shiftDate}.` });
    }

    rows.push({
      shiftDate,
      userId,
      department,
      role,
      detail,
      startTime,
      endLabel,
      notes
    });
  }

  const assignmentError = await validateScheduleAssignments(
    db,
    rows.map((row) => ({
      userId: row.userId,
      department: row.department as ScheduleDepartment,
      shiftDate: row.shiftDate
    }))
  );
  if (assignmentError) {
    return fail(400, { error: assignmentError });
  }

  if (teamPayload) {
    let parsedTeam: unknown;
    try {
      parsedTeam = JSON.parse(teamPayload);
    } catch {
      return fail(400, { error: 'Team data could not be read.' });
    }
    if (!Array.isArray(parsedTeam)) {
      return fail(400, { error: 'Team data must be a list of employees.' });
    }
    for (const value of parsedTeam) {
      const userId = String(value ?? '').trim();
      if (userId) rosterUserIdsFromPayload.push(userId);
    }
  }

  const week = await getOrCreateScheduleWeek(db, weekStart, locals.userId);
  const now = Math.floor(Date.now() / 1000);
  const shiftUserIds = rows.map((row) => row.userId);
  const rosterUserIds = Array.from(new Set([...rosterUserIdsFromPayload, ...shiftUserIds]));
  if (rosterUserIds.length > 0) {
    const assignableById = await loadScheduleAssignableUsersById(db, rosterUserIds);
    for (const userId of rosterUserIds) {
      if (!assignableById.has(userId)) {
        return fail(400, { error: 'One or more scheduled employees are no longer active.' });
      }
    }
  }

  await db.prepare(`DELETE FROM schedule_shifts WHERE week_id = ?`).bind(week.id).run();
  await db.prepare(`DELETE FROM schedule_week_team WHERE week_id = ?`).bind(week.id).run();

  for (const [index, row] of rows.entries()) {
    await db
      .prepare(
        `
        INSERT INTO schedule_shifts (
          id, week_id, shift_date, user_id, department, role, detail,
          start_time, end_label, notes, sort_order, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .bind(
        crypto.randomUUID(),
        week.id,
        row.shiftDate,
        row.userId,
        row.department,
        row.role,
        row.detail ?? '',
        row.startTime,
        row.endLabel ?? '',
        row.notes ?? '',
        index,
        now,
        now
      )
      .run();
  }

  for (const [index, userId] of rosterUserIds.entries()) {
    await db
      .prepare(
        `
        INSERT INTO schedule_week_team (week_id, user_id, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        `
      )
      .bind(week.id, userId, index, now, now)
      .run();
  }

  await db
    .prepare(`UPDATE schedule_weeks SET updated_at = ?, updated_by = ? WHERE id = ?`)
    .bind(now, locals.userId, week.id)
    .run();

  return { success: true };
}

export async function deleteScheduleShift(request: Request, locals: App.Locals) {
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  if (!locals.userId || locals.userRole !== 'admin') return fail(403, { error: 'Admin access required.' });

  await ensureScheduleSchema(db);
  const form = await request.formData();
  const id = String(form.get('id') ?? '').trim();
  if (!id) return fail(400, { error: 'Missing shift id.' });

  await db.prepare(`DELETE FROM schedule_shifts WHERE id = ?`).bind(id).run();
  return { success: true };
}

export async function publishScheduleWeek(request: Request, locals: App.Locals) {
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  if (!locals.userId || locals.userRole !== 'admin') return fail(403, { error: 'Admin access required.' });

  await ensureScheduleSchema(db);
  const form = await request.formData();
  const weekStart = String(form.get('week_start') ?? '').trim();
  if (!weekStart) return fail(400, { error: 'Missing week start.' });

  const week = await getOrCreateScheduleWeek(db, weekStart, locals.userId);
  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `
      UPDATE schedule_weeks
      SET status = 'published', published_at = ?, updated_at = ?, updated_by = ?
      WHERE id = ?
      `
    )
    .bind(now, now, locals.userId, week.id)
    .run();

  return { success: true };
}

export async function markScheduleWeekDraft(request: Request, locals: App.Locals) {
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  if (!locals.userId || locals.userRole !== 'admin') return fail(403, { error: 'Admin access required.' });

  await ensureScheduleSchema(db);
  const form = await request.formData();
  const weekStart = String(form.get('week_start') ?? '').trim();
  if (!weekStart) return fail(400, { error: 'Missing week start.' });

  const week = await getOrCreateScheduleWeek(db, weekStart, locals.userId);
  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `
      UPDATE schedule_weeks
      SET status = 'draft', updated_at = ?, updated_by = ?
      WHERE id = ?
      `
    )
    .bind(now, locals.userId, week.id)
    .run();

  return { success: true };
}

export async function copyPreviousScheduleWeek(request: Request, locals: App.Locals) {
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  if (!locals.userId || locals.userRole !== 'admin') return fail(403, { error: 'Admin access required.' });

  await ensureScheduleSchema(db);

  const form = await request.formData();
  const weekStart = String(form.get('week_start') ?? '').trim();
  if (!weekStart) return fail(400, { error: 'Missing week start.' });

  const previousWeekStart = addDays(weekStart, -7);
  const source = await loadScheduleWeek(db, previousWeekStart);
  if (!source.week || source.shifts.length === 0) {
    return fail(400, { error: 'No previous week schedule was found to paste into this week.' });
  }
  const departments = await loadScheduleDepartments(db);
  if (source.shifts.some((shift) => !isValidScheduleDepartment(shift.department, departments))) {
    return fail(400, { error: 'The previous week has a shift with an invalid department.' });
  }

  const copiedAssignments = source.shifts.map((shift) => {
      const dayOffset = Math.round(
        (new Date(`${shift.shiftDate}T00:00:00`).getTime() -
          new Date(`${previousWeekStart}T00:00:00`).getTime()) /
          86400000
      );

      return {
        userId: shift.userId,
        department: shift.department as ScheduleDepartment,
        shiftDate: addDays(weekStart, dayOffset)
      };
    });

  const copyError = await validateScheduleAssignments(db, copiedAssignments);
  if (copyError) {
    return fail(400, { error: copyError });
  }

  const targetWeek = await getOrCreateScheduleWeek(db, weekStart, locals.userId);
  const now = Math.floor(Date.now() / 1000);

  await db.prepare(`DELETE FROM schedule_shifts WHERE week_id = ?`).bind(targetWeek.id).run();
  await db.prepare(`DELETE FROM schedule_week_team WHERE week_id = ?`).bind(targetWeek.id).run();

  for (const shift of source.shifts) {
    const dayOffset = Math.round(
      (new Date(`${shift.shiftDate}T00:00:00`).getTime() - new Date(`${previousWeekStart}T00:00:00`).getTime()) /
        86400000
    );
    const copiedDate = addDays(weekStart, dayOffset);

    await db
      .prepare(
        `
        INSERT INTO schedule_shifts (
          id, week_id, shift_date, user_id, department, role, detail,
          start_time, end_label, notes, sort_order, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .bind(
        crypto.randomUUID(),
        targetWeek.id,
        copiedDate,
        shift.userId,
        shift.department,
        shift.role,
        shift.detail,
        shift.startTime,
        shift.endLabel,
        shift.notes,
        shift.sortOrder,
        now,
        now
      )
      .run();
  }

  const rosterUserIds = Array.from(new Set(source.rosterUserIds));
  for (const [index, userId] of rosterUserIds.entries()) {
    await db
      .prepare(
        `
        INSERT INTO schedule_week_team (week_id, user_id, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        `
      )
      .bind(targetWeek.id, userId, index, now, now)
      .run();
  }

  await db
    .prepare(`UPDATE schedule_weeks SET updated_at = ?, updated_by = ? WHERE id = ?`)
    .bind(now, locals.userId, targetWeek.id)
    .run();

  return { success: true, message: 'Last week pasted into this schedule.' };
}

export async function saveScheduleAutofillPreference(request: Request, locals: App.Locals) {
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  if (!locals.userId || locals.userRole !== 'admin') return fail(403, { error: 'Admin access required.' });

  await ensureScheduleSchema(db);
  const form = await request.formData();
  const enabled = String(form.get('autofill_new_weeks') ?? '').trim() === '1' ? 1 : 0;
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `
      INSERT INTO schedule_preferences (id, autofill_new_weeks, updated_at, updated_by)
      VALUES ('default', ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        autofill_new_weeks = excluded.autofill_new_weeks,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by
      `
    )
    .bind(enabled, now, locals.userId)
    .run();

  return { success: true, message: enabled ? 'Autofill enabled.' : 'Autofill disabled.' };
}

export async function createScheduleRoleDefinition(request: Request, locals: App.Locals) {
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  if (!locals.userId || locals.userRole !== 'admin') return fail(403, { error: 'Admin access required.' });

  await ensureScheduleSchema(db);
  const form = await request.formData();
  const department = String(form.get('department') ?? '').trim();
  const roleName = String(form.get('role_name') ?? '').trim();
  const departments = await loadScheduleDepartments(db);

  if (!isValidScheduleDepartment(department, departments)) {
    return fail(400, { error: 'Invalid schedule department.' });
  }
  if (!roleName) {
    return fail(400, { error: 'Role name is required.' });
  }

  const existing = await db
    .prepare(
      `
      SELECT id
      FROM schedule_role_definitions
      WHERE department = ? AND LOWER(role_name) = LOWER(?)
      LIMIT 1
      `
    )
    .bind(department, roleName)
    .first<{ id: string }>();
  if (existing) {
    return fail(400, { error: 'That role already exists in this department.' });
  }

  const maxSort = await db
    .prepare(
      `
      SELECT COALESCE(MAX(sort_order), -1) AS max_sort
      FROM schedule_role_definitions
      WHERE department = ?
      `
    )
    .bind(department)
    .first<{ max_sort: number }>();

  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `
      INSERT INTO schedule_role_definitions (
        id, department, role_name, sort_order, is_active, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, 1, ?, ?)
      `
    )
    .bind(crypto.randomUUID(), department, roleName, (maxSort?.max_sort ?? -1) + 1, now, now)
    .run();

  return { success: true, message: 'Schedule role added.' };
}

export async function createScheduleDepartment(request: Request, locals: App.Locals) {
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  if (!locals.userId || locals.userRole !== 'admin') return fail(403, { error: 'Admin access required.' });

  await ensureScheduleSchema(db);
  const form = await request.formData();
  const departmentName = String(form.get('department_name') ?? '').trim();

  if (!departmentName) {
    return fail(400, { error: 'Department name is required.' });
  }

  const existing = await db
    .prepare(
      `
      SELECT id
      FROM schedule_departments
      WHERE LOWER(name) = LOWER(?)
      LIMIT 1
      `
    )
    .bind(departmentName)
    .first<{ id: string }>();

  if (existing) {
    return fail(400, { error: 'That department already exists.' });
  }

  const maxSort = await db
    .prepare(
      `
      SELECT COALESCE(MAX(sort_order), -1) AS max_sort
      FROM schedule_departments
      `
    )
    .first<{ max_sort: number }>();

  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `
      INSERT INTO schedule_departments (
        id, name, sort_order, is_active, created_at, updated_at
      )
      VALUES (?, ?, ?, 1, ?, ?)
      `
    )
    .bind(crypto.randomUUID(), departmentName, (maxSort?.max_sort ?? -1) + 1, now, now)
    .run();

  return { success: true, message: 'Department added.' };
}

export async function deleteScheduleRoleDefinition(request: Request, locals: App.Locals) {
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });
  if (!locals.userId || locals.userRole !== 'admin') return fail(403, { error: 'Admin access required.' });

  await ensureScheduleSchema(db);
  const form = await request.formData();
  const roleId = String(form.get('role_id') ?? '').trim();
  if (!roleId) return fail(400, { error: 'Missing role id.' });

  const role = await db
    .prepare(
      `
      SELECT id, department, role_name
      FROM schedule_role_definitions
      WHERE id = ?
      LIMIT 1
      `
    )
    .bind(roleId)
    .first<{ id: string; department: string; role_name: string }>();

  const departments = await loadScheduleDepartments(db);
  if (!role || !isValidScheduleDepartment(role.department, departments)) {
    return fail(404, { error: 'That schedule role could not be found.' });
  }

  const activeUsage = await db
    .prepare(
      `
      SELECT COUNT(*) AS count
      FROM schedule_shifts
      WHERE department = ? AND role = ?
      `
    )
    .bind(role.department, role.role_name)
    .first<{ count: number }>();

  if ((activeUsage?.count ?? 0) > 0) {
    return fail(400, { error: 'That role is still used on the schedule. Reassign those shifts first.' });
  }

  const roleCount = await db
    .prepare(
      `
      SELECT COUNT(*) AS count
      FROM schedule_role_definitions
      WHERE department = ? AND is_active = 1
      `
    )
    .bind(role.department)
    .first<{ count: number }>();

  if ((roleCount?.count ?? 0) <= 1) {
    return fail(400, { error: `At least one ${role.department} role must remain.` });
  }

  await db.prepare(`DELETE FROM schedule_role_definitions WHERE id = ?`).bind(roleId).run();
  return { success: true, message: 'Schedule role deleted.' };
}
