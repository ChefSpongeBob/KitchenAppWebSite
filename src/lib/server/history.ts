import { dev } from '$app/env';
import { ensureTenantSchema } from '#lib/server/tenant.ts';
import { getBusinessDate } from '#lib/timeZones.ts';
import { addReportDays } from '#lib/reportDates.ts';
import { completedChecklistRunStatements, CHECKLIST_HISTORY_SECONDS } from '#lib/server/checklistHistory.ts';
import { reportRange, reportRows, reportRowLimit, type ReportOptions } from '#lib/server/reporting.ts';

type DB = App.RuntimeEnv['DB'];
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
  valuesByItemId: Map<string, string>,
  updates: ReturnType<DB['prepare']>[] = []
) {
  await ensureHistorySchema(db);
  await ensureTenantSchema(db, true);

  const section = await db
    .prepare(`SELECT title FROM list_sections WHERE id = ? AND business_id = ? LIMIT 1`)
    .bind(sectionId, businessId)
    .first<{ title: string }>();
  if (!section) return false;

  const itemIds = Array.from(valuesByItemId.keys()).filter(Boolean);
  if (itemIds.length === 0) return false;
  const rows = await db
    .prepare(
      `
      SELECT id, content, COALESCE(details, '') AS details, COALESCE(par_count, 0) AS par_count, COALESCE(is_checked, 0) AS is_checked,
        completed_at, (SELECT COALESCE(display_name, email, 'Unknown') FROM users WHERE id = list_items.completed_by) AS completed_by_name
      FROM list_items
      WHERE business_id = ?
        AND section_id = ?
        AND id IN (SELECT value FROM json_each(?))
      ORDER BY sort_order ASC, created_at ASC
      `
    )
    .bind(businessId, sectionId, JSON.stringify(itemIds))
    .all<{
      id: string;
      content: string;
      details: string | null;
      par_count: number | null;
      is_checked: number | null;
      completed_by_name: string | null;
      completed_at: number | null;
    }>();

  if (!rows.results?.length) return false;
  const now = Math.floor(Date.now() / 1000);
  const batchId = crypto.randomUUID();
  const statements = [...updates, db
    .prepare(
      `
      INSERT INTO list_submission_batches (
        id, business_id, domain, section_id, section_title_snapshot, submitted_by, submitted_at, business_day, submitted_by_name_snapshot
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(display_name, email, 'Unknown') FROM users WHERE id = ?))
      `
    )
    .bind(batchId, businessId, domain, sectionId, section.title, submittedBy ?? null, now, businessDayFromUnix(now), submittedBy ?? null),
    ...rows.results.map((row) => db
      .prepare(
        `
        INSERT INTO list_submission_items (
          id, batch_id, business_id, item_id, item_name_snapshot, details_snapshot,
          submitted_value, par_count_snapshot, is_checked_snapshot, completed_by_name_snapshot, completed_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        row.is_checked ?? 0,
        row.is_checked ? row.completed_by_name ?? 'Not recorded' : '',
        row.is_checked ? row.completed_at : null
      ))];
  await db.batch(statements);
  return true;
}

export async function setListItemCompletion(
  db: DB,
  businessId: string,
  domain: ActivityDomain,
  sectionId: string,
  itemId: string,
  actorUserId: string | null | undefined,
  isChecked: number
) {
  await ensureHistorySchema(db);
  await ensureTenantSchema(db, true);

  const table = domain === 'checklists' ? 'checklist_items' : 'list_items';
  const now = Math.floor(Date.now() / 1000);
  // changes() binds the history row to this transition inside the same D1 transaction.
  const results = await db.batch([
    db.prepare(`UPDATE ${table} SET is_checked = ?, updated_at = ?
      , completed_by = ?, completed_at = ?
      WHERE id = ? AND section_id = ? AND business_id = ? AND COALESCE(is_checked, 0) <> ?`)
      .bind(isChecked, now, isChecked ? actorUserId ?? null : null, isChecked ? now : null,
        itemId, sectionId, businessId, isChecked),
    db
    .prepare(
      `
      INSERT INTO list_item_activity_events (
        id, business_id, domain, section_id, item_id, item_name_snapshot,
        event_type, actor_user_id, occurred_at, value_snapshot
      )
      SELECT ?, ?, ?, ?, id, content, 'completed', ?, ?, ?
      FROM ${table} WHERE id = ? AND section_id = ? AND business_id = ? AND changes() = 1 AND ? = 1
      `
    )
    .bind(
      crypto.randomUUID(),
      businessId,
      domain,
      sectionId,
      actorUserId ?? null,
      now,
      String(isChecked),
      itemId,
      sectionId,
      businessId,
      isChecked
    ),
    ...(domain === 'checklists' && isChecked === 1 ? completedChecklistRunStatements(db, businessId, sectionId, actorUserId, now) : [])
  ]);
  if (results[0].meta.changes) return { changed: true };
  const item = await db.prepare(`SELECT id FROM ${table} WHERE id = ? AND section_id = ? AND business_id = ?`)
    .bind(itemId, sectionId, businessId).first();
  return item ? { changed: false } : null;
}

export async function recordSchedulePublishSnapshot(
  db: DB,
  businessId: string,
  weekId: string,
  weekStart: string,
  publishedBy: string | null | undefined,
  publishedAt: number,
  writeToken: string,
  notes = '',
  completionStatements: ReturnType<DB['prepare']>[] = [],
  preparationStatements: ReturnType<DB['prepare']>[] = []
) {
  await ensureHistorySchema(db);
  await ensureTenantSchema(db, true);

  const publishHistoryId = crypto.randomUUID();

  return db.batch([
    ...preparationStatements,
    db
      .prepare(
      `
      INSERT INTO schedule_publish_history (
        id, business_id, schedule_week_id, week_start, published_by, published_at, version_number, notes
      )
      SELECT ?, ?, ?, ?, ?, ?, COALESCE((
        SELECT MAX(version_number)
        FROM schedule_publish_history
        WHERE business_id = ? AND schedule_week_id = ?
      ), 0) + 1, ?
      FROM schedule_weeks guard
      WHERE guard.id = ? AND guard.business_id = ? AND guard.draft_write_token = ?
      `
    )
      .bind(
        publishHistoryId,
        businessId,
        weekId,
        weekStart,
        publishedBy ?? null,
        publishedAt,
        businessId,
        weekId,
        notes || null,
        weekId,
        businessId,
        writeToken
      ),
    db
      .prepare(
      `
      INSERT INTO schedule_shift_history (
        id, publish_history_id, business_id, shift_id_snapshot, shift_date, user_id,
        employee_name_snapshot, department, role_name, detail, start_time, end_label,
        break_minutes, notes, sort_order
      )
      SELECT
        ? || ':' || s.id,
        ?,
        s.business_id,
        s.id,
        s.shift_date,
        s.user_id,
        COALESCE(u.display_name, u.email, 'Open') AS employee_name,
        s.department,
        s.role,
        COALESCE(s.detail, ''),
        s.start_time,
        COALESCE(s.end_label, ''),
        COALESCE(s.break_minutes, 0) AS break_minutes,
        COALESCE(s.notes, ''),
        COALESCE(s.sort_order, 0) AS sort_order
      FROM schedule_shifts s
      LEFT JOIN business_users member
        ON member.business_id = s.business_id
       AND member.user_id = s.user_id
      LEFT JOIN users u ON u.id = member.user_id
      WHERE s.business_id = ?
        AND s.week_id = ?
        AND EXISTS (
          SELECT 1 FROM schedule_weeks guard
          WHERE guard.id = ? AND guard.business_id = ? AND guard.draft_write_token = ?
        )
      `
    )
      .bind(publishHistoryId, publishHistoryId, businessId, weekId, weekId, businessId, writeToken),
    ...completionStatements
  ]);
}

export async function loadListHistoryReport(
  db: DB,
  businessId: string,
  domain: ActivityDomain,
  params: ReportOptions & { sectionId?: string | null; submittedAt?: string | number | null; batchId?: string | null } = {}
) {
  await ensureHistorySchema(db);
  const { startDate, endDate, timeZone, startTs, endTs, dateAt } = reportRange(params, 14);
  const submittedAt = Number(params.submittedAt);
  const hasSubmittedAt = Number.isFinite(submittedAt) && submittedAt > 0;
  if (domain === 'checklists') {
    const rows = await db.prepare(`
      SELECT r.id AS batch_id, r.section_id, r.submitted_at,
        r.section_title_snapshot, r.submitted_by_name_snapshot AS submitted_by_name,
        i.item_name_snapshot, '' AS details_snapshot, 'Complete' AS submitted_value,
        0 AS par_count_snapshot, 1 AS is_checked_snapshot,
        i.completed_by_name_snapshot AS completed_by_name, i.completed_at, 'completed' AS event_type
      FROM checklist_completed_runs r JOIN checklist_completed_run_items i ON i.run_id = r.id AND i.business_id = r.business_id
      WHERE r.business_id = ? AND r.submitted_at >= ? AND r.submitted_at < ? AND r.submitted_at >= ?
        ${params.sectionId ? 'AND r.section_id = ?' : ''}
        ${params.batchId ? 'AND r.id = ?' : ''}
      ORDER BY r.submitted_at DESC, r.id ASC, i.item_id ASC
      LIMIT ${reportRowLimit(params)}
    `).bind(businessId, startTs, endTs, Math.floor(Date.now() / 1000) - CHECKLIST_HISTORY_SECONDS,
      ...(params.sectionId ? [params.sectionId] : []), ...(params.batchId ? [params.batchId] : [])).all<{
        batch_id: string; section_id: string; submitted_at: number; section_title_snapshot: string;
        submitted_by_name: string; item_name_snapshot: string; details_snapshot: string;
        submitted_value: string; par_count_snapshot: number; is_checked_snapshot: number;
        completed_by_name: string | null; completed_at: number | null; event_type: string;
      }>();
    return { startDate, endDate, timeZone, recentStart: addReportDays(getBusinessDate(timeZone), -6), ...reportRows((rows.results ?? []).map(row => ({ ...row,
      business_day: dateAt(row.submitted_at)
    })), params) };
  }

  const sectionClause = params.sectionId ? `AND b.section_id = ?` : '';
  const submittedClause = hasSubmittedAt ? `AND b.submitted_at = ?` : '';
  const batchClause = params.batchId ? 'AND b.id = ?' : '';
  const binds = [
    businessId,
    domain,
    startTs,
    endTs,
    ...(params.sectionId ? [params.sectionId] : []),
    ...(hasSubmittedAt ? [submittedAt] : []),
    ...(params.batchId ? [params.batchId] : [])
  ];

  const rows = await db
    .prepare(
      `
      SELECT
        b.id AS batch_id,
        b.section_id,
        b.business_day,
        b.submitted_at,
        b.section_title_snapshot,
        COALESCE(b.submitted_by_name_snapshot, u.display_name, u.email, 'Unknown') AS submitted_by_name,
        i.item_name_snapshot,
        i.details_snapshot,
        i.submitted_value,
        i.par_count_snapshot,
        i.is_checked_snapshot,
        CASE WHEN i.is_checked_snapshot = 1 THEN COALESCE(i.completed_by_name_snapshot, 'Not recorded') ELSE '' END AS completed_by_name,
        i.completed_at,
        'submitted' AS event_type
      FROM list_submission_items i
      JOIN list_submission_batches b ON b.id = i.batch_id AND b.business_id = i.business_id
      LEFT JOIN users u ON u.id = b.submitted_by
      WHERE b.business_id = ?
        AND b.domain = ?
        AND b.submitted_at >= ? AND b.submitted_at < ?
        ${sectionClause}
        ${submittedClause}
        ${batchClause}
      ORDER BY b.submitted_at DESC, b.id ASC, i.id ASC
      LIMIT ${reportRowLimit(params)}
      `
    )
    .bind(...binds)
    .all<{
      batch_id: string;
      section_id: string;
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

  return { startDate, endDate, timeZone, ...reportRows((rows.results ?? []).map(row => ({ ...row,
    business_day: dateAt(row.submitted_at)
  })), params) };
}

export async function loadScheduleHistoryReport(
  db: DB,
  businessId: string,
  params: ReportOptions & { version?: string | number | null; publishId?: string | null } = {}
) {
  await ensureHistorySchema(db);
  const { startDate, endDate, timeZone, startTs, endTs } = reportRange(params, 60);
  const versionNumber = Number(params.version);
  const hasVersionFilter = Number.isFinite(versionNumber) && versionNumber > 0;
  const rows = await db
    .prepare(
      `
      SELECT
        p.id AS publish_id,
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
        ${params.publishId ? 'AND p.id = ?' : ''}
      ORDER BY p.week_start DESC, p.version_number DESC, s.shift_date ASC, s.start_time ASC, s.id ASC
      LIMIT ${reportRowLimit(params, 1500)}
      `
    )
    .bind(businessId, startDate, endDate, ...(hasVersionFilter ? [versionNumber] : []), ...(params.publishId ? [params.publishId] : []))
    .all<{
      publish_id: string;
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

  return { startDate, endDate, timeZone, ...reportRows(rows.results ?? [], params, 1500) };
}

export { csvEscape } from '#lib/server/csv.ts';
