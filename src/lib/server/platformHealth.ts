import { error } from '@sveltejs/kit';
import { TEMPERATURE_ONLINE_WINDOW_SECONDS } from '$lib/server/temperatureMonitoring';
import { staffPageNumber, type PlatformStaffRole } from '$lib/server/platformStaff';

type DB = App.Platform['env']['DB'];
export type StaffQueueStatus = 'pending' | 'processing' | 'failed';
const PAGE_SIZE = 20;

export function staffQueueStatus(value: string | null): StaffQueueStatus {
  return value === 'pending' || value === 'processing' ? value : 'failed';
}

export function gatewayConnection(lastSeenAt: number | null, now: number) {
  if (!lastSeenAt || lastSeenAt < 0) return 'Never connected';
  if (lastSeenAt > now + 60) return 'Timestamp issue';
  return now - lastSeenAt < TEMPERATURE_ONLINE_WINDOW_SECONDS ? 'Online' : 'Offline';
}

type QueueRow = {
  id: string; category: string; delivery_status: StaffQueueStatus; delivery_attempts: number;
  created_at: number; updated_at: number; next_attempt_at: number | null;
  last_attempt_at: number | null; expires_at: number | null;
};

export function queueCondition(row: QueueRow, now: number) {
  if (row.delivery_status === 'failed') return 'Delivery failed';
  if (row.delivery_status === 'processing') {
    return now - (row.last_attempt_at ?? row.updated_at) > 600 ? 'Processing delayed' : 'Processing';
  }
  if (row.expires_at !== null && row.expires_at <= now) return 'Expired';
  if (row.next_attempt_at !== null && row.next_attempt_at > now) {
    return row.delivery_attempts > 0 ? 'Retry scheduled' : 'Scheduled';
  }
  return now - Math.max(row.created_at, row.next_attempt_at ?? row.created_at) > 600 ? 'Waiting' : 'Ready';
}

const categoryLabels: Record<string, string> = {
  schedule: 'Scheduling', lists: 'Lists', onboarding: 'Onboarding', billing: 'Billing', temperature: 'Temperature'
};

export async function loadStaffHealth(db: DB, role: PlatformStaffRole, url: URL, now = Math.floor(Date.now() / 1000)) {
  if (!['owner', 'support', 'equipment'].includes(role)) error(403, 'Staff access required.');
  const businessId = String(url.searchParams.get('business') ?? '').trim();
  if (businessId.length > 80) error(404, 'Business not found.');
  const gatewayPage = staffPageNumber(url.searchParams.get('gateways'));
  const queuePage = staffPageNumber(url.searchParams.get('jobs'));
  const attemptPage = staffPageNumber(url.searchParams.get('attempts'));
  const queueStatus = staffQueueStatus(url.searchParams.get('queue'));
  const controls = { gatewayPage, queuePage, attemptPage, queueStatus };
  const canViewDelivery = role === 'owner' || role === 'support';
  if (!businessId) return { checkedAt: now, business: null, controls, gateways: [], moreGateways: false,
    delivery: null, canViewDelivery };

  const business = await db.prepare('SELECT id, name FROM businesses WHERE id = ? LIMIT 1')
    .bind(businessId).first<{ id: string; name: string }>();
  if (!business) error(404, 'Business not found.');

  const gatewayRows = await db.prepare(`
    SELECT id, external_device_id, display_name, last_seen_at
    FROM iot_devices WHERE business_id = ? AND device_type = 'sensor_gateway'
      AND is_active = 1 AND revoked_at IS NULL
    ORDER BY id LIMIT ? OFFSET ?
  `).bind(businessId, PAGE_SIZE + 1, (gatewayPage - 1) * PAGE_SIZE)
    .all<{ id: string; external_device_id: string; display_name: string; last_seen_at: number | null }>();
  const gateways = gatewayRows.results.slice(0, PAGE_SIZE).map(row => ({
    ...row, connection: gatewayConnection(row.last_seen_at, now)
  }));

  let delivery = null;
  if (canViewDelivery) {
    // Select status metadata only; message bodies, recipients, payloads and provider errors stay private.
    const [jobRows, attemptRows] = await Promise.all([
      db.prepare(`SELECT id,
        CASE WHEN category IN ('schedule', 'lists', 'onboarding', 'billing', 'temperature') THEN category ELSE 'other' END AS category,
        delivery_status, delivery_attempts, created_at, updated_at, next_attempt_at, last_attempt_at, expires_at
        FROM operational_events WHERE business_id = ? AND delivery_status = ?
        ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?
      `).bind(businessId, queueStatus, PAGE_SIZE + 1, (queuePage - 1) * PAGE_SIZE).all<QueueRow>(),
      db.prepare(`SELECT a.id, a.attempted_at,
        CASE WHEN a.channel IN ('email', 'push', 'internal') THEN a.channel ELSE 'other' END AS channel,
        CASE WHEN a.status IN ('pending', 'sent', 'failed', 'skipped') THEN a.status ELSE 'unknown' END AS status
        FROM operational_event_delivery_attempts a
        JOIN operational_events e ON e.id = a.event_id AND e.business_id = a.business_id
        WHERE a.business_id = ?
        ORDER BY a.attempted_at DESC, a.id DESC LIMIT ? OFFSET ?
      `).bind(businessId, PAGE_SIZE + 1, (attemptPage - 1) * PAGE_SIZE)
        .all<{ id: string; attempted_at: number; channel: string; status: string }>()
    ]);
    delivery = {
      jobs: jobRows.results.slice(0, PAGE_SIZE).map(row => ({
        id: row.id, category: categoryLabels[row.category] ?? 'Other', attempts: row.delivery_attempts,
        createdAt: row.created_at, nextAttemptAt: row.next_attempt_at, condition: queueCondition(row, now)
      })),
      moreJobs: jobRows.results.length > PAGE_SIZE,
      attempts: attemptRows.results.slice(0, PAGE_SIZE).map(row => ({
        id: row.id, attemptedAt: row.attempted_at,
        channel: ({ email: 'Email', push: 'Push', internal: 'Processor' } as Record<string, string>)[row.channel] ?? 'Other',
        status: ({ sent: 'Accepted', pending: 'Pending', failed: 'Failed', skipped: 'Skipped' } as Record<string, string>)[row.status] ?? 'Unknown',
        issue: row.status === 'failed' ? (row.channel === 'email' ? 'Email delivery failed' : 'Notification processing failed') : null
      })),
      moreAttempts: attemptRows.results.length > PAGE_SIZE
    };
  }
  return { checkedAt: now, business, controls, gateways, moreGateways: gatewayRows.results.length > PAGE_SIZE,
    delivery, canViewDelivery };
}
