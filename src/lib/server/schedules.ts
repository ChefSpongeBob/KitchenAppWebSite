import { fail } from '@sveltejs/kit';
import {
  isValidScheduleDepartment,
  isValidScheduleRole,
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

export type ScheduleDay = {
  date: string;
  label: string;
  shifts: ScheduleShift[];
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

  scheduleSchemaEnsured = true;
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
      days: buildWeekDays(weekStart, [])
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

  return {
    week: {
      id: week.id,
      weekStart: week.week_start,
      status: week.status,
      publishedAt: week.published_at,
      updatedAt: week.updated_at
    } satisfies ScheduleWeek,
    shifts,
    days: buildWeekDays(week.week_start, shifts)
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

  return (rows.results ?? []).map((row) => ({
    id: row.id,
    displayName: row.display_name,
    email: row.email
  }));
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

  if (!isValidScheduleDepartment(department)) {
    return fail(400, { error: 'Invalid department.' });
  }

  if (!isValidScheduleRole(department, role)) {
    return fail(400, { error: 'Invalid role for that department.' });
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

    if (!isValidScheduleDepartment(department)) {
      return fail(400, { error: `Invalid department on ${shiftDate}.` });
    }

    if (!isValidScheduleRole(department, role)) {
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

  const week = await getOrCreateScheduleWeek(db, weekStart, locals.userId);
  const now = Math.floor(Date.now() / 1000);

  await db.prepare(`DELETE FROM schedule_shifts WHERE week_id = ?`).bind(week.id).run();

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
    return fail(400, { error: 'No previous week schedule was found to copy.' });
  }

  const targetWeek = await getOrCreateScheduleWeek(db, weekStart, locals.userId);
  const now = Math.floor(Date.now() / 1000);

  await db.prepare(`DELETE FROM schedule_shifts WHERE week_id = ?`).bind(targetWeek.id).run();

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

  await db
    .prepare(`UPDATE schedule_weeks SET updated_at = ?, updated_by = ? WHERE id = ?`)
    .bind(now, locals.userId, targetWeek.id)
    .run();

  return { success: true };
}
