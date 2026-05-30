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
const adminRoleBlock = roles.match(/const ADMIN_BUSINESS_ROLES[\s\S]*?\]\);/)?.[0] ?? '';

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
  roles.includes("'owner'") &&
    roles.includes("'admin'") &&
    roles.includes("'general_manager'") &&
    roles.includes("'foh_manager'") &&
    roles.includes("'boh_manager'") &&
    roles.includes("'hourly_manager'") &&
    roles.includes('const REPORT_ACCESS_ROLES') &&
    roles.includes('const VENDOR_ACCESS_ROLES') &&
    !adminRoleBlock.includes("'consultant'") &&
    !adminRoleBlock.includes("'contractor'") &&
    !adminRoleBlock.includes("'staff'") &&
    !adminRoleBlock.includes("'shift_lead'"),
  'Owner/admin/manager-family roles should map to app admin; consultant, contractor, staff, shift lead, and user should not.'
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
