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
  source.includes('const businessId = requireBusinessId(locals)') &&
  source.includes("'review_onboarding'") &&
  source.includes("'manage_onboarding'") &&
  source.includes("'manage_hr_setup'") &&
  source.includes('loadEmployeeOnboardingTemplate(db, businessId)') &&
  source.includes('loadEmployeeOnboardingDashboard(db, businessId)')
);

expect('src/lib/server/admin.ts', 'invites capture tenant position, employment, and departments', (source) =>
  source.includes('export async function createUserInvite') &&
  source.includes("formData.get('position_id')") &&
  source.includes('loadTenantPosition') &&
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

expect('src/lib/server/admin.ts', 'owner invites are owner-only with explicitly optional onboarding packets', (source) =>
  source.includes("requestedPositionId === '__owner__'") &&
  source.includes('invitingOwner && !isOwnerRole(locals.businessRole)') &&
  source.includes("Only the owner can invite another owner.") &&
  source.includes("formData.get('onboarding_required')") &&
  source.includes("onboardingRequested && employmentType !== 'contractor'") &&
  source.includes('allowOwnerPacket: true') &&
  source.includes('!options.allowOwnerPacket')
);

expect('src/routes/admin/onboarding/+page.svelte', 'employee packets are explicitly selected during invite', (source) =>
  source.includes('name="onboarding_required"') &&
  source.includes('Include onboarding packet') &&
  !source.includes('name="packet_item_ids"')
);

expect('src/routes/register/+page.server.ts', 'invited owners only receive employment onboarding when explicitly selected', (source) =>
  source.includes("if (invitedBusinessRole !== 'owner' || businessInvite.onboarding_required === 1)") &&
  source.includes("invitedBusinessRole === 'owner' ? 'active' : 'onboarding'") &&
  source.includes("invitedBusinessRole === 'owner' ? 'owner' : businessInvite.employment_type") &&
  source.includes("allowOwnerPacket: invitedBusinessRole === 'owner'") &&
  source.includes('INSERT INTO employee_employment_records') &&
  source.includes('recordLegalAgreementAcceptance') &&
  source.includes('if (!inviteCode)')
);

expect('src/lib/server/email.ts', 'invite email copy matches packet requirement', (source) =>
  source.includes('onboardingRequired = true') &&
  source.includes('Complete your Crimini setup and onboarding forms.') &&
  source.includes('Complete your Crimini setup.') &&
  source.includes("onboardingRequired ? 'Complete your setup and onboarding forms:' : 'Complete your setup:'")
);

expect('src/lib/components/onboarding/EmployeeInviteRegistration.svelte', 'employee invite flow submits from personal information without purchase screen', (source) =>
  source.includes('name="invite_code"') &&
  source.includes('name="real_name"') &&
  source.includes('name="user_address_line_1"') &&
  source.includes('name="password"') &&
  source.includes('Create account') &&
  !source.includes('name="business_name"') &&
  !source.includes('name="plan_tier"') &&
  !source.includes('liability_agreement_accepted')
);

expect('src/lib/components/onboarding/EmployeeInviteRegistration.svelte', 'employee communication consent is informed and affirmative', (source) =>
  source.includes('May we send you optional operational email notifications?') &&
  source.includes('May we send you optional operational text messages?') &&
  source.includes('Consent is not a condition of employment or purchase.') &&
  source.includes('Reply STOP to opt out or HELP for help.') &&
  source.includes('type="radio" name="email_updates"') &&
  source.includes('type="radio" name="sms_updates"') &&
  !source.includes('type="checkbox" name="email_updates"') &&
  !source.includes('type="checkbox" name="sms_updates"')
);

expect('src/lib/components/onboarding/OwnerRegistration.svelte', 'purchaser communication consent is informed and affirmative', (source) =>
  source.includes('Consent is not a condition of purchase or employment.') &&
  source.includes('Reply STOP to opt out or HELP for help.') &&
  source.includes('type="radio" name="email_updates"') &&
  source.includes('type="radio" name="sms_updates"')
);

expect('src/routes/register/+page.server.ts', 'registration records communication consent evidence', (source) =>
  source.includes('email_updates_consented_at') &&
  source.includes('sms_updates_consented_at') &&
  source.includes('COMMUNICATION_CONSENT_VERSION') &&
  source.includes("communication_consent_source") &&
  source.includes("'registration'")
);

expect('migrations/0099_communication_consent_records.sql', 'communication consent evidence is persisted', (source) =>
  source.includes('email_updates_consented_at') &&
  source.includes('sms_updates_consented_at') &&
  source.includes('communication_consent_version') &&
	  source.includes('communication_consent_source') &&
	  source.includes('CREATE TABLE IF NOT EXISTS communication_consent_events') &&
	  source.includes('idx_communication_consent_user_channel')
);

expect('src/routes/register/+page.server.ts', 'invite registration saves personal information to the tenant employee profile', (source) =>
  source.includes('await ensureEmployeeProfilesTable(db)') &&
  source.includes('INSERT INTO employee_profiles') &&
  source.includes('ON CONFLICT(business_id, user_id) DO UPDATE SET') &&
  source.includes('realName || accountDisplayName') &&
  source.includes('userPhone ||') &&
  source.includes('birthday ||') &&
  source.includes('userAddressLine1 ||') &&
  source.includes('emergencyContactName ||') &&
  source.includes('emergencyContactPhone ||')
);

expect('src/lib/components/onboarding/OwnerRegistration.svelte', 'owner registration separates optional profile setup from required account and business steps', (source) =>
  source.includes('const optionalSteps = new Set([0, 1, 3, 5, 6, 7, 8])') &&
  source.includes('Contact & Login') &&
  source.includes('Your Business') &&
  source.includes('Departments & Roles') &&
  source.includes('Choose a Plan') &&
  source.includes('Create workspace')
);

expect('src/routes/register/+page.server.ts', 'owner registration uploads branding documents and menus into tenant-scoped storage', (source) =>
  source.includes('businesses/${newBusinessId}/branding/') &&
  source.includes('businesses/${newBusinessId}/documents/') &&
  source.includes("section: 'Docs'") &&
  source.includes("section: 'Menu'") &&
  source.includes('creator_category_registry') &&
  source.includes('uploadedBusinessLogoUrl')
);

expect('src/routes/register/+page.server.ts', 'completed invite registration opens the employee welcome step', (source) =>
  source.includes('/register/welcome?onboarding=') &&
  source.includes("businessInvite?.onboarding_required === 1 ? '1' : '0'")
);

expect('src/routes/register/welcome/+page.svelte', 'employee welcome step provides install and browser paths', (source) =>
  source.includes('04 / 04') &&
  source.includes('Continue in browser') &&
  source.includes('/login?registered=success&onboarding=1')
);

expect('src/routes/login/+page.svelte', 'registration confirmation uses Crimini branding and the real login flow', (source) =>
  source.includes("registrationComplete = $page.url.searchParams.get('registered') === 'success'") &&
  source.includes('src="/crimini-full-logo.jpg"') &&
  source.includes("registrationComplete ? 'Welcome' : 'Welcome back'") &&
  source.includes("registrationComplete ? 'Login' : 'Sign in'")
);

expect('src/routes/settings/+page.server.ts', 'profile settings reload the tenant-scoped registration profile', (source) =>
  source.includes('loadAdminEmployeeProfile(db, locals.userId, businessId)')
);

expect('src/routes/register/+page.server.ts', 'register validation returns user input and active slide', (source) =>
  source.includes('function registerFailure') &&
  source.includes('return fail(status, { error, activeSlideId, values })') &&
  source.includes('activeSlideId') &&
  source.includes("return registerFailure(400, String(passwordError.data?.error ?? 'Enter a valid password.'), 'security', submittedValues);")
);

expect('src/lib/server/sensitive.ts', 'structured sensitive HR records are encrypted and audited', (source) =>
  source.includes('AES-GCM') &&
  source.includes('sensitiveFormKeys') &&
  source.includes('personal_information') &&
  source.includes('payroll_setup') &&
  source.includes('employee_sensitive_record_audit') &&
  source.includes("'view_sensitive_employee_data'")
);

expect('src/lib/server/admin.ts', 'sensitive onboarding submissions store redacted form payloads', (source) =>
  source.includes('storeSensitiveOnboardingFormPayload') &&
  source.includes('encryptSensitiveJsonPayload') &&
  source.includes('sanitizeSensitiveOnboardingPayload') &&
  source.includes('sensitiveConfigurationFailure')
);

expect('src/lib/server/admin.ts', 'legal forms use official document artifacts instead of custom web-form replicas', (source) =>
  source.includes("item_type: 'document'") &&
  source.includes("form_key: 'federal_i9'") &&
  source.includes("form_key: 'federal_w4'") &&
  source.includes("['federal_i9', 'federal_w4', 'state_withholding'].includes(normalized)") &&
  !source.includes("if (formKey === 'federal_i9') {\n    const fields") &&
  !source.includes("if (formKey === 'federal_w4') {\n    const fields")
);

expect('src/lib/server/admin.ts', 'onboarding is reviewed and locked as one packet', (source) =>
  source.includes('submitEmployeeOnboardingPacket') &&
  source.includes('approveEmployeeOnboardingPackage') &&
  source.includes('returnEmployeeOnboardingPackage') &&
  source.includes("SET status = 'approved', approved_at = ?, approved_by = ?, locked_at = ?") &&
  source.includes('upsertComplianceDocumentForOnboardingItem') &&
  source.includes('employee_onboarding_packet_approved') &&
  source.includes('employee_onboarding_packet_returned') &&
  !source.includes('approveEmployeeOnboardingItem') &&
  !source.includes('requestEmployeeOnboardingChanges')
);

expect('src/lib/server/admin.ts', 'accepted sensitive packet data is preserved as an immutable versioned snapshot', (source) =>
  source.includes('employee_onboarding_sensitive_snapshots') &&
  source.includes('INSERT OR IGNORE INTO employee_onboarding_sensitive_snapshots') &&
  source.includes('AND onboarding_item_id = ?') &&
  source.includes("AND status IN ('active', 'accepted')") &&
  source.includes('locked_at = NULL') &&
  source.includes('immutableSnapshot')
);

expect('src/lib/server/admin.ts', 'I-9 employer review records physical inspection and document-copy policy', (source) =>
  source.includes('verifyEmployeeI9') &&
  source.includes("examination_method = 'physical'") &&
  source.includes('employee_i9_verifications') &&
  source.includes('employee_i9_document_copies') &&
  source.includes('retain_i9_document_copies') &&
  source.includes('everify_participant') &&
  source.includes('employee_i9_physically_verified')
);

expect('src/routes/api/documents/media/[...key]/+server.ts', 'employee onboarding media is private and audited', (source) =>
  source.includes("key.includes('/employee-onboarding/')") &&
  source.includes('canAccessEmployeeSensitiveData') &&
  source.includes('employee_i9_verifications') &&
  source.includes('employee_i9_document_copies') &&
  source.includes('employee_onboarding_media_read') &&
  source.includes('hasBusinessCapability') &&
  source.includes("'view_sensitive_employee_data'") &&
  source.includes("headers.set('cache-control', 'private, no-store')")
);

expect('src/routes/admin/users/[id]/+page.server.ts', 'employee profiles load onboarding with audited sensitive reads', (source) =>
  source.includes('loadEmployeeOnboarding(db, employee.id, businessId') &&
  source.includes('shouldLoadOnboarding') &&
  source.includes('auditSensitiveRead: true') &&
  source.includes('verify_i9') &&
  source.includes('approve_onboarding_packet') &&
  source.includes('return_onboarding_packet') &&
  !source.includes('save_profile')
);

expect('src/routes/onboarding/+page.server.ts', 'employees submit tenant-scoped packets from the dedicated onboarding route', (source) =>
  source.includes('loadEmployeeOnboarding') &&
  source.includes('submitEmployeeOnboardingItem') &&
  source.includes('submitEmployeeOnboardingPacket') &&
  source.includes('locals.businessId') &&
  source.includes('locals.userId')
);

expect('src/routes/onboarding/+page.svelte', 'employee packet uses official federal forms and one final submission', (source) =>
  source.includes('https://www.uscis.gov/sites/default/files/document/forms/i-9.pdf') &&
  source.includes('https://www.irs.gov/pub/irs-pdf/fw4.pdf') &&
  source.includes('Submit Packet') &&
  source.includes("['submitted', 'approved'].includes(packet.status)") &&
  source.includes('A new packet is required for changes.')
);

expect('src/routes/settings/+page.server.ts', 'ordinary profile settings cannot edit accepted legal identity fields', (source) =>
  !source.includes("profileText(formData, 'real_name'") &&
  !source.includes('submitEmployeeOnboardingItem') &&
  !source.includes('loadEmployeeOnboarding')
);

expect('src/routes/+layout.svelte', 'employee onboarding uses app chrome and is available for assigned packets', (source) =>
  source.includes('"/onboarding"') &&
  source.includes('hasEmployeeOnboarding') &&
  source.includes('employeePacketNav')
);

expect('src/hooks.server.ts', 'pending onboarding does not trap employees on profile settings', (source) =>
  !source.includes("throw redirect(303, '/settings?tab=onboarding')") &&
  !source.includes("event: 'employee_onboarding_gate'")
);

expect('src/routes/api/internal/schema-readiness/+server.ts', 'schema readiness includes onboarding and sensitive HR tables', (source) =>
  source.includes('employee_onboarding_packages') &&
  source.includes('employee_onboarding_items') &&
  source.includes('employee_onboarding_template_items') &&
  source.includes('idx_employee_onboarding_packages_user') &&
  source.includes('idx_employee_onboarding_items_package') &&
  source.includes('idx_employee_onboarding_template_business') &&
  source.includes('business_hr_settings') &&
  source.includes('employee_i9_verifications') &&
  source.includes('employee_i9_document_copies') &&
  source.includes('employee_onboarding_sensitive_snapshots') &&
  source.includes('idx_employee_onboarding_packages_review') &&
  source.includes('idx_employee_onboarding_sensitive_snapshot_item') &&
  source.includes('idx_employee_onboarding_sensitive_snapshot_package') &&
  source.includes('employee_sensitive_record_vault') &&
  source.includes('employee_sensitive_record_audit')
);

expect('migrations/0098_employee_onboarding_legal_workflow.sql', 'legal onboarding schema is versioned and tenant-scoped', (source) =>
  source.includes('CREATE TABLE IF NOT EXISTS business_hr_settings') &&
  source.includes('CREATE TABLE IF NOT EXISTS employee_i9_verifications') &&
  source.includes('CREATE TABLE IF NOT EXISTS employee_i9_document_copies') &&
  source.includes('CREATE TABLE IF NOT EXISTS employee_onboarding_sensitive_snapshots') &&
  source.includes("WHERE form_key IN ('federal_i9', 'federal_w4', 'state_withholding')")
);

expect('docs/PROJECT_HANDOFF.md', 'Phase 10 manual testing notes are tracked', (source) =>
  source.includes('9. Invite, onboarding, and HR') &&
  source.includes('Test owner, manager, employee, consultant, and contractor invite flows') &&
  source.includes('employee/manager invite registration skips business pricing') &&
  source.includes('Legal/payroll review is still required')
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
