import { readFileSync, existsSync } from 'node:fs';

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

expect('migrations/0054_auth_abuse_account_safety.sql', 'auth safety migration creates controls', (source) =>
  source.includes('security_rate_limits') &&
  source.includes('account_audit_logs') &&
  source.includes('idx_sessions_user_revoked_seen')
);

expect('src/lib/server/security.ts', 'shared security helper exists', (source) =>
  source.includes('checkRateLimit') &&
  source.includes('writeAuditLog') &&
  source.includes('revokeOtherUserSessions') &&
  source.includes('hashedAuditValue')
);

expect('src/lib/server/auth.ts', 'password hashing uses high-iteration salted PBKDF2 and rehash upgrades', (source) =>
  source.includes('const PASSWORD_ITERATIONS = 600_000') &&
  source.includes('const PASSWORD_SALT_BYTES = 16') &&
  source.includes('async function tryUpgradePasswordHash') &&
  source.includes('needsRehash = iterations < PASSWORD_ITERATIONS') &&
  source.includes('needsRehash: Boolean(upgradedHash)') &&
  source.includes('upgradedHash')
);

expect('src/routes/login/+page.server.ts', 'login is rate limited and audited', (source) =>
  source.includes("action: 'login_ip'") &&
  source.includes("action: 'login_email'") &&
  source.includes("action: 'login_failed_bad_password'") &&
  source.includes("action: 'login_success'")
);

expect('src/routes/login/+page.server.ts', 'login supports server-validated Turnstile when configured', (source) =>
  source.includes('validateTurnstileSubmission') &&
  source.includes("action: 'login_turnstile_failed'") &&
  source.includes('Security check failed')
);

expect('src/routes/login/+page.svelte', 'login renders Turnstile challenge from runtime site key', (source) =>
  source.includes('TurnstileWidget') &&
  source.includes('turnstileSiteKey')
);

expect('src/routes/forgot-password/+page.server.ts', 'password reset requests are rate limited and audited', (source) =>
  source.includes("action: 'password_reset_ip'") &&
  source.includes("action: 'password_reset_email'") &&
  source.includes("action: 'password_reset_requested'")
);

expect('src/routes/register/+page.server.ts', 'signup is rate limited and audited', (source) =>
  source.includes("action: 'signup_ip'") &&
  source.includes("action: 'signup_email'") &&
  source.includes('validateNewPassword') &&
  source.includes('signup_completed_new_business')
);

expect('src/lib/server/admin.ts', 'invite and admin session controls are protected', (source) =>
  source.includes("action: 'invite_business'") &&
  source.includes("action: 'invite_admin'") &&
  source.includes('revokeEmployeeSessions') &&
  source.includes("action: 'admin_revoked_user_sessions'")
);

expect('src/routes/settings/+page.server.ts', 'user session controls are wired', (source) =>
  source.includes('listUserSessions') &&
  source.includes('revoke_session') &&
  source.includes('revoke_other_sessions')
);

expect('src/routes/logout/+page.server.ts', 'logout revokes session and clears workspace cookies', (source) =>
  source.includes('hashSessionToken') &&
  source.includes('UPDATE sessions') &&
  source.includes('revoked_at = ?') &&
  source.includes('ACTIVE_BUSINESS_COOKIE') &&
  source.includes('getActiveBusinessCookieDeleteOptions')
);

expect('src/routes/workspace/switch/+server.ts', 'workspace switching is membership checked and same-origin redirected', (source) =>
  source.includes('getUserBusinessContext') &&
  source.includes('context.businessId !== businessId') &&
  source.includes('refererUrl.origin !== requestUrl.origin') &&
  source.includes('ACTIVE_BUSINESS_COOKIE')
);

expect('src/routes/account-deletion/+page.server.ts', 'account deletion requests are rate limited and hashed', (source) =>
  source.includes("action: 'account_deletion_request'") &&
  source.includes('hashedAuditValue(ipAddress)') &&
  source.includes("requestScope !== 'user'") &&
  source.includes('account_deletion_requests')
);

expect('src/routes/reset-password/[token]/+page.server.ts', 'password reset completion revokes existing sessions and devices', (source) =>
  source.includes('findValidPasswordResetByTokenHash') &&
  source.includes('validateNewPassword') &&
  source.includes('revokeUserSessions(db, reset.user_id, { revokeDevices: true })') &&
  source.includes("action: 'password_reset_completed'")
);

expect('src/hooks.server.ts', 'request guard rejects revoked sessions devices inactive users and gated features', (source) =>
  source.includes('session.revoked_at !== null') &&
  source.includes('session.device_id && (!session.found_device_id || session.device_revoked_at !== null)') &&
  source.includes('session.user_is_active !== 1') &&
  source.includes('resolveBusinessCapabilityForPath(pathname)') &&
  source.includes('resolveFeatureKeyForUrl(event.url)') &&
  source.includes('clearSessionCookies(event)')
);

expect('src/hooks.server.ts', 'cookie-authenticated mutations reject cross-site requests', (source) =>
  source.includes('isTrustedStateChangingRequest') &&
  source.includes('cross_site_state_change_rejected') &&
  source.includes('origin === requestUrl.origin') &&
  source.includes('fetchSite ===') &&
  source.includes('!isPublicApiRoute && !isTrustedStateChangingRequest(event.request, event.url)')
);

expect('src/routes/api/internal/operational-events/process/+server.ts', 'operational event processor requires internal token', (source) =>
  source.includes('SMOKE_INTERNAL_TOKEN') &&
  source.includes('internalTokenFromRequest') &&
  source.includes('constantTimeTokenEqual') &&
  source.includes("return json({ ok: false, error: 'Not found.' }, { status: 404 })")
);

expect('src/routes/api/internal/schema-readiness/+server.ts', 'schema readiness requires internal token', (source) =>
  source.includes('SMOKE_INTERNAL_TOKEN') &&
  source.includes('bearerTokenFromRequest') &&
  source.includes('constantTimeTokenEqual') &&
  source.includes("return json({ ok: false, error: 'Unauthorized.' }, { status: 401 })")
);

expect('src/routes/api/temps/+server.ts', 'temperature ingest requires device authentication', (source) =>
  source.includes("authenticateIoTDevice(db, request, 'sensor_gateway')") &&
  source.includes('resolveGatewayNodeReading') &&
  source.includes("return json({ error: 'Gateway credentials required.' }, { status: 401 })")
);

expect('src/routes/api/camera/activity/+server.ts', 'camera activity ingest remains beta gated and device authenticated', (source) =>
  source.includes('cameraBetaEnabled') &&
  source.includes("authenticateIoTDevice(db, request, 'camera')") &&
  source.includes("return json({ error: 'Not found.' }, { status: 404 })") &&
  source.includes("return json({ error: 'Device credentials required.' }, { status: 401 })")
);

expect('src/routes/api/billing/app-store-notifications/+server.ts', 'app store webhook requires billing webhook token', (source) =>
  source.includes('BILLING_WEBHOOK_TOKEN') &&
  source.includes('bearerTokenFromRequest') &&
  source.includes('constantTimeTokenEqual') &&
  source.includes("return json({ ok: false, error: 'Unauthorized.' }, { status: 401 })")
);

expect('src/routes/api/billing/google-play-notifications/+server.ts', 'google play webhook requires billing webhook token', (source) =>
  source.includes('BILLING_WEBHOOK_TOKEN') &&
  source.includes('bearerTokenFromRequest') &&
  source.includes('constantTimeTokenEqual') &&
  source.includes("return json({ ok: false, error: 'Unauthorized.' }, { status: 401 })")
);

expect('docs/PROJECT_HANDOFF.md', 'auth abuse documentation exists', (source) =>
  source.includes('Login attempts are rate-limited') && source.includes('Audit logs store hashed')
);

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.label}`);
  if (!check.ok) console.log(`  ${check.detail}`);
}

if (failed.length) process.exit(1);
