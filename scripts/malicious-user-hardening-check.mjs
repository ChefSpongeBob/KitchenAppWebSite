import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

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

function walkFiles(root, predicate, results = []) {
  if (!existsSync(root)) return results;
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      walkFiles(path, predicate, results);
    } else if (predicate(path)) {
      results.push(path.replaceAll('\\', '/'));
    }
  }
  return results;
}

function dynamicPrepareFindings(root) {
  const findings = [];
  const files = walkFiles(root, (path) => /\.(ts|js|svelte)$/.test(path));
  const prepareTemplate = /\.prepare\(\s*`([\s\S]*?)`/g;
  for (const file of files) {
    const source = read(file);
    let match;
    while ((match = prepareTemplate.exec(source))) {
      const sql = match[1];
      if (sql.includes('${')) findings.push({ file, sql });
    }
  }
  return findings;
}

function isAllowedRouteDynamicSql(finding) {
  if (finding.file === 'src/routes/settings/+page.server.ts') {
    return (
      finding.sql.includes('SELECT id, ${displayNameExpr}, ${emailExpr}') ||
      finding.sql.includes('UPDATE users SET ${nameColumn}') ||
      finding.sql.includes("UPDATE users SET ${assignments.join(', ')}")
    );
  }
  if (finding.file === 'src/routes/login/+page.server.ts') {
    return finding.sql.includes("password_hash${hasIsActive ? ', is_active' : ''}${hasRole ? ', role' : ''}");
  }
  if (finding.file === 'src/routes/admin/+page.server.ts') {
    return finding.sql.includes("${hasIsActive ? 'AND COALESCE(u.is_active, 1) = 1' : ''}");
  }
  if (finding.file === 'src/routes/docs/+page.server.ts') {
    return finding.sql.includes('IN (${placeholders})');
  }
  return false;
}

expect('src/hooks.server.ts', 'state-changing cookie requests are same-origin guarded', (source) =>
  source.includes('isTrustedStateChangingRequest') &&
  source.includes('cross_site_state_change_rejected') &&
  source.includes('origin === requestUrl.origin') &&
  source.includes("fetchSite === 'same-origin'") &&
  source.includes('!isPublicApiRoute && !isTrustedStateChangingRequest(event.request, event.url)')
);

expect('src/hooks.server.ts', 'private route guard enforces tenant capabilities and feature gates', (source) =>
  source.includes('resolveBusinessCapabilityForPath(pathname)') &&
  source.includes('hasBusinessCapability(') &&
  source.includes('resolveFeatureKeyForUrl(event.url)') &&
  source.includes('canRoleAccessFeature(') &&
  source.includes('tenant_access_denied')
);

expect('src/lib/auth/routeCapabilities.ts', 'privileged route capability map covers billing admin reports vendors and devices', (source) =>
  source.includes("{ prefix: '/billing', capability: 'manage_billing' }") &&
  source.includes("{ prefix: '/admin/users', capability: 'manage_people' }") &&
  source.includes("{ prefix: '/admin/onboarding', capability: 'manage_onboarding' }") &&
  source.includes("{ prefix: '/admin/sensors', capability: 'manage_devices' }") &&
  source.includes("{ prefix: '/reports', capability: 'view_reports' }") &&
  source.includes("{ prefix: '/vendors', capability: 'view_vendors' }")
);

expect('src/routes/login/+page.server.ts', 'login abuse is rate limited by IP and email', (source) =>
  source.includes("action: 'login_ip'") &&
  source.includes("action: 'login_email'") &&
  source.includes("action: 'login_failed_bad_password'") &&
  source.includes("action: 'login_success'")
);

expect('src/lib/server/turnstile.ts', 'Turnstile validation is server-side and fail-closed when configured', (source) =>
  source.includes('challenges.cloudflare.com/turnstile/v0/siteverify') &&
  source.includes('cf-turnstile-response') &&
  source.includes('TURNSTILE_SECRET_KEY') &&
  source.includes('TURNSTILE_SITE_KEY') &&
  source.includes('ok: false')
);

expect('src/routes/login/+page.server.ts', 'login validates Turnstile before account lookup and session creation', (source) => {
  const turnstileIndex = source.indexOf('validateTurnstileSubmission');
  const accountLookupIndex = source.indexOf('SELECT id, email, display_name, password_hash');
  const sessionCreateIndex = source.indexOf('INSERT INTO sessions');
  return (
    turnstileIndex !== -1 &&
    accountLookupIndex !== -1 &&
    sessionCreateIndex !== -1 &&
    turnstileIndex < accountLookupIndex &&
    turnstileIndex < sessionCreateIndex &&
    source.includes("action: 'login_turnstile_failed'")
  );
});

expect('src/routes/register/+page.server.ts', 'signup abuse is rate limited before creating accounts', (source) => {
  const rateLimitIndex = source.indexOf("action: 'signup_ip'");
  const createUserIndex = source.indexOf('const userId = crypto.randomUUID()');
  return (
    rateLimitIndex !== -1 &&
    createUserIndex !== -1 &&
    rateLimitIndex < createUserIndex &&
    source.includes("action: 'signup_email'")
  );
});

expect('src/routes/register/+page.server.ts', 'new business signup starts in explicit lifecycle state', (source) =>
  source.includes("const initialBusinessStatus = purchaseMode === 'buy_now' ? 'pending_payment' : 'trialing'") &&
  source.includes('statusOverride: purchaseMode ===') &&
  !source.includes("VALUES (?, ?, ?, ?, 'active'")
);

expect('src/lib/server/trial.ts', 'free-trial reuse is blocked by identity claims and denials', (source) =>
  source.includes('trial_identity_claims') &&
  source.includes('createTrialDenialRecord') &&
  source.includes("reason: 'email_reuse'") &&
  source.includes("reason: 'device_reuse'") &&
  source.includes("reason: 'business_ip_reuse'")
);

expect('src/routes/billing/+page.server.ts', 'production billing cannot self-activate without store confirmation', (source) =>
  source.includes('if (!dev)') &&
  source.includes("event: 'billing_conversion_queued'") &&
  source.includes("status: 'queued'") &&
  source.includes("source: 'store_billing'") &&
  source.includes("source: 'local_dev'")
);

expect('src/routes/api/billing/native-purchase/+server.ts', 'native purchase requires billing permission and store verification before activation', (source) =>
  source.includes('canManageBilling(locals.businessRole') &&
  source.includes('readStoreProduct(locals.DB, store, productId)') &&
  source.includes('verifyStorePurchase(env') &&
  source.includes("verification.verified && verification.status === 'active'") &&
  source.includes('activateVerifiedStoreEntitlement') &&
  source.includes('applyVerifiedEntitlementsToBusiness') &&
  !source.includes('convertBusinessToPaid(')
);

expect('src/lib/server/storeBilling.ts', 'verified entitlements are the only production activation path', (source) =>
  source.includes('export async function activateVerifiedStoreEntitlement') &&
  source.includes('export async function applyVerifiedEntitlementsToBusiness') &&
  source.includes("status = 'active'") &&
  source.includes("entitlement.status === 'active' || entitlement.status === 'grace_period'")
);

expect('src/routes/api/billing/app-store-notifications/+server.ts', 'app store webhook uses exact shared-secret token check', (source) =>
  source.includes('BILLING_WEBHOOK_TOKEN') &&
  source.includes('bearerTokenFromRequest') &&
  source.includes('constantTimeTokenEqual') &&
  source.includes("return json({ ok: false, error: 'Unauthorized.' }, { status: 401 })")
);

expect('src/routes/api/billing/google-play-notifications/+server.ts', 'google play webhook uses exact shared-secret token check', (source) =>
  source.includes('BILLING_WEBHOOK_TOKEN') &&
  source.includes('bearerTokenFromRequest') &&
  source.includes('constantTimeTokenEqual') &&
  source.includes("return json({ ok: false, error: 'Unauthorized.' }, { status: 401 })")
);

expect('src/routes/api/temps/+server.ts', 'temperature ingest is device-authenticated and capped', (source) =>
  source.includes("authenticateIoTDevice(db, request, 'sensor_gateway')") &&
  source.includes('MAX_TEMP_BATCH_SIZE') &&
  source.includes('Too many readings supplied.')
);

expect('src/routes/api/camera/upload/+server.ts', 'camera uploads are beta gated and device-authenticated', (source) =>
  source.includes('cameraBetaEnabled') &&
  source.includes("authenticateIoTDevice(db, request, 'camera')") &&
  source.includes("return json({ error: 'Not found.' }, { status: 404 })")
);

expect('src/lib/server/admin.ts', 'document uploads are allowlisted and exclude svg/executable formats', (source) =>
  source.includes('isAllowedDocumentUpload') &&
  !source.includes('image/svg+xml') &&
  source.includes('application/pdf') &&
  source.includes('image/jpeg') &&
  source.includes('image/png')
);

expect('src/routes/admin/app-editor/+page.server.ts', 'brand logo upload is jpg-only and size capped', (source) =>
  source.includes('isAllowedLogoUpload') &&
  source.includes('upload.size > 5 * 1024 * 1024') &&
  source.includes('image/jpeg') &&
  !source.includes('image/svg+xml')
);

expect('src/routes/settings/+page.server.ts', 'settings dynamic user updates use schema-derived allowlisted columns only', (source) =>
  source.includes('const displayNameExpr = userColumns.has') &&
  source.includes('const emailExpr = userColumns.has') &&
  source.includes('const nameColumn = userColumns.has') &&
  source.includes("'display_name'") &&
  source.includes("'username'") &&
  source.includes("const assignments: string[] = ['email = ?']") &&
  source.includes("assignments.push('email_normalized = ?')") &&
  source.includes("assignments.push('updated_at = ?')")
);

const unexpectedRouteSql = dynamicPrepareFindings('src/routes').filter(
  (finding) => !isAllowedRouteDynamicSql(finding)
);
checks.push({
  ok: unexpectedRouteSql.length === 0,
  label: 'route SQL does not interpolate request-controlled query fragments',
  detail: unexpectedRouteSql.map((finding) => finding.file).join(', ') || 'src/routes'
});

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.label}`);
  if (!check.ok) console.log(`  ${check.detail}`);
}

if (failed.length) process.exit(1);
