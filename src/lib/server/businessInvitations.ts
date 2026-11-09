import { fail, redirect } from '@sveltejs/kit';
import { normalizeInvitationCode, invitationLoginPath } from '#lib/invitations.ts';
import { ACTIVE_BUSINESS_COOKIE, getActiveBusinessCookieOptions } from '#lib/server/activeBusiness.ts';
import { loadEmployeeOnboarding, prepareEmployeeOnboardingPacket } from '#lib/server/admin.ts';
import { normalizeFormText } from '#lib/server/inputSanitizer.ts';
import { normalizeBusinessRole } from '#lib/server/permissions.ts';
import { getBusinessTrialAccess } from '#lib/server/trial.ts';
import { hashedAuditValue, getRequestIpAddress } from '#lib/server/security.ts';
import { recordOperationalEventBestEffort } from '#lib/server/operationalEvents.ts';
import { isCalendarDate } from '#lib/timeZones.ts';
import { isSensitiveEncryptionConfigured } from '#lib/server/sensitive.ts';
import { logOperationalError } from '#lib/server/observability.ts';

type DB = App.RuntimeEnv['DB'];
type Invitation = {
  id: string; business_id: string; business_name: string; email_normalized: string;
  role: string; permission_template: string; position_id: string | null; employment_type: string;
  job_title: string; department: string; primary_schedule_department: string; schedule_departments_json: string;
  start_date: string; pay_type: string; manager_user_id: string | null; onboarding_required: number;
};

export async function loadBusinessInvitation(db: DB, code: string, now = Math.floor(Date.now() / 1000)) {
  if (!code) return null;
  return db.prepare(`SELECT i.id, i.business_id, b.name AS business_name, i.email_normalized,
    i.role, i.permission_template, i.position_id, i.employment_type, i.job_title, i.department,
    i.primary_schedule_department, i.schedule_departments_json, i.start_date, i.pay_type,
    i.manager_user_id, i.onboarding_required
    FROM business_invites i JOIN businesses b ON b.id = i.business_id
    WHERE i.invite_code = ? AND i.used_at IS NULL AND i.revoked_at IS NULL
      AND (i.expires_at IS NULL OR i.expires_at >= ?) LIMIT 1`)
    .bind(normalizeInvitationCode(code), now).first<Invitation>();
}

export async function acceptExistingAccountInvitation(event: {
  locals: App.Locals; request: Request; url: URL;
  cookies: { set: (name: string, value: string, options: ReturnType<typeof getActiveBusinessCookieOptions>) => void };
}, form: FormData) {
  const { locals, request, url, cookies } = event;
  const code = normalizeInvitationCode(String(form.get('invite_code') ?? url.searchParams.get('invite') ?? ''));
  if (!locals.userId || !locals.sessionId) redirect(303, invitationLoginPath(code));
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Sign in is temporarily unavailable.' });
  const now = Math.floor(Date.now() / 1000);
  const [invite, user] = await Promise.all([
    loadBusinessInvitation(db, code, now),
    db.prepare('SELECT email_normalized FROM users WHERE id = ? AND is_active = 1')
      .bind(locals.userId).first<{ email_normalized: string }>()
  ]);
  if (!invite || !user || user.email_normalized !== invite.email_normalized) {
    return fail(403, { error: 'Sign in with the email address this invitation was sent to.' });
  }
  const membership = await db.prepare('SELECT is_active FROM business_users WHERE business_id = ? AND user_id = ?')
    .bind(invite.business_id, locals.userId).first();
  if (membership) return fail(409, { error: 'This account already has a restaurant record. Contact its manager to change access.' });
  const retained = await db.prepare('SELECT 1 FROM employee_profiles WHERE business_id = ? AND user_id = ?')
    .bind(invite.business_id, locals.userId).first();
  if (retained) return fail(409, { error: 'Contact the restaurant manager to restore your existing employee record.' });
  const access = await getBusinessTrialAccess(db, invite.business_id, now);
  if (access.mode !== 'active' || !access.allowApp) return fail(403, { error: 'This restaurant is not active yet.' });
  const values = {
    realName: normalizeFormText(form, 'real_name', { maxLength: 120 }), birthday: normalizeFormText(form, 'birthday', { maxLength: 10 }),
    userPhone: normalizeFormText(form, 'user_phone', { maxLength: 48 }),
    userAddressLine1: normalizeFormText(form, 'user_address_line_1', { maxLength: 120 }),
    userAddressLine2: normalizeFormText(form, 'user_address_line_2', { maxLength: 120 }),
    userCity: normalizeFormText(form, 'user_city', { maxLength: 80 }), userState: normalizeFormText(form, 'user_state', { maxLength: 80 }),
    userPostalCode: normalizeFormText(form, 'user_postal_code', { maxLength: 24 }), email: user.email_normalized
  };
  if (!values.realName || !isCalendarDate(values.birthday) || !values.userPhone || !values.userAddressLine1 || !values.userCity || !values.userState || !values.userPostalCode) {
    return fail(400, { error: 'Complete your information to join this restaurant.', values });
  }
  const owner = normalizeBusinessRole(invite.role) === 'owner';
  const packetRequired = invite.onboarding_required === 1 && invite.employment_type !== 'contractor';
  if (packetRequired && !isSensitiveEncryptionConfigured(locals.env)) return fail(503, { error: 'Onboarding is temporarily unavailable.', values });
  const auditId = crypto.randomUUID();
  const guarded = 'EXISTS (SELECT 1 FROM account_audit_logs WHERE id = ?)';
  // The audit row claims this exact invite inside the same transaction as every tenant write.
  const statements = [db.prepare(`INSERT INTO account_audit_logs (
    id, business_id, actor_user_id, target_user_id, action, email_hash, ip_hash, user_agent_hash, metadata_json, created_at
  ) SELECT ?, i.business_id, u.id, u.id, 'existing_account_invite_accepted', ?, ?, ?, ?, ?
    FROM business_invites i JOIN users u ON u.id = ? AND u.is_active = 1 AND u.email_normalized = i.email_normalized
    JOIN businesses b ON b.id = i.business_id
    JOIN business_trials billing ON billing.business_id = i.business_id AND billing.status IN ('paid', 'active')
    WHERE i.id = ? AND i.invite_code = ? AND i.used_at IS NULL AND i.revoked_at IS NULL
      AND (i.expires_at IS NULL OR i.expires_at >= ?)
      AND i.role = ? AND i.permission_template = ? AND i.position_id IS ? AND i.onboarding_required = ? AND i.employment_type = ?
      AND EXISTS (SELECT 1 FROM sessions s WHERE s.id = ? AND s.user_id = u.id AND s.revoked_at IS NULL AND s.expires_at >= ?)
      AND b.status IN ('active', 'trialing', 'past_due', 'pending_payment')
      AND (i.position_id IS NULL OR EXISTS (SELECT 1 FROM business_positions p WHERE p.id = i.position_id AND p.business_id = i.business_id AND p.is_active = 1 AND p.account_type = ?))
      AND NOT EXISTS (SELECT 1 FROM business_users m WHERE m.business_id = i.business_id AND m.user_id = u.id)`)
    .bind(auditId, await hashedAuditValue(user.email_normalized), await hashedAuditValue(getRequestIpAddress(request)),
      await hashedAuditValue(request.headers.get('user-agent')), JSON.stringify({ inviteId: invite.id }), now, locals.userId, invite.id, code, now,
      invite.role, invite.permission_template, invite.position_id, invite.onboarding_required, invite.employment_type,
      locals.sessionId, now, normalizeBusinessRole(invite.role)),
    db.prepare(`INSERT INTO business_users (business_id, user_id, role, permission_template, position_id, created_at, updated_at)
      SELECT ?, ?, ?, ?, ?, ?, ? WHERE ${guarded}`)
      .bind(invite.business_id, locals.userId, normalizeBusinessRole(invite.role), invite.permission_template, invite.position_id, now, now, auditId),
    db.prepare(`UPDATE business_invites SET used_at = ?, used_by_user_id = ? WHERE id = ? AND business_id = ? AND ${guarded}`)
      .bind(now, locals.userId, invite.id, invite.business_id, auditId),
    db.prepare(`INSERT INTO employee_profiles (business_id, user_id, real_name, phone, birthday, address_line_1,
      address_line_2, city, state, postal_code, updated_at, updated_by)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${guarded}`)
      .bind(invite.business_id, locals.userId, values.realName, values.userPhone, values.birthday, values.userAddressLine1,
        values.userAddressLine2, values.userCity, values.userState, values.userPostalCode, now, locals.userId, auditId)
  ];
  if (!owner || packetRequired) {
    statements.push(db.prepare(`INSERT INTO employee_employment_records (business_id, user_id, employment_status,
      employment_type, job_title, department, primary_schedule_department, hire_date, start_date, pay_type,
      manager_user_id, created_at, updated_at, updated_by)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${guarded}`)
      .bind(invite.business_id, locals.userId, owner ? 'active' : 'onboarding', owner ? 'owner' : invite.employment_type,
        invite.job_title, invite.department, invite.primary_schedule_department, invite.start_date, invite.start_date,
        invite.pay_type, invite.manager_user_id, now, now, locals.userId, auditId));
    let departments: string[] = [];
    try { const parsed: unknown = JSON.parse(invite.schedule_departments_json); if (Array.isArray(parsed)) departments = parsed.filter((value): value is string => typeof value === 'string'); } catch { /* Use the primary department below. */ }
    if (invite.primary_schedule_department) departments.push(invite.primary_schedule_department);
    statements.push(db.prepare(`INSERT OR IGNORE INTO user_schedule_departments (business_id, user_id, department, updated_at)
      SELECT ?, ?, d.name, ? FROM schedule_departments d WHERE d.business_id = ? AND d.is_active = 1
        AND d.name IN (SELECT value FROM json_each(?)) AND ${guarded}`)
      .bind(invite.business_id, locals.userId, now, invite.business_id, JSON.stringify([...new Set(departments)]), auditId));
  }
  let packet: Awaited<ReturnType<typeof prepareEmployeeOnboardingPacket>> | null = null;
  let committed;
  try {
    if (packetRequired) packet = await prepareEmployeeOnboardingPacket(db, {
      businessId: invite.business_id, userId: locals.userId, createdBy: locals.userId, ownerPacket: owner, auditId, now
    });
    if (packet) statements.push(...packet.statements);
    committed = await db.batch(statements);
  } catch (error) {
    logOperationalError({ event: 'existing_account_invite_save_failed', request, businessId: invite.business_id, userId: locals.userId, error });
    return fail(503, { error: 'Your restaurant setup could not be saved. Please try again.', values });
  }
  if (committed[0].meta.changes !== 1) return fail(409, { error: 'This invitation changed. Refresh and try again.', values });
  if (packet) {
    try { await loadEmployeeOnboarding(db, locals.userId, invite.business_id, { env: locals.env, actorUserId: locals.userId }); }
    catch (error) { logOperationalError({ event: 'onboarding_profile_hydration_failed', request, businessId: invite.business_id, userId: locals.userId, error }); }
    await recordOperationalEventBestEffort(db, { businessId: invite.business_id, eventType: 'onboarding.package.sent',
      category: 'onboarding', targetUserId: locals.userId, subjectType: 'employee_onboarding_package', subjectId: packet.packageId,
      title: 'Onboarding package ready' }, request);
  }
  cookies.set(ACTIVE_BUSINESS_COOKIE, invite.business_id, getActiveBusinessCookieOptions(request));
  redirect(303, `/register/welcome?onboarding=${packet ? '1' : '0'}`);
}
