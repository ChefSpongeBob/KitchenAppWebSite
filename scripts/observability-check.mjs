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

expect('src/lib/server/observability.ts', 'structured observability helper exists', (source) =>
  source.includes('logOperationalEvent') &&
  source.includes('JSON.stringify') &&
  source.includes('request_id') &&
  source.includes('business_id')
);

expect('src/lib/server/observability.ts', 'observability errors redact sensitive strings', (source) =>
  source.includes('SENSITIVE_TEXT_PATTERNS') &&
  source.includes('redactSensitiveText') &&
  source.includes('Bearer [redacted]') &&
  source.includes('RESEND_API_KEY') &&
  source.includes('BILLING_WEBHOOK_TOKEN')
);

expect('src/lib/server/requestTokens.ts', 'request token comparison is constant time', (source) =>
  source.includes('constantTimeTokenEqual') &&
  source.includes('left.length ^ right.length') &&
  source.includes('charCodeAt') &&
  source.includes('bearerTokenFromRequest')
);

expect('src/lib/server/security.ts', 'account audit emits structured server logs', (source) =>
  source.includes('account_audit_log') && source.includes('logOperationalEvent')
);

expect('src/hooks.server.ts', 'tenant and guard denials are logged', (source) =>
  source.includes('tenant_access_denied') &&
  source.includes('request_guard_error') &&
  source.includes('billing_access_required')
);

expect('src/routes/billing/+page.server.ts', 'billing lifecycle failures are logged', (source) =>
  source.includes('billing_conversion_failed') &&
  source.includes('billing_cancel_failed') &&
  source.includes('billing_workspace_canceled')
);

expect('src/routes/api/internal/schema-readiness/+server.ts', 'schema readiness failures are logged', (source) =>
  source.includes('schema_readiness_failed') && source.includes('schema_readiness_db_unavailable')
);

expect('src/routes/api/internal/schema-readiness/+server.ts', 'schema readiness uses constant-time internal token checks', (source) =>
  source.includes('constantTimeTokenEqual') && source.includes('bearerTokenFromRequest')
);

expect('src/routes/api/internal/operational-events/process/+server.ts', 'operational processor uses constant-time internal token checks', (source) =>
  source.includes('constantTimeTokenEqual') && source.includes('internalTokenFromRequest')
);

expect('src/routes/api/internal/temperature-monitoring/process/+server.ts', 'temperature processor uses constant-time internal token checks', (source) =>
  source.includes('constantTimeTokenEqual') && source.includes('bearerTokenFromRequest')
);

expect('src/routes/api/billing/app-store-notifications/+server.ts', 'app store webhook uses constant-time token checks', (source) =>
  source.includes('constantTimeTokenEqual') && source.includes('bearerTokenFromRequest')
);

expect('src/routes/api/billing/google-play-notifications/+server.ts', 'google play webhook uses constant-time token checks', (source) =>
  source.includes('constantTimeTokenEqual') && source.includes('bearerTokenFromRequest')
);

expect('src/routes/api/documents/media/[...key]/+server.ts', 'document media failures are logged', (source) =>
  source.includes('document_media_bucket_missing') &&
  source.includes('document_media_access_denied') &&
  source.includes('document_media_object_missing')
);

expect('src/routes/api/camera/media/[...key]/+server.ts', 'camera media failures are logged', (source) =>
  source.includes('camera_media_bucket_missing') &&
  source.includes('camera_media_access_denied') &&
  source.includes('camera_media_object_missing')
);

expect('scripts/prod-smoke-check.mjs', 'production smoke covers critical routes and schema readiness', (source) =>
  source.includes('privateRoutes') &&
  source.includes('adminRoutes') &&
  source.includes('/api/internal/schema-readiness')
);

expect('docs/PROJECT_HANDOFF.md', 'deploy playbook includes alerting and backup procedure', (source) =>
  source.includes('Create/confirm backup before migrations') &&
  source.includes('Alert watchlist') &&
  source.includes('Backup And Restore')
);

expect('docs/PROJECT_HANDOFF.md', 'incident readiness documentation exists', (source) =>
  source.includes('Structured Logs') &&
  source.includes('Alert Targets') &&
  source.includes('Backup And Restore')
);

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.label}`);
  if (!check.ok) console.log(`  ${check.detail}`);
}

if (failed.length) process.exit(1);
