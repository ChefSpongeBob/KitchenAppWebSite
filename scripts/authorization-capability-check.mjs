import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const checks = [];

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function expect(name, condition, detail) {
  checks.push({ name, passed: Boolean(condition), detail });
}

const roles = read('src/lib/auth/roles.ts');
const routeCapabilities = read('src/lib/auth/routeCapabilities.ts');
const business = read('src/lib/server/business.ts');
const hooks = read('src/hooks.server.ts');
const layout = read('src/routes/+layout.svelte');
const employeePage = read('src/routes/admin/users/[id]/+page.svelte');
const admin = read('src/lib/server/admin.ts');
const billingPage = read('src/routes/billing/+page.server.ts');
const billingPurchase = read('src/routes/api/billing/native-purchase/+server.ts');
const sensitive = read('src/lib/server/sensitive.ts');
const schedules = read('src/lib/server/schedules.ts');
const scheduleBuilder = read('src/routes/admin/schedule/+page.server.ts');
const scheduleView = read('src/routes/schedule/+page.server.ts');

expect(
  'central capability vocabulary exists',
  roles.includes('export type BusinessCapability') &&
    roles.includes("'manage_permissions'") &&
    roles.includes("'manage_schedule'") &&
    roles.includes("'manage_billing'") &&
    roles.includes("'view_reports'") &&
    roles.includes("'view_sensitive_employee_data'"),
  'Business capabilities must stay centralized in src/lib/auth/roles.ts.'
);

expect(
  'permission templates provide defaults and overrides resolve access',
  roles.includes('BUSINESS_ROLE_DEFAULT_CAPABILITIES') &&
    roles.includes('PERMISSION_TEMPLATE_CAPABILITIES') &&
    roles.includes('resolveBusinessCapabilities') &&
    roles.includes('overrides[capability] === true') &&
    roles.includes('overrides[capability] === false'),
  'Templates must provide defaults while individual overrides can grant or restrict access.'
);

expect(
  'owner authority remains fixed',
  roles.includes("if (normalizedRole === 'owner') return [...ALL_BUSINESS_CAPABILITIES]"),
  'Owner authority must not be reduced by individual overrides.'
);

expect(
  'business context loads effective individual capabilities',
  business.includes('loadBusinessCapabilityOverrides') &&
    business.includes('businessCapabilities: resolveBusinessCapabilities('),
  'Active business context must resolve individual permission overrides.'
);

expect(
  'session and route guard use effective capabilities',
  hooks.includes('businessContext.businessCapabilities') &&
    hooks.includes('resolveBusinessCapabilityForPath(pathname)') &&
    hooks.includes('event.locals.businessCapabilities'),
  'The active session and route guard must enforce effective capability access.'
);

expect(
  'privileged route capability map exists',
  routeCapabilities.includes("'/admin/users'") &&
    routeCapabilities.includes("'manage_people'") &&
    routeCapabilities.includes("'/admin/schedule'") &&
    routeCapabilities.includes("'manage_schedule'") &&
    routeCapabilities.includes("'/billing'") &&
    routeCapabilities.includes("'manage_billing'"),
  'Privileged routes must have centralized capability requirements.'
);

expect(
  'sidebar protected navigation uses effective capabilities',
  layout.includes('resolveBusinessCapabilityForPath(item.route)') &&
    layout.includes('data.user?.businessCapabilities') &&
    layout.includes('hasBusinessCapability('),
  'Protected navigation must match server-side capability decisions.'
);

expect(
  'employee access screen exposes individual capabilities',
  employeePage.includes('businessCapabilityOptions') &&
    employeePage.includes('action="?/update_capabilities"') &&
    admin.includes('updateUserCapabilityOverrides'),
  'Employee profiles must provide one capability editor backed by persisted overrides.'
);

expect(
  'billing uses effective centralized capability',
  billingPage.includes("'manage_billing', capabilities") &&
    billingPurchase.includes("'manage_billing', capabilities"),
  'Billing page actions and native purchase API must use effective billing capability.'
);

expect(
  'sensitive employee access uses effective centralized capability',
  sensitive.includes("'view_sensitive_employee_data',") &&
    sensitive.includes('actorCapabilities'),
  'Sensitive employee reads must use effective sensitive-data capability.'
);

for (const path of [
  'src/routes/reports/+page.server.ts',
  'src/routes/reports/lists/+page.server.ts',
  'src/routes/reports/lists.csv/+server.ts',
  'src/routes/reports/schedule/+page.server.ts',
  'src/routes/reports/schedule.csv/+server.ts'
]) {
  const source = read(path);
  expect(
    `${path} uses effective report access`,
    source.includes('hasReportsAccess(locals.businessRole, locals.businessPermissionTemplate, locals.businessCapabilities)'),
    'Report pages and exports must enforce active effective capabilities.'
  );
}

expect(
  'vendor view uses effective access',
  read('src/routes/vendors/+page.server.ts').includes(
    'hasVendorAccess(locals.businessRole, locals.businessPermissionTemplate, locals.businessCapabilities)'
  ),
  'Vendor viewing must enforce active effective capabilities.'
);

expect(
  'schedule manager department scope is enforced',
  schedules.includes('loadScheduleManagerDepartments') &&
    schedules.includes('scheduleDepartmentAccessFailure') &&
    schedules.includes('deleteScheduleShiftsForScope') &&
    schedules.includes("'manage_schedule'") &&
    schedules.includes('departmentScope.allowedSet.has(department)'),
  'Schedule mutations must reject departments outside the active manager scope.'
);

expect(
  'schedule builder hides out-of-scope departments',
  scheduleBuilder.includes('loadScheduleManagerDepartments') &&
    scheduleBuilder.includes('allowedDepartmentSet.has(shift.department)') &&
    scheduleBuilder.includes('settings.departments.filter'),
  'Schedule builder payloads must be filtered to the active manager department scope.'
);

expect(
  'schedule view uses effective schedule capability',
  scheduleView.includes('hasBusinessCapability(') &&
    scheduleView.includes("'manage_schedule'") &&
    scheduleView.includes('loadScheduleManagerDepartments(db, locals'),
  'Shared schedule view must use effective business schedule capability, not legacy user role strings.'
);

const failed = checks.filter((check) => !check.passed);
for (const check of checks) {
  console.log(`${check.passed ? 'PASS' : 'FAIL'}: ${check.name}`);
  if (!check.passed) console.log(`  ${check.detail}`);
}

if (failed.length > 0) {
  console.error(`\nAuthorization capability check failed: ${failed.length} issue(s).`);
  process.exit(1);
}

console.log('\nAuthorization capability check passed.');
