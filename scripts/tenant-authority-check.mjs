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
const roles = read('src/lib/auth/roles.ts');

assertCheck(
  'hooks derives app role from business role and permission template',
  hooks.includes('event.locals.userRole = effectiveAppRoleFromBusinessRole(') &&
    hooks.includes('businessContext.businessRole,') &&
    hooks.includes('businessContext.businessPermissionTemplate'),
  'hooks.server.ts must set locals.userRole from the active business membership role and permission template.'
);

assertCheck(
  'hooks does not promote from global user role',
  !/event\.locals\.userRole\s*=.*session\.user_role/.test(hooks) &&
    !/normalizeRole\(session\.user_role\)\s*===\s*['"]admin['"]/.test(hooks),
  'Global users.role/session.user_role must not grant app/admin access.'
);

assertCheck(
  'login active session display uses business role and permission template',
  login.includes('const effectiveRole = effectiveAppRoleFromBusinessRole(') &&
    login.includes('locals.businessPermissionTemplate'),
  'Login continue-session role display should match business-scoped authority and permission template.'
);

assertCheck(
  'admin users list does not fall back to global role',
  !/COALESCE\(bu\.role,\s*u\.role/.test(admin),
  'Admin user lists should display the business membership role, not global users.role.'
);

assertCheck(
  'permission helper normalizes legacy managers into manager authority',
  roles.includes("normalized === 'admin'") &&
    roles.includes("normalized === 'general_manager'") &&
    roles.includes("normalized === 'foh_manager'") &&
    roles.includes("normalized === 'boh_manager'") &&
    roles.includes("normalized === 'hourly_manager'") &&
    roles.includes("return 'manager'") &&
    roles.includes('resolveBusinessCapabilities'),
  'Legacy management memberships must remain compatible while effective capabilities determine authority.'
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
