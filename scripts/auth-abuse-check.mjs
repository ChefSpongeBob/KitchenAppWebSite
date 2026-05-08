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

expect('src/routes/login/+page.server.ts', 'login is rate limited and audited', (source) =>
  source.includes("action: 'login_ip'") &&
  source.includes("action: 'login_email'") &&
  source.includes("action: 'login_failed_bad_password'") &&
  source.includes("action: 'login_success'")
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

expect('docs/auth-abuse-account-safety.md', 'auth abuse documentation exists', (source) =>
  source.includes('Login attempts are rate-limited') && source.includes('Audit logs store hashed')
);

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.label}`);
  if (!check.ok) console.log(`  ${check.detail}`);
}

if (failed.length) process.exit(1);
