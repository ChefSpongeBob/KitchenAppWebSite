import { prepareEmployeeOnboardingPacket, type AdminEmployeeProfile } from '#lib/server/admin.ts';
import { prepareDefaultBusinessPositions } from '#lib/server/business.ts';
import { hashSessionToken } from '#lib/server/auth.ts';
import { hashedAuditValue, getRequestIpAddress } from '#lib/server/security.ts';
import { prepareBusinessTrial } from '#lib/server/trial.ts';
import { prepareStoreBillingPlaceholder } from '#lib/server/storeBilling.ts';
import { prepareLegalAgreementAcceptance, LIABILITY_AGREEMENT_KEY, LIABILITY_AGREEMENT_VERSION } from '#lib/server/legal.ts';
import { normalizeBusinessRole } from '#lib/server/permissions.ts';
import { COMMUNICATION_CONSENT_VERSION } from '#lib/communicationConsent.ts';

type DB = App.RuntimeEnv['DB'];
export type NewAccountInvitation = {
  id: string; business_id: string; email_normalized: string; role: string; permission_template: string;
  position_id: string | null; employment_type: string; job_title: string; department: string;
  primary_schedule_department: string; schedule_departments_json: string; start_date: string;
  pay_type: string; manager_user_id: string | null; onboarding_required: number;
};
type NewBusiness = {
  id: string; name: string; slug: string; planTier: 'starter' | 'growth' | 'enterprise';
  logoUrl: string | null; legalName: string; registryId: string; contactEmail: string; contactPhone: string;
  websiteUrl: string | null; addressLine1: string; addressLine2: string; addressCity: string; addressState: string;
  addressPostalCode: string; addressCountry: string; addOnTempMonitoring: boolean; ownerTitle: string;
  storeBillingPreference: 'both' | 'google_play' | 'app_store';
  documents: Array<{ slug: string; title: string; section: 'Docs' | 'Menu'; category: string; url: string }>;
  departments: Array<{ name: string; roles: string[] }>;
};

export async function prepareNewAccountRegistration(db: DB, options: {
  userId: string; email: string; passwordHash: string; displayName: string; appRole: string;
  userColumns: { normalized: boolean; active: boolean; role: boolean };
  profile: AdminEmployeeProfile; emailUpdates: boolean; smsUpdates: boolean;
  invitation: NewAccountInvitation | null; inviteCode: string; business: NewBusiness | null;
  request: Request; env: Partial<App.RuntimeEnv>; now: number;
}) {
  const { userId, email, invitation, business, profile, now, request } = options;
  if (Boolean(invitation) === Boolean(business)) throw new Error('Registration requires one explicit restaurant destination.');
  const businessId = invitation?.business_id ?? business!.id;
  const owner = invitation ? normalizeBusinessRole(invitation.role) === 'owner' : true;
  const packetRequired = Boolean(invitation?.onboarding_required === 1 && invitation.employment_type !== 'contractor');
  const auditId = crypto.randomUUID();
  const guard = 'EXISTS (SELECT 1 FROM account_audit_logs WHERE id = ?)';
  const emailColumn = options.userColumns.normalized ? 'email_normalized' : 'lower(email)';
  const claimColumns = `id, business_id, action, email_hash, ip_hash, user_agent_hash, metadata_json, created_at`;
  const claimValues = [auditId, invitation?.business_id ?? null,
    invitation ? 'signup_completed_from_invite' : 'signup_completed_new_business', await hashedAuditValue(email),
    await hashedAuditValue(getRequestIpAddress(request)), await hashedAuditValue(request.headers.get('user-agent')),
    JSON.stringify(invitation ? { inviteId: invitation.id } : {}), now];
  // The claim has no new-user FK until that user exists. Every dependent write is
  // guarded by this claim and commits or rolls back in the caller's single D1 batch.
  const claim = invitation ? db.prepare(`INSERT INTO account_audit_logs (${claimColumns})
    SELECT ?, ?, ?, ?, ?, ?, ?, ? FROM business_invites i
    JOIN businesses b ON b.id = i.business_id
    JOIN business_trials billing ON billing.business_id = i.business_id AND billing.status IN ('paid', 'active')
    WHERE i.id = ? AND i.business_id = ? AND i.invite_code = ? AND i.email_normalized = ?
      AND i.used_at IS NULL AND i.revoked_at IS NULL AND (i.expires_at IS NULL OR i.expires_at >= unixepoch())
      AND b.status IN ('active', 'trialing', 'past_due', 'pending_payment')
      AND i.role IS ? AND i.permission_template IS ? AND i.position_id IS ?
      AND i.employment_type IS ? AND i.onboarding_required IS ? AND i.job_title IS ? AND i.department IS ?
      AND i.primary_schedule_department IS ? AND i.schedule_departments_json IS ?
      AND i.start_date IS ? AND i.pay_type IS ? AND i.manager_user_id IS ?
      AND (i.position_id IS NULL OR EXISTS (SELECT 1 FROM business_positions p
        WHERE p.id = i.position_id AND p.business_id = i.business_id AND p.is_active = 1 AND p.account_type = ?))
      AND NOT EXISTS (SELECT 1 FROM users WHERE ${emailColumn} = ?)`)
    .bind(...claimValues, invitation.id, businessId, options.inviteCode, email,
      invitation.role, invitation.permission_template, invitation.position_id, invitation.employment_type,
      invitation.onboarding_required, invitation.job_title, invitation.department, invitation.primary_schedule_department,
      invitation.schedule_departments_json, invitation.start_date, invitation.pay_type, invitation.manager_user_id,
      normalizeBusinessRole(invitation.role), email)
    : db.prepare(`INSERT INTO account_audit_logs (${claimColumns}) SELECT ?, ?, ?, ?, ?, ?, ?, ?
      WHERE NOT EXISTS (SELECT 1 FROM users WHERE ${emailColumn} = ?)`)
      .bind(...claimValues, email);
  const userColumns = ['id', 'email', ...(options.userColumns.normalized ? ['email_normalized'] : []),
    'password_hash', 'display_name', ...(options.userColumns.role ? ['role'] : []),
    ...(options.userColumns.active ? ['is_active'] : []), 'created_at', 'updated_at'];
  const userValues = [userId, email, ...(options.userColumns.normalized ? [email] : []), options.passwordHash, options.displayName,
    ...(options.userColumns.role ? [options.appRole] : []), ...(options.userColumns.active ? [1] : []), now, now];
  const statements = [claim, db.prepare(`INSERT INTO users (${userColumns.join(',')})
    SELECT ${userValues.map(() => '?').join(',')} WHERE ${guard}`).bind(...userValues, auditId)];

  if (business) {
    // Keep the readable reserved slug; resolve a simultaneous same-name creation inside the transaction.
    statements.push(db.prepare(`INSERT INTO businesses (
      id, name, slug, plan_tier, status, sidebar_logo_url, legal_business_name, registry_id, contact_email,
      contact_phone, website_url, address_line_1, address_line_2, address_city, address_state, address_postal_code,
      address_country, addon_temp_monitoring, created_at, updated_at
    ) SELECT ?, ?, CASE WHEN EXISTS (SELECT 1 FROM businesses WHERE slug = ?) THEN ? ELSE ? END,
      ?, 'pending_payment', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${guard}`)
      .bind(businessId, business.name, business.slug, `${business.slug}-${businessId}`, business.slug,
        business.planTier, business.logoUrl, business.legalName || null, business.registryId || null,
        business.contactEmail || null, business.contactPhone || null, business.websiteUrl,
        business.addressLine1 || null, business.addressLine2 || null, business.addressCity || null,
        business.addressState || null, business.addressPostalCode || null, business.addressCountry || null,
        business.addOnTempMonitoring ? 1 : 0, now, now, auditId));
  }
  statements.push(db.prepare(`INSERT INTO business_users (
    business_id, user_id, role, permission_template, position_id, created_at, updated_at
  ) SELECT ?, ?, ?, ?, ?, ?, ? WHERE ${guard}`)
    .bind(businessId, userId, invitation ? normalizeBusinessRole(invitation.role) : 'owner',
      invitation?.permission_template || (invitation ? normalizeBusinessRole(invitation.role) : 'owner'),
      invitation?.position_id ?? null, now, now, auditId));
  if (invitation) {
    statements.push(db.prepare(`UPDATE business_invites SET used_at = ?, used_by_user_id = ?
      WHERE id = ? AND business_id = ? AND ${guard}`).bind(now, userId, invitation.id, businessId, auditId));
  }
  statements.push(db.prepare(`INSERT INTO employee_profiles (
    business_id, user_id, real_name, phone, birthday, address_line_1, address_line_2, city, state, postal_code,
    emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, updated_at, updated_by
  ) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${guard}`)
    .bind(businessId, userId, profile.real_name, profile.phone, profile.birthday, profile.address_line_1,
      profile.address_line_2, profile.city, profile.state, profile.postal_code, profile.emergency_contact_name,
      profile.emergency_contact_phone, profile.emergency_contact_relationship, now, userId, auditId),
  db.prepare(`INSERT INTO user_preferences (
    user_id, email_updates, sms_updates, email_updates_consented_at, sms_updates_consented_at,
    communication_consent_version, communication_consent_source, dark_mode, language, updated_at
  ) SELECT ?, ?, ?, ?, ?, ?, 'registration', 0, 'en', ? WHERE ${guard}`)
    .bind(userId, options.emailUpdates ? 1 : 0, options.smsUpdates ? 1 : 0, options.emailUpdates ? now : null,
      options.smsUpdates ? now : null, COMMUNICATION_CONSENT_VERSION, now, auditId));
  for (const [channel, granted] of [['email', options.emailUpdates], ['sms', options.smsUpdates]] as const) {
    statements.push(db.prepare(`INSERT INTO communication_consent_events (
      id, user_id, business_id, channel, granted, disclosure_version, source, recorded_at
    ) SELECT ?, ?, ?, ?, ?, ?, 'registration', ? WHERE ${guard}`)
      .bind(crypto.randomUUID(), userId, businessId, channel, granted ? 1 : 0, COMMUNICATION_CONSENT_VERSION, now, auditId));
  }
  if (!invitation || !owner || packetRequired) {
    statements.push(db.prepare(`INSERT INTO employee_employment_records (
      business_id, user_id, employment_status, employment_type, job_title, department, primary_schedule_department,
      hire_date, start_date, pay_type, manager_user_id, created_at, updated_at, updated_by
    ) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${guard}`)
      .bind(businessId, userId, owner ? 'active' : 'onboarding', owner ? 'owner' : invitation!.employment_type || 'employee',
        business ? business.ownerTitle || 'Owner' : invitation!.job_title, invitation?.department || '',
        invitation?.primary_schedule_department || invitation?.department || '', invitation?.start_date || '',
        invitation?.start_date || '', invitation?.pay_type || '', invitation?.manager_user_id ?? null,
        now, now, invitation?.manager_user_id ?? userId, auditId));
  }
  if (invitation && (!owner || packetRequired)) {
    let departments: string[] = [];
    try { const values: unknown = JSON.parse(invitation.schedule_departments_json); if (Array.isArray(values)) departments = values.filter((value): value is string => typeof value === 'string'); }
    catch { /* Preserve the explicit primary-department fallback. */ }
    const primary = invitation.primary_schedule_department || invitation.department;
    if (primary) departments.push(primary);
    statements.push(db.prepare(`INSERT OR IGNORE INTO user_schedule_departments (business_id, user_id, department, updated_at)
      SELECT ?, ?, d.name, ? FROM schedule_departments d WHERE d.business_id = ? AND d.is_active = 1
      AND d.name IN (SELECT value FROM json_each(?)) AND ${guard}`)
      .bind(businessId, userId, now, businessId, JSON.stringify([...new Set(departments)]), auditId));
  }

  let packageId: string | null = null;
  if (packetRequired) {
    const packet = await prepareEmployeeOnboardingPacket(db, { businessId, userId, ownerPacket: owner,
      createdBy: userId, auditId, initialProfile: profile, env: options.env, now });
    packageId = packet.packageId; statements.push(...packet.statements);
  }
  if (business) {
    statements.push(...prepareDefaultBusinessPositions(db, businessId, userId, now, auditId));
    const departments = JSON.stringify(business.departments.map((department, index) => ({
      id: crypto.randomUUID(), name: department.name, sort: index,
      roles: department.roles.map((name, sort) => ({ id: crypto.randomUUID(), name, sort }))
    })));
    statements.push(db.prepare(`INSERT INTO schedule_departments (id, name, sort_order, is_active, created_at, updated_at, business_id)
      SELECT json_extract(value,'$.id'), json_extract(value,'$.name'), json_extract(value,'$.sort'), 1, ?, ?, ?
      FROM json_each(?) WHERE ${guard}`).bind(now, now, businessId, departments, auditId),
    db.prepare(`INSERT INTO user_schedule_departments (business_id, user_id, department, updated_at)
      SELECT ?, ?, json_extract(value,'$.name'), ? FROM json_each(?) WHERE ${guard}`)
      .bind(businessId, userId, now, departments, auditId),
    db.prepare(`INSERT INTO schedule_role_definitions (id, department, role_name, sort_order, is_active, created_at, updated_at, business_id)
      SELECT json_extract(r.value,'$.id'), json_extract(d.value,'$.name'), json_extract(r.value,'$.name'),
        json_extract(r.value,'$.sort'), 1, ?, ?, ? FROM json_each(?) d, json_each(d.value,'$.roles') r WHERE ${guard}`)
      .bind(now, now, businessId, departments, auditId));
    if (business.documents.some(document => document.section === 'Docs')) {
      statements.push(db.prepare(`INSERT OR IGNORE INTO creator_category_registry (id, business_id, editor_type, category, created_at)
        SELECT ?, ?, 'document', 'General', ? WHERE ${guard}`).bind(crypto.randomUUID(), businessId, now, auditId));
    }
    for (const document of business.documents) {
      statements.push(db.prepare(`INSERT INTO documents (id, slug, title, section, category, content, file_url, is_active, created_at, updated_at, business_id)
        SELECT ?, ?, ?, ?, ?, NULL, ?, 1, ?, ?, ? WHERE ${guard}`)
        .bind(crypto.randomUUID(), document.slug, document.title, document.section, document.category, document.url, now, now, businessId, auditId));
    }
    statements.push(...prepareBusinessTrial(db, { businessId, ownerUserId: userId, eligible: true, denialReason: null, statusOverride: 'pending_payment', now }, auditId),
      prepareLegalAgreementAcceptance(db, { businessId, userId, agreementKey: LIABILITY_AGREEMENT_KEY,
        agreementVersion: LIABILITY_AGREEMENT_VERSION, acceptedAt: now, acceptanceSource: 'register',
        ipAddress: getRequestIpAddress(request), userAgent: request.headers.get('user-agent') ?? '' }, auditId),
      prepareStoreBillingPlaceholder(db, { businessId, ownerUserId: userId, preferredStore: business.storeBillingPreference,
        planTier: business.planTier, addOnTempMonitoring: business.addOnTempMonitoring, status: 'pending_setup', now }, auditId));
  }
  const deviceId = crypto.randomUUID(), sessionId = crypto.randomUUID(), sessionToken = crypto.randomUUID();
  statements.push(db.prepare(`INSERT INTO devices (id, user_id, pin_hash, user_agent, last_ip, created_at, updated_at)
    SELECT ?, ?, '', ?, ?, ?, ? WHERE ${guard}`)
    .bind(deviceId, userId, request.headers.get('user-agent') ?? null, getRequestIpAddress(request), now, now, auditId),
  db.prepare(`INSERT INTO sessions (id, user_id, device_id, session_token_hash, created_at, last_seen_at, expires_at)
    SELECT ?, ?, ?, ?, ?, ?, ? WHERE ${guard}`)
    .bind(sessionId, userId, deviceId, await hashSessionToken(sessionToken), now, now, now + 60 * 60 * 24 * 30, auditId),
  db.prepare(`UPDATE account_audit_logs SET business_id = ?, actor_user_id = ?, target_user_id = ? WHERE id = ?`)
    .bind(businessId, userId, userId, auditId));
  return { statements, businessId, packageId, sessionId, sessionToken, auditId };
}
