import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

const checks = [];

function assertCheck(name, condition, detail) {
  checks.push({ name, passed: Boolean(condition), detail });
}

const hooks = read('src/hooks.server.ts');
const login = read('src/routes/login/+page.server.ts');
const admin = read('src/lib/server/admin.ts');
const permissions = read('src/lib/server/permissions.ts');

assertCheck(
  'hooks derives app role from business role',
  hooks.includes('event.locals.userRole = effectiveAppRoleFromBusinessRole(businessContext.businessRole);'),
  'hooks.server.ts must set locals.userRole from the active business membership role.'
);

assertCheck(
  'hooks does not promote from global user role',
  !/event\.locals\.userRole\s*=.*session\.user_role/.test(hooks) &&
    !/normalizeRole\(session\.user_role\)\s*===\s*['"]admin['"]/.test(hooks),
  'Global users.role/session.user_role must not grant app/admin access.'
);

assertCheck(
  'login active session display uses business role',
  login.includes('const effectiveRole = effectiveAppRoleFromBusinessRole(businessRole);'),
  'Login continue-session role display should match business-scoped authority.'
);

assertCheck(
  'admin users list does not fall back to global role',
  !/COALESCE\(bu\.role,\s*u\.role/.test(admin),
  'Admin user lists should display the business membership role, not global users.role.'
);

assertCheck(
  'permission helper defines admin business roles',
  permissions.includes("normalized === 'owner' || normalized === 'admin' || normalized === 'manager'"),
  'Owner/admin/manager should be the only business roles that map to app admin.'
);

const failed = checks.filter((check) => !check.passed);
for (const check of checks) {
  const prefix = check.passed ? 'PASS' : 'FAIL';
  console.log(`${prefix}: ${check.name}`);
  if (!check.passed) console.log(`  ${check.detail}`);
}

if (failed.length > 0) {
  console.error(`\nTenant authority check failed: ${failed.length} issue(s).`);
  process.exit(1);
}

console.log('\nTenant authority check passed.');
