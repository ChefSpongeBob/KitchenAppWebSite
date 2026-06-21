import { dev } from '$app/environment';
import { ensureTenantSchema } from '$lib/server/tenant';

type DB = App.Platform['env']['DB'];
type ListDomain = 'preplists' | 'inventory' | 'orders';
type ActivityDomain = ListDomain | 'checklists';

let historySchemaEnsured = false;

async function ensureHistorySchema(db: DB) {
  if (!dev) {
    historySchemaEnsured = true;
    return;
  }
  if (historySchemaEnsured) return;

  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS list_submission_batches (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        domain TEXT NOT NULL CHECK (domain IN ('preplists', 'inventory', 'orders')),
        section_id TEXT NOT NULL,
        section_title_snapshot TEXT NOT NULL,
        submitted_by TEXT,
        submitted_at INTEGER NOT NULL,
        business_day TEXT NOT NULL,
        notes TEXT
      )
      `
    )
    .run();
  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS list_submission_items (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        business_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        item_name_snapshot TEXT NOT NULL,
        details_snapshot TEXT,
        submitted_value TEXT NOT NULL DEFAULT '',
        par_count_snapshot REAL NOT NULL DEFAULT 0,
        is_checked_snapshot INTEGER NOT NULL DEFAULT 0
      )
      `
    )
    .run();
  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS list_item_activity_events (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        domain TEXT NOT NULL CHECK (domain IN ('preplists', 'inventory', 'orders', 'checklists')),
        section_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        item_name_snapshot TEXT NOT NULL,
        event_type TEXT NOT NULL,
        actor_user_id TEXT,
        occurred_at INTEGER NOT NULL,
        value_snapshot TEXT
      )
      `
    )
    .run();
  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS schedule_publish_history (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        schedule_week_id TEXT NOT NULL,
        week_start TEXT NOT NULL,
        published_by TEXT,
        published_at INTEGER NOT NULL,
        version_number INTEGER NOT NULL,
        notes TEXT
      )
      `
    )
    .run();
  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS schedule_shift_history (
        id TEXT PRIMARY KEY,
        publish_history_id TEXT NOT NULL,
        business_id TEXT NOT NULL,
        shift_id_snapshot TEXT NOT NULL,
        shift_date TEXT NOT NULL,
        user_id TEXT,
        employee_name_snapshot TEXT NOT NULL,
        department TEXT NOT NULL,
        role_name TEXT NOT NULL,
        detail TEXT,
        start_time TEXT NOT NULL,
        end_label TEXT,
        break_minutes INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0
      )
      `
    )
    .run();

  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_list_submission_batches_business_day ON list_submission_batches(business_id, domain, business_day, submitted_at)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_list_submission_items_batch ON list_submission_items(batch_id, business_id)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_list_item_activity_business_time ON list_item_activity_events(business_id, domain, occurred_at)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_list_item_activity_lookup ON list_item_activity_events(business_id, domain, item_id, occurred_at)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_schedule_publish_history_week ON schedule_publish_history(business_id, week_start, version_number)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_schedule_shift_history_publish ON schedule_shift_history(publish_history_id, business_id, shift_date)`).run();

  historySchemaEnsured = true;
}

function businessDayFromUnix(seconds: number) {
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}

export async function recordListSubmission(
  db: DB,
  businessId: string,
  domain: ListDomain,
  sectionId: string,
  submittedBy: string | null | undefined,
  valuesByItemId: Map<string, string>
) {
  await ensureHistorySchema(db);
  await ensureTenantSchema(db, true);

  const section = await db
    .prepare(`SELECT title FROM list_sections WHERE id = ? AND business_id = ? LIMIT 1`)
    .bind(sectionId, businessId)
    .first<{ title: string }>();
  if (!section) return;

  const itemIds = Array.from(valuesByItemId.keys()).filter(Boolean);
  if (itemIds.length === 0) return;
  const placeholders = itemIds.map(() => '?').join(', ');
  const rows = await db
    .prepare(
      `
      SELECT id, content, COALESCE(details, '') AS details, COALESCE(par_count, 0) AS par_count, COALESCE(is_checked, 0) AS is_checked
      FROM list_items
      WHERE business_id = ?
        AND section_id = ?
        AND id IN (${placeholders})
      ORDER BY sort_order ASC, created_at ASC
      `
    )
    .bind(businessId, sectionId, ...itemIds)
    .all<{
      id: string;
      content: string;
      details: string | null;
      par_count: number | null;
      is_checked: number | null;
    }>();

  const now = Math.floor(Date.now() / 1000);
  const batchId = crypto.randomUUID();
  await db
    .prepare(
      `
      INSERT INTO list_submission_batches (
        id, business_id, domain, section_id, section_title_snapshot, submitted_by, submitted_at, business_day
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .bind(batchId, businessId, domain, sectionId, section.title, submittedBy ?? null, now, businessDayFromUnix(now))
    .run();

  for (const row of rows.results ?? []) {
    await db
      .prepare(
        `
        INSERT INTO list_submission_items (
          id, batch_id, business_id, item_id, item_name_snapshot, details_snapshot,
          submitted_value, par_count_snapshot, is_checked_snapshot
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .bind(
        crypto.randomUUID(),
        batchId,
        businessId,
        row.id,
        row.content,
        row.details ?? '',
        valuesByItemId.get(row.id) ?? '',
        row.par_count ?? 0,
        row.is_checked ?? 0
      )
      .run();
  }
}

export async function recordListItemActivity(
  db: DB,
  businessId: string,
  domain: ActivityDomain,
  sectionId: string,
  itemId: string,
  eventType: string,
  actorUserId: string | null | undefined,
  valueSnapshot: string
) {
  await ensureHistorySchema(db);
  await ensureTenantSchema(db, true);

  const table = domain === 'checklists' ? 'checklist_items' : 'list_items';
  const item = await db
    .prepare(`SELECT content FROM ${table} WHERE id = ? AND business_id = ? LIMIT 1`)
    .bind(itemId, businessId)
    .first<{ content: string }>();
  if (!item) return;

  await db
    .prepare(
      `
      INSERT INTO list_item_activity_events (
        id, business_id, domain, section_id, item_id, item_name_snapshot,
        event_type, actor_user_id, occurred_at, value_snapshot
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .bind(
      crypto.randomUUID(),
      businessId,
      domain,
      sectionId,
      itemId,
      item.content,
      eventType,
      actorUserId ?? null,
      Math.floor(Date.now() / 1000),
      valueSnapshot
    )
    .run();
}

export async function recordSchedulePublishSnapshot(
  db: DB,
  businessId: string,
  weekId: string,
  weekStart: string,
  publishedBy: string | null | undefined,
  publishedAt: number,
  notes = ''
) {
  await ensureHistorySchema(db);
  await ensureTenantSchema(db, true);

  const previous = await db
    .prepare(
      `
      SELECT COALESCE(MAX(version_number), 0) AS max_version
      FROM schedule_publish_history
      WHERE business_id = ?
        AND schedule_week_id = ?
      `
    )
    .bind(businessId, weekId)
    .first<{ max_version: number }>();
  const versionNumber = (previous?.max_version ?? 0) + 1;
  const publishHistoryId = crypto.randomUUID();

  await db
    .prepare(
      `
      INSERT INTO schedule_publish_history (
        id, business_id, schedule_week_id, week_start, published_by, published_at, version_number, notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .bind(publishHistoryId, businessId, weekId, weekStart, publishedBy ?? null, publishedAt, versionNumber, notes || null)
    .run();

  const shifts = await db
    .prepare(
      `
      SELECT
        s.id,
        s.shift_date,
        s.user_id,
        COALESCE(u.display_name, u.email, 'Open') AS employee_name,
        s.department,
        s.role,
        s.detail,
        s.start_time,
        s.end_label,
        COALESCE(s.break_minutes, 0) AS break_minutes,
        s.notes,
        COALESCE(s.sort_order, 0) AS sort_order
      FROM schedule_shifts s
      LEFT JOIN users u ON u.id = s.user_id
      WHERE s.business_id = ?
        AND s.week_id = ?
      ORDER BY s.shift_date ASC, s.start_time ASC, s.sort_order ASC
      `
    )
    .bind(businessId, weekId)
    .all<{
      id: string;
      shift_date: string;
      user_id: string | null;
      employee_name: string;
      department: string;
      role: string;
      detail: string | null;
      start_time: string;
      end_label: string | null;
      break_minutes: number | null;
      notes: string | null;
      sort_order: number | null;
    }>();

  for (const shift of shifts.results ?? []) {
    await db
      .prepare(
        `
        INSERT INTO schedule_shift_history (
          id, publish_history_id, business_id, shift_id_snapshot, shift_date, user_id,
          employee_name_snapshot, department, role_name, detail, start_time, end_label,
          break_minutes, notes, sort_order
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .bind(
        crypto.randomUUID(),
        publishHistoryId,
        businessId,
        shift.id,
        shift.shift_date,
        shift.user_id,
        shift.employee_name,
        shift.department,
        shift.role,
        shift.detail ?? '',
        shift.start_time,
        shift.end_label ?? '',
        shift.break_minutes ?? 0,
        shift.notes ?? '',
        shift.sort_order ?? 0
      )
      .run();
  }
}

function clampRange(start: string | null, end: string | null, fallbackDays: number) {
  const today = new Date();
  const endDate = end && /^\d{4}-\d{2}-\d{2}$/.test(end) ? end : today.toISOString().slice(0, 10);
  const startFallback = new Date(today);
  startFallback.setDate(startFallback.getDate() - fallbackDays);
  const startDate = start && /^\d{4}-\d{2}-\d{2}$/.test(start) ? start : startFallback.toISOString().slice(0, 10);
  return { startDate, endDate };
}

export async function loadListHistoryReport(
  db: DB,
  businessId: string,
  domain: ActivityDomain,
  params: { start?: string | null; end?: string | null; sectionId?: string | null; submittedAt?: string | number | null } = {}
) {
  await ensureHistorySchema(db);
  const { startDate, endDate } = clampRange(params.start ?? null, params.end ?? null, 14);
  const submittedAt = Number(params.submittedAt);
  const hasSubmittedAt = Number.isFinite(submittedAt) && submittedAt > 0;
  if (domain === 'checklists') {
    const sectionClause = params.sectionId ? `AND a.section_id = ?` : '';
    const submittedClause = hasSubmittedAt ? `AND a.occurred_at = ?` : '';
    const binds = [
      businessId,
      startDate,
      endDate,
      ...(params.sectionId ? [params.sectionId] : []),
      ...(hasSubmittedAt ? [submittedAt] : [])
    ];

    const rows = await db
      .prepare(
        `
        SELECT
          date(a.occurred_at, 'unixepoch') AS business_day,
          a.occurred_at AS submitted_at,
          COALESCE(s.title, 'Checklist') AS section_title_snapshot,
          COALESCE(u.display_name, u.email, 'Unknown') AS submitted_by_name,
          a.item_name_snapshot,
          '' AS details_snapshot,
          CASE WHEN a.event_type = 'completed' THEN 'Complete' ELSE 'Reopened' END AS submitted_value,
          0 AS par_count_snapshot,
          CASE WHEN a.event_type = 'completed' THEN 1 ELSE 0 END AS is_checked_snapshot,
          CASE WHEN a.event_type = 'completed' THEN COALESCE(u.display_name, u.email, 'Unknown') ELSE NULL END AS completed_by_name,
          CASE WHEN a.event_type = 'completed' THEN a.occurred_at ELSE NULL END AS completed_at,
          a.event_type
        FROM list_item_activity_events a
        LEFT JOIN checklist_sections s
          ON s.id = a.section_id
          AND s.business_id = a.business_id
        LEFT JOIN users u ON u.id = a.actor_user_id
        WHERE a.business_id = ?
          AND a.domain = 'checklists'
          AND date(a.occurred_at, 'unixepoch') BETWEEN ? AND ?
          ${sectionClause}
          ${submittedClause}
        ORDER BY a.occurred_at DESC, section_title_snapshot ASC, a.item_name_snapshot ASC
        LIMIT 1000
        `
      )
      .bind(...binds)
      .all<{
        business_day: string;
        submitted_at: number;
        section_title_snapshot: string;
        submitted_by_name: string;
        item_name_snapshot: string;
        details_snapshot: string | null;
        submitted_value: string;
        par_count_snapshot: number;
        is_checked_snapshot: number;
        completed_by_name: string | null;
        completed_at: number | null;
        event_type: string;
      }>();

    return { startDate, endDate, rows: rows.results ?? [] };
  }

  const sectionClause = params.sectionId ? `AND b.section_id = ?` : '';
  const submittedClause = hasSubmittedAt ? `AND b.submitted_at = ?` : '';
  const binds = [
    businessId,
    domain,
    startDate,
    endDate,
    ...(params.sectionId ? [params.sectionId] : []),
    ...(hasSubmittedAt ? [submittedAt] : [])
  ];

  const rows = await db
    .prepare(
      `
      SELECT
        b.business_day,
        b.submitted_at,
        b.section_title_snapshot,
        COALESCE(u.display_name, u.email, 'Unknown') AS submitted_by_name,
        i.item_name_snapshot,
        i.details_snapshot,
        i.submitted_value,
        i.par_count_snapshot,
        i.is_checked_snapshot,
        (
          SELECT COALESCE(au.display_name, au.email, 'Unknown')
          FROM list_item_activity_events a
          LEFT JOIN users au ON au.id = a.actor_user_id
          WHERE a.business_id = b.business_id
            AND a.domain = b.domain
            AND a.section_id = b.section_id
            AND a.item_id = i.item_id
            AND a.event_type = 'completed'
            AND a.occurred_at <= b.submitted_at
          ORDER BY a.occurred_at DESC
          LIMIT 1
        ) AS completed_by_name,
        (
          SELECT a.occurred_at
          FROM list_item_activity_events a
          WHERE a.business_id = b.business_id
            AND a.domain = b.domain
            AND a.section_id = b.section_id
            AND a.item_id = i.item_id
            AND a.event_type = 'completed'
            AND a.occurred_at <= b.submitted_at
          ORDER BY a.occurred_at DESC
          LIMIT 1
        ) AS completed_at,
        'submitted' AS event_type
      FROM list_submission_items i
      JOIN list_submission_batches b ON b.id = i.batch_id AND b.business_id = i.business_id
      LEFT JOIN users u ON u.id = b.submitted_by
      WHERE b.business_id = ?
        AND b.domain = ?
        AND b.business_day BETWEEN ? AND ?
        ${sectionClause}
        ${submittedClause}
      ORDER BY b.business_day DESC, b.submitted_at DESC, b.section_title_snapshot ASC, i.item_name_snapshot ASC
      LIMIT 1000
      `
    )
    .bind(...binds)
    .all<{
      business_day: string;
      submitted_at: number;
      section_title_snapshot: string;
      submitted_by_name: string;
      item_name_snapshot: string;
      details_snapshot: string | null;
      submitted_value: string;
      par_count_snapshot: number;
      is_checked_snapshot: number;
      completed_by_name: string | null;
      completed_at: number | null;
      event_type: string;
    }>();

  return { startDate, endDate, rows: rows.results ?? [] };
}

export async function loadScheduleHistoryReport(
  db: DB,
  businessId: string,
  params: { start?: string | null; end?: string | null; version?: string | number | null } = {}
) {
  await ensureHistorySchema(db);
  const { startDate, endDate } = clampRange(params.start ?? null, params.end ?? null, 60);
  const versionNumber = Number(params.version);
  const hasVersionFilter = Number.isFinite(versionNumber) && versionNumber > 0;
  const rows = await db
    .prepare(
      `
      SELECT
        p.week_start,
        p.version_number,
        p.published_at,
        COALESCE(u.display_name, u.email, 'Unknown') AS published_by_name,
        s.shift_date,
        s.employee_name_snapshot,
        s.department,
        s.role_name,
        s.detail,
        s.start_time,
        s.end_label,
        s.break_minutes,
        s.notes
      FROM schedule_shift_history s
      JOIN schedule_publish_history p ON p.id = s.publish_history_id AND p.business_id = s.business_id
      LEFT JOIN users u ON u.id = p.published_by
      WHERE p.business_id = ?
        AND p.week_start BETWEEN ? AND ?
        ${hasVersionFilter ? 'AND p.version_number = ?' : ''}
      ORDER BY p.week_start DESC, p.version_number DESC, s.shift_date ASC, s.start_time ASC
      LIMIT 1500
      `
    )
    .bind(businessId, startDate, endDate, ...(hasVersionFilter ? [versionNumber] : []))
    .all<{
      week_start: string;
      version_number: number;
      published_at: number;
      published_by_name: string;
      shift_date: string;
      employee_name_snapshot: string;
      department: string;
      role_name: string;
      detail: string | null;
      start_time: string;
      end_label: string | null;
      break_minutes: number;
      notes: string | null;
    }>();

  return { startDate, endDate, rows: rows.results ?? [] };
}

export function csvEscape(value: unknown) {
  const raw = String(value ?? '');
  const text = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
