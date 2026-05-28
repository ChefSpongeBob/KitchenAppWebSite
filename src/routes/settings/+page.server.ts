import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { getTableColumns } from '$lib/server/dbSchema';
import {
  ensureEmployeeProfileEditRequestsTable,
  ensureEmployeeProfilesTable,
  loadEmployeeOnboarding,
  loadAdminEmployeeProfile,
  loadPendingEmployeeProfileEditRequest,
  submitEmployeeOnboardingItem
} from '$lib/server/admin';
import {
  loadScheduleDepartmentApprovalsByUser,
  loadUserScheduleAvailability,
  saveUserScheduleAvailability
} from '$lib/server/schedules';
import type { ScheduleDepartment } from '$lib/assets/schedule';
import { getSessionCookieName } from '$lib/server/authCookies';
import { hashSessionToken } from '$lib/server/auth';
import {
  listUserSessions,
  revokeOtherUserSessions,
  revokeSessionById,
  writeAuditLog
} from '$lib/server/security';
import { ensureUserPreferencesSchema } from '$lib/server/userPreferences';

async function getUsersColumns(db: App.Platform['env']['DB']) {
  return getTableColumns(db, 'users');
}

function resolveActiveTab(requestedTab: string | null, shouldShowOnboarding: boolean) {
  if (requestedTab === 'personal' || requestedTab === 'contact') return 'profile';
  if (['availability', 'profile', 'onboarding', 'app'].includes(String(requestedTab))) return requestedTab;
  return shouldShowOnboarding ? 'onboarding' : 'profile';
}

function resolveSessionToken(cookies: Parameters<PageServerLoad>[0]['cookies']) {
  const primaryCookie = getSessionCookieName();
  return cookies.get(primaryCookie) ?? cookies.get('session_id') ?? cookies.get('session_id_pwa') ?? null;
}

export const load: PageServerLoad = async ({ locals, url, cookies, platform }) => {
  if (!locals.userId) throw redirect(303, '/login');
  const db = locals.DB;
  if (!db) throw redirect(303, '/login');
  const businessId = locals.businessId;
  if (!businessId) throw redirect(303, '/login');

  await ensureUserPreferencesSchema(db);
  await ensureEmployeeProfilesTable(db);
  await ensureEmployeeProfileEditRequestsTable(db);

  const userColumns = await getUsersColumns(db);
  const displayNameExpr = userColumns.has('display_name')
    ? 'display_name AS display_name'
    : userColumns.has('username')
      ? 'username AS display_name'
      : `'' AS display_name`;
  const emailExpr = userColumns.has('email') ? 'email AS email' : `'' AS email`;

  const user = await db
    .prepare(
      `
      SELECT id, ${displayNameExpr}, ${emailExpr}
      FROM users
      WHERE id = ?
      LIMIT 1
    `
    )
    .bind(locals.userId)
    .first<{ id: string; display_name: string | null; email: string | null }>();

  if (!user) throw redirect(303, '/login');

  const sessionToken = resolveSessionToken(cookies);
  const currentSessionTokenHash = sessionToken ? await hashSessionToken(sessionToken) : null;

  const [profile, pendingBirthdayRequest, onboarding, approvalsByUser, availability, preferences, sessions] = await Promise.all([
    loadAdminEmployeeProfile(db, locals.userId, businessId),
    loadPendingEmployeeProfileEditRequest(db, locals.userId, businessId),
    loadEmployeeOnboarding(db, locals.userId, businessId, {
      env: platform?.env,
      actorUserId: locals.userId,
      actorBusinessRole: locals.businessRole
    }),
    loadScheduleDepartmentApprovalsByUser(db, [locals.userId], businessId),
    loadUserScheduleAvailability(db, locals.userId, businessId),
    db
      .prepare(
        `
        SELECT email_updates, sms_updates, dark_mode, language
        FROM user_preferences
        WHERE user_id = ?
        LIMIT 1
      `
      )
      .bind(locals.userId)
      .first<{
        email_updates: number;
        sms_updates: number;
        dark_mode: number;
        language: string;
      }>(),
    listUserSessions(db, locals.userId, currentSessionTokenHash)
  ]);

  return {
    activeTab: resolveActiveTab(
      url.searchParams.get('tab'),
      Boolean(onboarding.package && onboarding.package.status !== 'approved')
    ),
    user: {
      id: user.id,
      username: user.display_name ?? '',
      email: user.email ?? ''
    },
    profile,
    onboarding,
    approvedDepartments: approvalsByUser.get(locals.userId) ?? ([] as ScheduleDepartment[]),
    availability,
    preferences: {
      emailUpdates: (preferences?.email_updates ?? 1) === 1,
      smsUpdates: (preferences?.sms_updates ?? 0) === 1,
      darkMode: (preferences?.dark_mode ?? 0) === 1,
      language: preferences?.language ?? 'en'
    },
    sessions,
    pendingBirthdayRequest
  };
};

export const actions: Actions = {
  submit_onboarding_item: ({ request, locals, platform }) =>
    submitEmployeeOnboardingItem(request, locals, platform?.env),
  save_availability: ({ request, locals }) => saveUserScheduleAvailability(request, locals),

  save_personal_info: async ({ request, locals }) => {
    if (!locals.userId) throw redirect(303, '/login');
    const db = locals.DB;
    if (!db) throw redirect(303, '/login');
    const businessId = locals.businessId;
    if (!businessId) throw redirect(303, '/login');

    await ensureEmployeeProfilesTable(db);

    const formData = await request.formData();
    const username = String(formData.get('username') ?? '').trim();
    const realName = String(formData.get('real_name') ?? '').trim();

    if (!username) return fail(400, { error: 'Username is required.' });

    const userColumns = await getUsersColumns(db);
    const nameColumn = userColumns.has('display_name')
      ? 'display_name'
      : userColumns.has('username')
        ? 'username'
        : null;

    if (!nameColumn) return fail(400, { error: 'User name column missing in DB schema.' });

    const now = Math.floor(Date.now() / 1000);
    if (userColumns.has('updated_at')) {
      await db
        .prepare(`UPDATE users SET ${nameColumn} = ?, updated_at = ? WHERE id = ?`)
        .bind(username, now, locals.userId)
        .run();
    } else {
      await db
        .prepare(`UPDATE users SET ${nameColumn} = ? WHERE id = ?`)
        .bind(username, locals.userId)
        .run();
    }

    const existing = await loadAdminEmployeeProfile(db, locals.userId, businessId);
    await db
      .prepare(
        `
        INSERT INTO employee_profiles (
          business_id,
          user_id,
          real_name,
          phone,
          birthday,
          address_line_1,
          address_line_2,
          city,
          state,
          postal_code,
          emergency_contact_name,
          emergency_contact_phone,
          emergency_contact_relationship,
          updated_at,
          updated_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(business_id, user_id) DO UPDATE SET
          real_name = excluded.real_name,
          updated_at = excluded.updated_at,
          updated_by = excluded.updated_by
        `
      )
      .bind(
        businessId,
        locals.userId,
        realName,
        existing.phone,
        existing.birthday,
        existing.address_line_1,
        existing.address_line_2,
        existing.city,
        existing.state,
        existing.postal_code,
        existing.emergency_contact_name,
        existing.emergency_contact_phone,
        existing.emergency_contact_relationship,
        now,
        locals.userId
      )
      .run();

    return { success: true, message: 'Personal information updated.' };
  },

  request_birthday_edit: async ({ request, locals }) => {
    if (!locals.userId) throw redirect(303, '/login');
    const db = locals.DB;
    if (!db) throw redirect(303, '/login');
    const businessId = locals.businessId;
    if (!businessId) throw redirect(303, '/login');

    await ensureEmployeeProfileEditRequestsTable(db);

    const formData = await request.formData();
    const requestedBirthday = String(formData.get('requested_birthday') ?? '').trim();
    if (!requestedBirthday || !/^\d{4}-\d{2}-\d{2}$/.test(requestedBirthday)) {
      return fail(400, { error: 'Birthday must use a valid date.' });
    }

    const currentProfile = await loadAdminEmployeeProfile(db, locals.userId, businessId);
    const now = Math.floor(Date.now() / 1000);
    const existing = await loadPendingEmployeeProfileEditRequest(db, locals.userId, businessId);

    if (existing) {
      await db
        .prepare(
          `
          UPDATE employee_profile_edit_requests
          SET requested_birthday = ?, requested_real_name = ?, requested_at = ?
          WHERE id = ? AND business_id = ?
          `
        )
        .bind(requestedBirthday, currentProfile.real_name, now, existing.id, businessId)
        .run();
    } else {
      await db
        .prepare(
          `
          INSERT INTO employee_profile_edit_requests (
            id,
            business_id,
            user_id,
            requested_real_name,
            requested_birthday,
            status,
            manager_note,
            requested_at
          )
          VALUES (?, ?, ?, ?, ?, 'pending', '', ?)
          `
        )
        .bind(crypto.randomUUID(), businessId, locals.userId, currentProfile.real_name, requestedBirthday, now)
        .run();
    }

    return { success: true, message: 'Birthday edit request submitted.' };
  },

  save_contact_info: async ({ request, locals }) => {
    if (!locals.userId) throw redirect(303, '/login');
    const db = locals.DB;
    if (!db) throw redirect(303, '/login');
    const businessId = locals.businessId;
    if (!businessId) throw redirect(303, '/login');

    await ensureEmployeeProfilesTable(db);
    const currentProfile = await loadAdminEmployeeProfile(db, locals.userId, businessId);
    const formData = await request.formData();
    const now = Math.floor(Date.now() / 1000);
    const email = String(formData.get('email') ?? '').trim().toLowerCase();
    const userColumns = await getUsersColumns(db);
    const hasEmail = userColumns.has('email');
    const hasEmailNormalized = userColumns.has('email_normalized');

    if (hasEmail) {
      if (!email) return fail(400, { error: 'Email is required.' });

      const duplicate = hasEmailNormalized
        ? await db
            .prepare(
              `
              SELECT id FROM users
              WHERE email_normalized = ? AND id != ?
              LIMIT 1
              `
            )
            .bind(email, locals.userId)
            .first<{ id: string }>()
        : await db
            .prepare(
              `
              SELECT id FROM users
              WHERE lower(email) = ? AND id != ?
              LIMIT 1
              `
            )
            .bind(email, locals.userId)
            .first<{ id: string }>();

      if (duplicate) return fail(400, { error: 'Email already in use.' });

      const assignments: string[] = ['email = ?'];
      const params: Array<string | number> = [email];
      if (hasEmailNormalized) {
        assignments.push('email_normalized = ?');
        params.push(email);
      }
      if (userColumns.has('updated_at')) {
        assignments.push('updated_at = ?');
        params.push(now);
      }
      params.push(locals.userId);

      await db
        .prepare(`UPDATE users SET ${assignments.join(', ')} WHERE id = ?`)
        .bind(...params)
        .run();
    }

    await db
      .prepare(
        `
        INSERT INTO employee_profiles (
          business_id,
          user_id,
          real_name,
          phone,
          birthday,
          address_line_1,
          address_line_2,
          city,
          state,
          postal_code,
          emergency_contact_name,
          emergency_contact_phone,
          emergency_contact_relationship,
          updated_at,
          updated_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(business_id, user_id) DO UPDATE SET
          phone = excluded.phone,
          address_line_1 = excluded.address_line_1,
          address_line_2 = excluded.address_line_2,
          city = excluded.city,
          state = excluded.state,
          postal_code = excluded.postal_code,
          emergency_contact_name = excluded.emergency_contact_name,
          emergency_contact_phone = excluded.emergency_contact_phone,
          emergency_contact_relationship = excluded.emergency_contact_relationship,
          updated_at = excluded.updated_at,
          updated_by = excluded.updated_by
        `
      )
      .bind(
        businessId,
        locals.userId,
        currentProfile.real_name,
        String(formData.get('phone') ?? '').trim(),
        currentProfile.birthday,
        String(formData.get('address_line_1') ?? '').trim(),
        String(formData.get('address_line_2') ?? '').trim(),
        String(formData.get('city') ?? '').trim(),
        String(formData.get('state') ?? '').trim(),
        String(formData.get('postal_code') ?? '').trim(),
        String(formData.get('emergency_contact_name') ?? '').trim(),
        String(formData.get('emergency_contact_phone') ?? '').trim(),
        String(formData.get('emergency_contact_relationship') ?? '').trim(),
        now,
        locals.userId
      )
      .run();

    return { success: true, message: 'Contact information updated.' };
  },

  save_app_settings: async ({ request, locals }) => {
    if (!locals.userId) throw redirect(303, '/login');
    const db = locals.DB;
    if (!db) throw redirect(303, '/login');

    await ensureUserPreferencesSchema(db);

    const formData = await request.formData();
    const emailUpdates = String(formData.get('email_updates') ?? '0') === '1';
    const smsUpdates = String(formData.get('sms_updates') ?? '0') === '1';
    const darkMode = String(formData.get('dark_mode') ?? '0') === '1';
    const language = String(formData.get('language') ?? 'en').trim() || 'en';
    const now = Math.floor(Date.now() / 1000);

    await db
      .prepare(
        `
        INSERT INTO user_preferences (user_id, email_updates, sms_updates, dark_mode, language, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          email_updates = excluded.email_updates,
          sms_updates = excluded.sms_updates,
          dark_mode = excluded.dark_mode,
          language = excluded.language,
          updated_at = excluded.updated_at
        `
      )
      .bind(
        locals.userId,
        emailUpdates ? 1 : 0,
        smsUpdates ? 1 : 0,
        darkMode ? 1 : 0,
        language,
        now
      )
      .run();

    return {
      success: true,
      message: 'App settings updated.',
      darkMode,
      language
    };
  },

  revoke_session: async ({ request, locals, getClientAddress }) => {
    if (!locals.userId) throw redirect(303, '/login');
    const db = locals.DB;
    if (!db) throw redirect(303, '/login');
    const formData = await request.formData();
    const sessionId = String(formData.get('session_id') ?? '').trim();
    if (!sessionId) return fail(400, { error: 'Missing session id.' });

    await revokeSessionById(db, locals.userId, sessionId);
    await writeAuditLog(db, {
      action: 'user_revoked_session',
      request,
      getClientAddress,
      businessId: locals.businessId ?? null,
      actorUserId: locals.userId,
      targetUserId: locals.userId,
      metadata: { sessionId }
    });

    return { success: true, message: 'Session revoked.' };
  },

  revoke_other_sessions: async ({ request, locals, cookies, getClientAddress }) => {
    if (!locals.userId) throw redirect(303, '/login');
    const db = locals.DB;
    if (!db) throw redirect(303, '/login');

    const sessionToken = resolveSessionToken(cookies);
    const currentSessionTokenHash = sessionToken ? await hashSessionToken(sessionToken) : null;
    await revokeOtherUserSessions(db, locals.userId, currentSessionTokenHash);
    await writeAuditLog(db, {
      action: 'user_revoked_all_sessions',
      request,
      getClientAddress,
      businessId: locals.businessId ?? null,
      actorUserId: locals.userId,
      targetUserId: locals.userId
    });

    return { success: true, message: 'Sessions revoked.' };
  }
};
