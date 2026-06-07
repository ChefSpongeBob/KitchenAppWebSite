import { dev } from '$app/environment';
import { sendTransactionalEmail } from '$lib/server/email';
import { logOperationalError } from '$lib/server/observability';
import {
  resolveBusinessCapabilities,
  type BusinessCapability,
  type BusinessCapabilityOverrides
} from '$lib/server/permissions';

type DB = App.Platform['env']['DB'];

export type OperationalEventSeverity = 'info' | 'warning' | 'critical';
export type OperationalEventStatus = 'pending' | 'processing' | 'delivered' | 'failed' | 'skipped';
export type OperationalEventChannel = 'email' | 'push' | 'internal';
export type OperationalEventAttemptStatus = 'pending' | 'sent' | 'failed' | 'skipped';

export type OperationalEventRow = {
  id: string;
  business_id: string;
  event_type: string;
  category: string;
  severity: OperationalEventSeverity;
  actor_user_id: string | null;
  target_user_id: string | null;
  subject_type: string;
  subject_id: string;
  title: string;
  body: string;
  payload_json: string;
  metadata_json: string;
  dedupe_key: string | null;
  delivery_status: OperationalEventStatus;
  delivery_attempts: number;
  next_attempt_at: number | null;
  last_attempt_at: number | null;
  delivered_at: number | null;
  failed_at: number | null;
  expires_at: number | null;
  created_at: number;
  updated_at: number;
};

export type OperationalEventInput = {
  businessId: string;
  eventType: string;
  category: string;
  severity?: OperationalEventSeverity;
  actorUserId?: string | null;
  targetUserId?: string | null;
  subjectType?: string | null;
  subjectId?: string | null;
  title?: string | null;
  body?: string | null;
  payload?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  dedupeKey?: string | null;
  nextAttemptAt?: number | null;
  expiresAt?: number | null;
  now?: number;
};

type EmailRecipient = {
  id: string;
  email: string;
  display_name: string | null;
};

type RecipientCandidateRow = EmailRecipient & {
  business_role: string;
  permission_template: string;
  permission_overrides: string | null;
};

let operationalEventSchemaEnsured = false;
let operationalEventSchemaPromise: Promise<void> | null = null;

function asText(value: string | null | undefined, maxLength: number) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return '{}';
  }
}

function safeParseJsonObject(value: string | null | undefined) {
  try {
    const parsed = JSON.parse(value || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

async function ensureOperationalEventSchema(db: DB) {
  if (!dev) {
    operationalEventSchemaEnsured = true;
    return;
  }
  if (operationalEventSchemaEnsured) return;
  if (operationalEventSchemaPromise) {
    await operationalEventSchemaPromise;
    return;
  }

  operationalEventSchemaPromise = (async () => {
    await db
      .prepare(
        `
        CREATE TABLE IF NOT EXISTS operational_events (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          event_type TEXT NOT NULL,
          category TEXT NOT NULL,
          severity TEXT NOT NULL DEFAULT 'info',
          actor_user_id TEXT,
          target_user_id TEXT,
          subject_type TEXT NOT NULL DEFAULT '',
          subject_id TEXT NOT NULL DEFAULT '',
          title TEXT NOT NULL DEFAULT '',
          body TEXT NOT NULL DEFAULT '',
          payload_json TEXT NOT NULL DEFAULT '{}',
          metadata_json TEXT NOT NULL DEFAULT '{}',
          dedupe_key TEXT,
          delivery_status TEXT NOT NULL DEFAULT 'pending',
          delivery_attempts INTEGER NOT NULL DEFAULT 0,
          next_attempt_at INTEGER,
          last_attempt_at INTEGER,
          delivered_at INTEGER,
          failed_at INTEGER,
          expires_at INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
        `
      )
      .run();
    await db
      .prepare(
        `
        CREATE UNIQUE INDEX IF NOT EXISTS idx_operational_events_business_dedupe
        ON operational_events(business_id, dedupe_key)
        WHERE dedupe_key IS NOT NULL
        `
      )
      .run();
    await db
      .prepare(
        `
        CREATE INDEX IF NOT EXISTS idx_operational_events_business_status_next
        ON operational_events(business_id, delivery_status, next_attempt_at, created_at)
        `
      )
      .run();
    await db
      .prepare(
        `
        CREATE INDEX IF NOT EXISTS idx_operational_events_retention
        ON operational_events(delivery_status, expires_at, created_at)
        `
      )
      .run();
    await db
      .prepare(
        `
        CREATE TABLE IF NOT EXISTS operational_event_delivery_attempts (
          id TEXT PRIMARY KEY,
          event_id TEXT NOT NULL,
          business_id TEXT NOT NULL,
          channel TEXT NOT NULL,
          status TEXT NOT NULL,
          provider_message_id TEXT,
          error_message TEXT,
          attempted_at INTEGER NOT NULL
        )
        `
      )
      .run();
    operationalEventSchemaEnsured = true;
  })();

  await operationalEventSchemaPromise;
}

export async function recordOperationalEvent(db: DB, input: OperationalEventInput) {
  await ensureOperationalEventSchema(db);

  const businessId = asText(input.businessId, 80);
  const eventType = asText(input.eventType, 120);
  const category = asText(input.category, 80);
  if (!businessId || !eventType || !category) return null;

  const now = input.now ?? Math.floor(Date.now() / 1000);
  const id = crypto.randomUUID();
  const dedupeKey = asText(input.dedupeKey, 240) || null;

  await db
    .prepare(
      `
      INSERT INTO operational_events (
        id,
        business_id,
        event_type,
        category,
        severity,
        actor_user_id,
        target_user_id,
        subject_type,
        subject_id,
        title,
        body,
        payload_json,
        metadata_json,
        dedupe_key,
        delivery_status,
        delivery_attempts,
        next_attempt_at,
        expires_at,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?, ?)
      ON CONFLICT(business_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO UPDATE SET
        payload_json = excluded.payload_json,
        metadata_json = excluded.metadata_json,
        updated_at = excluded.updated_at
      `
    )
    .bind(
      id,
      businessId,
      eventType,
      category,
      input.severity ?? 'info',
      asText(input.actorUserId, 80) || null,
      asText(input.targetUserId, 80) || null,
      asText(input.subjectType, 80),
      asText(input.subjectId, 120),
      asText(input.title, 180),
      asText(input.body, 500),
      safeJson(input.payload),
      safeJson(input.metadata),
      dedupeKey,
      input.nextAttemptAt ?? now,
      input.expiresAt ?? now + 60 * 60 * 24 * 90,
      now,
      now
    )
    .run();

  return id;
}

export async function recordOperationalEventBestEffort(
  db: DB,
  input: OperationalEventInput,
  request?: Request
) {
  try {
    return await recordOperationalEvent(db, input);
  } catch (error) {
    logOperationalError({
      event: 'operational_event_record_failed',
      request,
      businessId: input.businessId,
      userId: input.actorUserId ?? null,
      error,
      metadata: {
        type: input.eventType,
        source: input.category
      }
    });
    return null;
  }
}

export async function loadPendingOperationalEvents(
  db: DB,
  businessId: string,
  limit = 100,
  now = Math.floor(Date.now() / 1000)
) {
  await ensureOperationalEventSchema(db);
  const cappedLimit = Math.max(1, Math.min(250, Math.floor(limit)));
  const rows = await db
    .prepare(
      `
      SELECT *
      FROM operational_events
      WHERE business_id = ?
        AND delivery_status = 'pending'
        AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
      ORDER BY created_at ASC
      LIMIT ?
      `
    )
    .bind(businessId, now, cappedLimit)
    .all<OperationalEventRow>();

  return rows.results ?? [];
}

export async function loadReadyOperationalEvents(
  db: DB,
  limit = 100,
  now = Math.floor(Date.now() / 1000)
) {
  await ensureOperationalEventSchema(db);
  const cappedLimit = Math.max(1, Math.min(250, Math.floor(limit)));
  const rows = await db
    .prepare(
      `
      SELECT *
      FROM operational_events
      WHERE delivery_status = 'pending'
        AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
      ORDER BY created_at ASC
      LIMIT ?
      `
    )
    .bind(now, cappedLimit)
    .all<OperationalEventRow>();

  return rows.results ?? [];
}

async function claimOperationalEvent(db: DB, event: OperationalEventRow, now: number) {
  const result = await db
    .prepare(
      `
      UPDATE operational_events
      SET delivery_status = 'processing',
          last_attempt_at = ?,
          updated_at = ?
      WHERE id = ?
        AND business_id = ?
        AND delivery_status = 'pending'
        AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
      `
    )
    .bind(now, now, event.id, event.business_id, now)
    .run();

  return Number(result.meta?.changes ?? 0) > 0;
}

export async function releaseStaleOperationalEvents(
  db: DB,
  processingTimeoutSeconds = 600,
  batchSize = 100,
  now = Math.floor(Date.now() / 1000)
) {
  await ensureOperationalEventSchema(db);
  const timeoutAt = now - Math.max(60, processingTimeoutSeconds);
  const cappedBatch = Math.max(1, Math.min(250, Math.floor(batchSize)));
  const stale = await db
    .prepare(
      `
      SELECT id, business_id
      FROM operational_events
      WHERE delivery_status = 'processing'
        AND last_attempt_at IS NOT NULL
        AND last_attempt_at < ?
      ORDER BY last_attempt_at ASC
      LIMIT ?
      `
    )
    .bind(timeoutAt, cappedBatch)
    .all<{ id: string; business_id: string }>();

  const rows = stale.results ?? [];
  if (rows.length === 0) return 0;
  await db.batch(
    rows.map((row) =>
      db
        .prepare(
          `
          UPDATE operational_events
          SET delivery_status = 'pending',
              next_attempt_at = ?,
              updated_at = ?
          WHERE id = ?
            AND business_id = ?
            AND delivery_status = 'processing'
          `
        )
        .bind(now, now, row.id, row.business_id)
    )
  );
  return rows.length;
}

export async function recordOperationalDeliveryAttempt(
  db: DB,
  args: {
    eventId: string;
    businessId: string;
    channel: OperationalEventChannel;
    status: OperationalEventAttemptStatus;
    providerMessageId?: string | null;
    errorMessage?: string | null;
    deliveryStatusOverride?: OperationalEventStatus;
    nextAttemptAt?: number | null;
    now?: number;
  }
) {
  await ensureOperationalEventSchema(db);
  const now = args.now ?? Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `
      INSERT INTO operational_event_delivery_attempts (
        id, event_id, business_id, channel, status, provider_message_id, error_message, attempted_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .bind(
      crypto.randomUUID(),
      args.eventId,
      args.businessId,
      args.channel,
      args.status,
      args.providerMessageId ?? null,
      asText(args.errorMessage, 500) || null,
      now
    )
    .run();

  const deliveryStatus: OperationalEventStatus =
    args.deliveryStatusOverride ??
    (args.status === 'sent' ? 'delivered' : args.status === 'failed' ? 'failed' : args.status);

  await db
    .prepare(
      `
      UPDATE operational_events
      SET delivery_status = ?,
          delivery_attempts = delivery_attempts + 1,
          next_attempt_at = ?,
          last_attempt_at = ?,
          delivered_at = CASE WHEN ? = 'delivered' THEN ? ELSE delivered_at END,
          failed_at = CASE WHEN ? = 'failed' THEN ? ELSE failed_at END,
          updated_at = ?
      WHERE id = ? AND business_id = ?
      `
    )
    .bind(
      deliveryStatus,
      args.nextAttemptAt ?? null,
      now,
      deliveryStatus,
      now,
      deliveryStatus,
      now,
      now,
      args.eventId,
      args.businessId
    )
    .run();
}

function textValue(value: unknown, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function boolLabel(value: unknown) {
  return value ? 'yes' : 'no';
}

function planLabel(value: unknown) {
  const normalized = textValue(value, 'selected').toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function eventBodyFromPayload(event: OperationalEventRow) {
  const payload = safeParseJsonObject(event.payload_json);
  const department = textValue(payload.department, 'the schedule');
  const weekStart = textValue(payload.weekStart);
  const sectionTitle = textValue(payload.sectionTitle, 'A list');
  const count = textValue(payload.updatedCount ?? payload.inserted);

  switch (event.event_type) {
    case 'schedule.published':
      return weekStart
        ? `The schedule for ${weekStart} has been published.`
        : 'A new schedule has been published.';
    case 'schedule.time_off.requested':
      return `A time off request was submitted for ${textValue(payload.startDate, 'the selected dates')}.`;
    case 'schedule.time_off.approved':
      return 'Your time off request was approved.';
    case 'schedule.time_off.declined':
      return 'Your time off request was declined.';
    case 'schedule.shift.offered':
      return `A ${department} shift was offered.`;
    case 'schedule.shift.requested':
      return `A ${department} shift request is ready for review.`;
    case 'schedule.open_shift.requested':
      return `An open ${department} shift was requested.`;
    case 'schedule.shift_request.approved':
      return `Your ${department} shift request was approved.`;
    case 'schedule.shift_request.declined':
      return `A ${department} shift request was declined.`;
    case 'schedule.open_shift_request.approved':
      return `Your open ${department} shift request was approved.`;
    case 'schedule.open_shift_request.declined':
      return `An open ${department} shift request was declined.`;
    case 'onboarding.package.sent':
      return 'Your onboarding package is ready.';
    case 'onboarding.item.submitted':
      return 'An onboarding item was submitted for review.';
    case 'onboarding.item.approved':
      return 'An onboarding item was approved.';
    case 'onboarding.item.changes_requested':
      return 'Changes were requested on an onboarding item.';
    case 'temperature.reading_batch.received':
      return count
        ? `${count} temperature readings were received.`
        : 'Temperature readings were received.';
    case 'camera.activity.received':
      return `${textValue(payload.cameraName, 'A camera')} recorded ${textValue(payload.eventType, 'activity')}. Image: ${boolLabel(payload.hasImage)}. Clip: ${boolLabel(payload.hasClip)}.`;
    case 'billing.conversion.queued':
      return `${planLabel(payload.planTier)} billing is queued for store activation.`;
    case 'billing.conversion.completed':
      return `${planLabel(payload.planTier)} billing is active.`;
    case 'billing.workspace.canceled':
      return 'Workspace cancellation was requested.';
    default:
      if (event.event_type.startsWith('list.') && event.event_type.endsWith('.submitted')) {
        return count ? `${sectionTitle} was submitted with ${count} updates.` : `${sectionTitle} was submitted.`;
      }
      if (event.event_type.startsWith('list.') && event.event_type.endsWith('.item_completed')) {
        return 'A list item was completed.';
      }
      if (event.event_type.startsWith('list.') && event.event_type.endsWith('.completed')) {
        return `${sectionTitle} is complete.`;
      }
      if (event.event_type.startsWith('billing.store_purchase.')) {
        return `${planLabel(payload.store)} purchase event recorded for ${textValue(payload.productId, 'a product')}.`;
      }
      return '';
  }
}

function parseEventText(event: OperationalEventRow) {
  const title = asText(event.title || event.event_type.replace(/\./g, ' '), 180);
  const body = asText(event.body || eventBodyFromPayload(event) || 'Crimini has an operational update ready.', 500);
  return { title, body };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseCapabilityOverrides(value: string | null | undefined): BusinessCapabilityOverrides {
  const overrides: BusinessCapabilityOverrides = {};
  for (const pair of String(value ?? '').split(',')) {
    const [permission, enabled] = pair.split(':');
    const key = permission?.trim() as BusinessCapability;
    if (!key) continue;
    overrides[key] = enabled === '1';
  }
  return overrides;
}

async function loadRecipientCandidates(db: DB, businessId: string) {
  const rows = await db
    .prepare(
      `
      SELECT
        u.id,
        u.email,
        u.display_name,
        COALESCE(bu.role, 'staff') AS business_role,
        COALESCE(bu.permission_template, bu.role, 'staff') AS permission_template,
        GROUP_CONCAT(erp.permission_key || ':' || erp.is_enabled) AS permission_overrides
      FROM users u
      JOIN business_users bu
        ON bu.user_id = u.id
        AND bu.business_id = ?
        AND bu.is_active = 1
      LEFT JOIN user_preferences up
        ON up.user_id = u.id
      LEFT JOIN employee_role_permissions erp
        ON erp.business_id = bu.business_id
        AND erp.user_id = u.id
      WHERE COALESCE(u.is_active, 1) = 1
        AND COALESCE(up.email_updates, 1) = 1
        AND u.email IS NOT NULL
        AND trim(u.email) <> ''
      GROUP BY u.id, u.email, u.display_name, bu.role, bu.permission_template
      ORDER BY COALESCE(u.display_name, u.email) ASC
      `
    )
    .bind(businessId)
    .all<RecipientCandidateRow>();

  return rows.results ?? [];
}

function recipientHasCapability(row: RecipientCandidateRow, capability: BusinessCapability) {
  const capabilities = resolveBusinessCapabilities(
    row.business_role,
    row.permission_template,
    parseCapabilityOverrides(row.permission_overrides)
  );
  return capabilities.includes(capability);
}

async function loadRecipientsWithCapability(db: DB, event: OperationalEventRow, capability: BusinessCapability) {
  const candidates = await loadRecipientCandidates(db, event.business_id);
  return candidates
    .filter((row) => recipientHasCapability(row, capability))
    .map(({ id, email, display_name }) => ({ id, email, display_name }));
}

function uniqueRecipients(...groups: EmailRecipient[][]) {
  const byId = new Map<string, EmailRecipient>();
  for (const group of groups) {
    for (const recipient of group) {
      if (!recipient.id || byId.has(recipient.id)) continue;
      byId.set(recipient.id, recipient);
    }
  }
  return Array.from(byId.values());
}

async function loadRecipientsForScheduleDepartment(db: DB, event: OperationalEventRow) {
  const payload = safeParseJsonObject(event.payload_json);
  const department = textValue(payload.department);
  if (!department) return [];

  const rows = await db
    .prepare(
      `
      SELECT
        u.id,
        u.email,
        u.display_name
      FROM users u
      JOIN business_users bu
        ON bu.user_id = u.id
        AND bu.business_id = ?
        AND bu.is_active = 1
      JOIN user_schedule_departments usd
        ON usd.user_id = u.id
        AND usd.business_id = bu.business_id
        AND usd.department = ?
      LEFT JOIN user_preferences up
        ON up.user_id = u.id
      WHERE COALESCE(u.is_active, 1) = 1
        AND COALESCE(up.email_updates, 1) = 1
        AND u.email IS NOT NULL
        AND trim(u.email) <> ''
        AND (? IS NULL OR u.id <> ?)
      GROUP BY u.id, u.email, u.display_name
      ORDER BY COALESCE(u.display_name, u.email) ASC
      `
    )
    .bind(event.business_id, department, event.actor_user_id, event.actor_user_id)
    .all<EmailRecipient>();

  return rows.results ?? [];
}

async function loadAllBusinessRecipients(db: DB, event: OperationalEventRow) {
  const candidates = await loadRecipientCandidates(db, event.business_id);
  return candidates.map(({ id, email, display_name }) => ({ id, email, display_name }));
}

async function loadTargetRecipient(db: DB, event: OperationalEventRow): Promise<EmailRecipient[]> {
  if (!event.target_user_id) return [];
  return db
    .prepare(
      `
      SELECT
        u.id,
        u.email,
        u.display_name
      FROM users u
      JOIN business_users bu
        ON bu.user_id = u.id
        AND bu.business_id = ?
        AND bu.is_active = 1
      LEFT JOIN user_preferences up
        ON up.user_id = u.id
      WHERE u.id = ?
        AND COALESCE(u.is_active, 1) = 1
        AND COALESCE(up.email_updates, 1) = 1
        AND u.email IS NOT NULL
        AND trim(u.email) <> ''
      LIMIT 1
      `
    )
    .bind(event.business_id, event.target_user_id)
    .first<EmailRecipient>()
    .then((recipient) => (recipient?.email ? [recipient] : []));
}

async function loadEventEmailRecipients(db: DB, event: OperationalEventRow) {
  if (event.event_type === 'schedule.published') {
    return loadAllBusinessRecipients(db, event);
  }

  if (
    [
      'schedule.time_off.requested',
      'schedule.open_shift.requested'
    ].includes(event.event_type)
  ) {
    return loadRecipientsWithCapability(db, event, 'manage_schedule');
  }

  if (event.event_type === 'schedule.shift.offered' && !event.target_user_id) {
    return loadRecipientsForScheduleDepartment(db, event);
  }

  if (event.event_type === 'schedule.shift.requested' && event.target_user_id) {
    return uniqueRecipients(
      await loadTargetRecipient(db, event),
      await loadRecipientsWithCapability(db, event, 'manage_schedule')
    );
  }

  if (event.event_type === 'onboarding.item.submitted') {
    return loadRecipientsWithCapability(db, event, 'manage_onboarding');
  }

  if (
    event.event_type.startsWith('list.') &&
    (event.event_type.endsWith('.submitted') ||
      event.event_type.endsWith('.item_completed') ||
      event.event_type.endsWith('.completed'))
  ) {
    return loadRecipientsWithCapability(db, event, 'manage_content');
  }

  if (event.event_type.startsWith('temperature.') || event.event_type.startsWith('camera.')) {
    return loadRecipientsWithCapability(db, event, 'manage_devices');
  }

  if (event.event_type.startsWith('billing.')) {
    return loadRecipientsWithCapability(db, event, 'manage_billing');
  }

  return loadTargetRecipient(db, event);
}

function retryDelaySeconds(attemptNumber: number) {
  const delays = [60, 300, 900, 3600, 10800, 21600];
  return delays[Math.min(Math.max(0, attemptNumber - 1), delays.length - 1)];
}

async function deliverEventByEmail(
  db: DB,
  env: Partial<App.Platform['env']> | undefined,
  event: OperationalEventRow
) {
  const recipients = await loadEventEmailRecipients(db, event);
  if (recipients.length === 0) {
    return { status: 'skipped' as const, reason: 'No opted-in email recipients.' };
  }

  const { title, body } = parseEventText(event);
  const safeTitle = escapeHtml(title);
  const safeBody = escapeHtml(body);

  const providerIds: string[] = [];
  const failures: string[] = [];
  const skipped: string[] = [];
  for (const recipient of recipients) {
    const safeName = escapeHtml(recipient.display_name?.trim() || 'there');
    const result = await sendTransactionalEmail({
      env,
      to: recipient.email,
      subject: title,
      html: `
        <div style="margin:0;padding:0;background:#f7f2e8;color:#181716;font-family:Georgia,'Times New Roman',serif;">
          <div style="max-width:620px;margin:0 auto;padding:30px 18px;">
            <div style="background:#fffdf8;border:1px solid #ded2bf;border-radius:24px;padding:28px;">
              <p style="margin:0 0 12px;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#7a6f61;">Crimini</p>
              <h1 style="margin:0 0 16px;font-size:28px;line-height:1.1;font-weight:400;color:#181716;">${safeTitle}</h1>
              <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#4c463f;">Hi ${safeName},</p>
              <p style="margin:0;font-size:16px;line-height:1.6;color:#292520;">${safeBody}</p>
            </div>
          </div>
        </div>
      `,
      text: [`Hi ${recipient.display_name?.trim() || 'there'},`, '', title, body].join('\n'),
      idempotencyKey: `operational/${event.id}/email/${recipient.id}`
    });

    if (result.sent) {
      if (result.id) providerIds.push(result.id);
    } else if (result.skipped) {
      skipped.push(result.reason ?? 'Email skipped.');
    } else {
      failures.push(result.reason ?? 'Email delivery failed.');
    }
  }

  if (failures.length > 0) {
    return { status: 'failed' as const, reason: failures[0] };
  }
  if (providerIds.length > 0) {
    return { status: 'sent' as const, providerMessageId: providerIds.slice(0, 10).join(',') };
  }
  return { status: 'skipped' as const, reason: skipped[0] ?? 'Email skipped.' };
}

type ProcessOperationalEventsArgs = {
  env?: Partial<App.Platform['env']>;
  request?: Request;
  limit?: number;
  maxAttempts?: number;
  now?: number;
};

export async function processOperationalEvents(db: DB, args: ProcessOperationalEventsArgs = {}) {
  await ensureOperationalEventSchema(db);
  const now = args.now ?? Math.floor(Date.now() / 1000);
  const maxAttempts = Math.max(1, Math.min(12, Math.floor(args.maxAttempts ?? 6)));
  const limit = Math.max(1, Math.min(100, Math.floor(args.limit ?? 50)));
  const released = await releaseStaleOperationalEvents(db, 600, limit, now);
  const events = await loadReadyOperationalEvents(db, limit, now);
  const summary = {
    checked: events.length,
    claimed: 0,
    delivered: 0,
    skipped: 0,
    failed: 0,
    retrying: 0,
    released
  };

  for (const event of events) {
    const claimed = await claimOperationalEvent(db, event, now);
    if (!claimed) continue;
    summary.claimed += 1;

    try {
      const delivery = await deliverEventByEmail(db, args.env, event);
      if (delivery.status === 'sent') {
        summary.delivered += 1;
        await recordOperationalDeliveryAttempt(db, {
          eventId: event.id,
          businessId: event.business_id,
          channel: 'email',
          status: 'sent',
          providerMessageId: delivery.providerMessageId,
          now
        });
        continue;
      }

      if (delivery.status === 'skipped') {
        summary.skipped += 1;
        await recordOperationalDeliveryAttempt(db, {
          eventId: event.id,
          businessId: event.business_id,
          channel: 'email',
          status: 'skipped',
          errorMessage: delivery.reason,
          now
        });
        continue;
      }

      const nextAttemptNumber = (event.delivery_attempts ?? 0) + 1;
      const finalFailure = nextAttemptNumber >= maxAttempts;
      if (finalFailure) summary.failed += 1;
      else summary.retrying += 1;

      await recordOperationalDeliveryAttempt(db, {
        eventId: event.id,
        businessId: event.business_id,
        channel: 'email',
        status: 'failed',
        errorMessage: delivery.reason,
        deliveryStatusOverride: finalFailure ? 'failed' : 'pending',
        nextAttemptAt: finalFailure ? null : now + retryDelaySeconds(nextAttemptNumber),
        now
      });
    } catch (error) {
      summary.retrying += 1;
      logOperationalError({
        event: 'operational_event_delivery_failed',
        request: args.request,
        businessId: event.business_id,
        userId: event.target_user_id,
        error,
        metadata: {
          type: event.event_type,
          source: event.category
        }
      });
      await recordOperationalDeliveryAttempt(db, {
        eventId: event.id,
        businessId: event.business_id,
        channel: 'internal',
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Delivery processor failed.',
        deliveryStatusOverride: 'pending',
        nextAttemptAt: now + retryDelaySeconds((event.delivery_attempts ?? 0) + 1),
        now
      });
    }
  }

  return summary;
}

export async function cleanupOperationalEvents(
  db: DB,
  businessId: string,
  batchSize = 250,
  now = Math.floor(Date.now() / 1000)
) {
  await ensureOperationalEventSchema(db);
  const cappedBatch = Math.max(1, Math.min(500, Math.floor(batchSize)));
  const expired = await db
    .prepare(
      `
      SELECT id
      FROM operational_events
      WHERE business_id = ?
        AND expires_at IS NOT NULL
        AND expires_at < ?
        AND delivery_status IN ('delivered', 'failed', 'skipped')
      ORDER BY expires_at ASC
      LIMIT ?
      `
    )
    .bind(businessId, now, cappedBatch)
    .all<{ id: string }>();

  const ids = (expired.results ?? []).map((row) => row.id);
  if (ids.length === 0) return 0;
  await db.batch(ids.map((id) => db.prepare(`DELETE FROM operational_events WHERE id = ? AND business_id = ?`).bind(id, businessId)));
  return ids.length;
}
