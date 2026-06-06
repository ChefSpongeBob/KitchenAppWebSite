import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const checks = [];

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function expect(path, label, predicate) {
  if (!existsSync(resolve(root, path))) {
    checks.push({ ok: false, label, detail: `${path} does not exist.` });
    return;
  }
  const source = read(path);
  checks.push({ ok: Boolean(predicate(source)), label, detail: path });
}

expect('src/routes/admin/onboarding/+page.server.ts', 'admin onboarding page is business-scoped', (source) =>
  source.includes('requireAdmin(locals.userRole)') &&
  source.includes('requireBusinessId(locals)') &&
  source.includes('loadEmployeeOnboardingTemplate(db, businessId)') &&
  source.includes('loadEmployeeOnboardingDashboard(db, businessId)')
);

expect('src/lib/server/admin.ts', 'invites capture employment, permissions, and departments', (source) =>
  source.includes('export async function createUserInvite') &&
  source.includes('normalizeInviteAccessType') &&
  source.includes('permission_template') &&
  source.includes('employment_type') &&
  source.includes('schedule_departments_json') &&
  source.includes('onboarding_required') &&
  source.includes('sendInviteEmail')
);

expect('src/lib/server/admin.ts', 'contractors cannot receive employee onboarding packets', (source) =>
  source.includes("String(formData.get('payroll_classification') ?? 'employee') === 'contractor'") &&
  source.includes('Contractors do not receive employee onboarding packets.')
);

expect('src/routes/register/+page.server.ts', 'employee invite onboarding skips contractors', (source) =>
  source.includes('businessInvite.onboarding_required === 1') &&
  source.includes("businessInvite.employment_type !== 'contractor'") &&
  source.includes('ensureEmployeeOnboardingRequirement')
);

expect('src/routes/register/+page.svelte', 'employee invite flow hides business purchase controls', (source) =>
  source.includes('$: inviteMode = Boolean(data.inviteCode)') &&
  source.includes('visibleSlides = inviteMode') &&
  source.includes("slide.id !== 'tier' && slide.id !== 'business'") &&
  source.includes('{#if !inviteMode}') &&
  source.includes('payment-placeholder') &&
  source.includes('{#if !inviteMode}')
);

expect('src/routes/register/+page.server.ts', 'register validation returns user input and active slide', (source) =>
  source.includes('function registerFailure') &&
  source.includes('return fail(status, { error, activeSlideId, values })') &&
  source.includes('activeSlideId') &&
  source.includes("return registerFailure(400, String(passwordError.data?.error ?? 'Enter a valid password.'), 'security', submittedValues);")
);

expect('src/lib/server/sensitive.ts', 'sensitive HR forms are encrypted and audited', (source) =>
  source.includes('AES-GCM') &&
  source.includes('sensitiveFormKeys') &&
  source.includes('personal_information') &&
  source.includes('payroll_setup') &&
  source.includes('federal_i9') &&
  source.includes('federal_w4') &&
  source.includes('state_withholding') &&
  source.includes('employee_sensitive_record_audit') &&
  source.includes("'view_sensitive_employee_data'")
);

expect('src/lib/server/admin.ts', 'sensitive onboarding submissions store redacted form payloads', (source) =>
  source.includes('storeSensitiveOnboardingFormPayload') &&
  source.includes('encryptSensitiveJsonPayload') &&
  source.includes('sanitizeSensitiveOnboardingPayload') &&
  source.includes('sensitiveConfigurationFailure')
);

expect('src/lib/server/admin.ts', 'onboarding review writes compliance docs and operational events', (source) =>
  source.includes('approveEmployeeOnboardingItem') &&
  source.includes('requestEmployeeOnboardingChanges') &&
  source.includes('upsertComplianceDocumentForOnboardingItem') &&
  source.includes('employee_onboarding_item_approved') &&
  source.includes('employee_onboarding_item_changes_requested')
);

expect('src/routes/api/documents/media/[...key]/+server.ts', 'employee onboarding media is private and audited', (source) =>
  source.includes("key.includes('/employee-onboarding/')") &&
  source.includes('canAccessEmployeeSensitiveData') &&
  source.includes('employee_onboarding_media_read') &&
  source.includes('hasBusinessCapability') &&
  source.includes("'view_sensitive_employee_data'") &&
  source.includes("headers.set('cache-control', 'private, no-store')")
);

expect('src/routes/admin/users/[id]/+page.server.ts', 'employee profiles load onboarding with audited sensitive reads', (source) =>
  source.includes('loadEmployeeOnboarding(db, employee.id, locals.businessId') &&
  source.includes('auditSensitiveRead: true') &&
  source.includes('approve_onboarding_item') &&
  source.includes('request_onboarding_changes')
);

expect('src/routes/settings/+page.server.ts', 'employees submit onboarding from profile settings', (source) =>
  source.includes('loadEmployeeOnboarding(db, locals.userId, businessId') &&
  source.includes('submitEmployeeOnboardingItem(request, locals, platform?.env)')
);

expect('src/routes/api/internal/schema-readiness/+server.ts', 'schema readiness includes onboarding and sensitive HR tables', (source) =>
  source.includes('employee_onboarding_packages') &&
  source.includes('employee_onboarding_items') &&
  source.includes('employee_onboarding_template_items') &&
  source.includes('idx_employee_onboarding_packages_user') &&
  source.includes('idx_employee_onboarding_items_package') &&
  source.includes('idx_employee_onboarding_template_business') &&
  source.includes('employee_sensitive_record_vault') &&
  source.includes('employee_sensitive_record_audit')
);

expect('docs/PROJECT_HANDOFF.md', 'Phase 10 manual testing notes are tracked', (source) =>
  source.includes('Active phase: `10. Invite, employee onboarding, and HR completion`') &&
  source.includes('employee invite flow from email link to onboarding to login') &&
  source.includes('contractors do not receive employee tax onboarding packets')
);

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.label}`);
  if (!check.ok) console.log(`  ${check.detail}`);
}

if (failed.length) {
  console.error(`\nHR onboarding check failed: ${failed.length} issue(s).`);
  process.exit(1);
}

console.log('\nHR onboarding check passed.');
