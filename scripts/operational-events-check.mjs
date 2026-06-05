import { existsSync, readFileSync } from 'node:fs';

const checks = [];

function read(path) {
  return readFileSync(path, 'utf8');
}

function expect(path, label, predicate) {
  if (!existsSync(path)) {
    checks.push({ ok: false, label, detail: `${path} does not exist.` });
    return;
  }
  const source = read(path);
  checks.push({ ok: Boolean(predicate(source)), label, detail: path });
}

expect('migrations/0076_operational_events.sql', 'operational outbox migration creates durable event tables', (source) =>
  source.includes('CREATE TABLE IF NOT EXISTS operational_events') &&
  source.includes('CREATE TABLE IF NOT EXISTS operational_event_delivery_attempts') &&
  source.includes('idx_operational_events_business_status_next') &&
  source.includes('idx_operational_events_business_dedupe') &&
  source.includes('idx_operational_event_attempts_business_status')
);

expect('src/lib/server/operationalEvents.ts', 'operational event helper supports dedupe, retry, attempts, and retention', (source) =>
  source.includes('recordOperationalEvent') &&
  source.includes('recordOperationalEventBestEffort') &&
  source.includes('loadPendingOperationalEvents') &&
  source.includes('loadReadyOperationalEvents') &&
  source.includes('recordOperationalDeliveryAttempt') &&
  source.includes('processOperationalEvents') &&
  source.includes('releaseStaleOperationalEvents') &&
  source.includes('cleanupOperationalEvents') &&
  source.includes('ON CONFLICT(business_id, dedupe_key)') &&
  source.includes('delivery_attempts = delivery_attempts + 1') &&
  source.includes('deliveryStatusOverride') &&
  source.includes('retryDelaySeconds')
);

expect('src/routes/api/internal/operational-events/process/+server.ts', 'operational event processor is protected and callable', (source) =>
  source.includes('SMOKE_INTERNAL_TOKEN') &&
  source.includes('processOperationalEvents') &&
  source.includes('cache-control') &&
  source.includes('Not found.')
);

expect('src/lib/server/tenant.ts', 'tenant readiness tracks operational outbox tables', (source) =>
  source.includes("'operational_events'") &&
  source.includes("'operational_event_delivery_attempts'")
);

expect('src/routes/api/internal/schema-readiness/+server.ts', 'schema readiness checks operational outbox tables and indexes', (source) =>
  source.includes("'operational_events'") &&
  source.includes("'operational_event_delivery_attempts'") &&
  source.includes("'idx_operational_events_business_status_next'") &&
  source.includes("'idx_operational_event_attempts_business_status'")
);

expect('src/lib/server/schedules.ts', 'schedule workflow records operational events', (source) =>
  [
    'schedule.published',
    'schedule.shift.offered',
    'schedule.shift.requested',
    'schedule.shift_request.approved',
    'schedule.open_shift.requested',
    'schedule.open_shift_request.approved',
    'schedule.time_off.requested',
    'schedule.time_off.approved'
  ].every((eventType) => source.includes(eventType))
);

expect('src/lib/server/preplist.ts', 'list workflow records submission and completion events', (source) =>
  source.includes('list.${domain}.submitted') &&
  source.includes('list.${domain}.item_completed') &&
  source.includes('recordOperationalEventBestEffort')
);

expect('src/lib/server/admin.ts', 'employee onboarding records operational events', (source) =>
  source.includes('onboarding.package.sent') &&
  source.includes('onboarding.item.submitted') &&
  source.includes('onboarding.item.approved') &&
  source.includes('onboarding.item.changes_requested')
);

expect('src/routes/api/temps/+server.ts', 'temperature ingest records operational events', (source) =>
  source.includes('temperature.reading_batch.received') &&
  source.includes('dedupeKey: guardKey')
);

expect('src/routes/api/camera/activity/+server.ts', 'camera activity records operational events', (source) =>
  source.includes('camera.activity.received') &&
  source.includes('dedupeKey: `camera-activity:')
);

expect('src/routes/billing/+page.server.ts', 'billing actions record operational events', (source) =>
  source.includes('billing.conversion.queued') &&
  source.includes('billing.conversion.completed') &&
  source.includes('billing.workspace.canceled')
);

expect('src/lib/server/storeBilling.ts', 'store purchase events feed operational outbox', (source) =>
  source.includes('billing.store_purchase.${args.eventType}') &&
  source.includes('recordOperationalEventBestEffort')
);

expect('docs/PROJECT_HANDOFF.md', 'handoff tracks operational event phase', (source) =>
  source.includes('Completed phases: `1. Authorization and permission model`, `2. Operational event and notification foundation`, `3. Email system completion`') &&
  source.includes('Active phase: `5. Temperature monitoring completion`')
);

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.label}`);
  if (!check.ok) console.log(`  ${check.detail}`);
}

if (failed.length) process.exit(1);
