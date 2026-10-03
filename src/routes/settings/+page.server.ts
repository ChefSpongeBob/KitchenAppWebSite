import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { getTableColumns } from '$lib/server/dbSchema';
import {
  ensureEmployeeProfilesTable,
  loadAdminEmployeeProfile
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
import { normalizeFormText } from '$lib/server/inputSanitizer';

async function getUsersColumns(db: App.Platform['env']['DB']) {
  return getTableColumns(db, 'users');
}

function resolveActiveTab(requestedTab: string | null) {
  if (requestedTab === 'personal' || requestedTab === 'contact') return 'profile';
  if (['availability', 'profile', 'app'].includes(String(requestedTab))) return requestedTab;
  return 'profile';
}

function resolveSessionToken(cookies: Parameters<PageServerLoad>[0]['cookies']) {
  const primaryCookie = getSessionCookieName();
  return cookies.get(primaryCookie) ?? cookies.get('session_id') ?? cookies.get('session_id_pwa') ?? null;
}

function profileText(formData: FormData, key: string, maxLength: number) {
  return normalizeFormText(formData, key, { maxLength });
}

export const load: PageServerLoad = async ({ locals, url, cookies }) => {
  if (!locals.userId) throw redirect(303, '/login');
  const db = locals.DB;
  if (!db) throw redirect(303, '/login');
  const businessId = locals.businessId;
  if (!businessId) throw redirect(303, '/login');

  await ensureUserPreferencesSchema(db);
  await ensureEmployeeProfilesTable(db);

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

  const [profile, approvalsByUser, availability, preferences, sessions, onboardingPackage] = await Promise.all([
    loadAdminEmployeeProfile(db, locals.userId, businessId),
    loadScheduleDepartmentApprovalsByUser(db, [locals.userId], businessId),
    loadUserScheduleAvailability(db, locals.userId, businessId),
    db
      .prepare(
        `
        SELECT email_updates, sms_updates, push_updates, dark_mode, language
        FROM user_preferences
        WHERE user_id = ?
        LIMIT 1
      `
      )
      .bind(locals.userId)
      .first<{
        email_updates: number;
        sms_updates: number;
        push_updates: number;
        dark_mode: number;
        language: string;
      }>(),
    listUserSessions(db, locals.userId, currentSessionTokenHash),
    db
      .prepare(
        `
        SELECT id, status
        FROM employee_onboarding_packages
        WHERE business_id = ? AND user_id = ?
        ORDER BY updated_at DESC
        LIMIT 1
        `
      )
      .bind(businessId, locals.userId)
      .first<{ id: string; status: string }>()
      .catch(() => null)
  ]);

  return {
    activeTab: resolveActiveTab(url.searchParams.get('tab')),
    user: {
      id: user.id,
      username: user.display_name ?? '',
      email: user.email ?? ''
    },
    profile,
    approvedDepartments: approvalsByUser.get(locals.userId) ?? ([] as ScheduleDepartment[]),
    availability,
    preferences: {
      emailUpdates: (preferences?.email_updates ?? 1) === 1,
      smsUpdates: (preferences?.sms_updates ?? 0) === 1,
      pushUpdates: (preferences?.push_updates ?? 0) === 1,
      darkMode: (preferences?.dark_mode ?? 0) === 1,
      language: preferences?.language ?? 'en'
    },
    employeeOnboarding:
      onboardingPackage && onboardingPackage.status !== 'approved'
        ? {
            id: onboardingPackage.id,
            status: onboardingPackage.status,
            highlighted: url.searchParams.get('onboarding') === '1'
          }
        : null,
    sessions
  };
};

export const actions: Actions = {
  save_availability: ({ request, locals }) => saveUserScheduleAvailability(request, locals),

  save_personal_info: async ({ request, locals }) => {
    if (!locals.userId) throw redirect(303, '/login');
    const db = locals.DB;
    if (!db) throw redirect(303, '/login');
    if (!locals.businessId) throw redirect(303, '/login');

    const formData = await request.formData();
    const username = profileText(formData, 'username', 120);

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

    return { success: true, message: 'Profile name updated.' };
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
          updated_at = excluded.updated_at,
          updated_by = excluded.updated_by
        `
      )
      .bind(
        businessId,
        locals.userId,
        currentProfile.real_name,
        profileText(formData, 'phone', 48),
        currentProfile.birthday,
        currentProfile.address_line_1,
        currentProfile.address_line_2,
        currentProfile.city,
        currentProfile.state,
        currentProfile.postal_code,
        currentProfile.emergency_contact_name,
        currentProfile.emergency_contact_phone,
        currentProfile.emergency_contact_relationship,
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
    const pushUpdates = String(formData.get('push_updates') ?? '0') === '1';
    const darkMode = String(formData.get('dark_mode') ?? '0') === '1';
    const language = String(formData.get('language') ?? 'en').trim() || 'en';
    const now = Math.floor(Date.now() / 1000);

    await db
      .prepare(
        `
        INSERT INTO user_preferences (user_id, email_updates, sms_updates, push_updates, dark_mode, language, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          email_updates = excluded.email_updates,
          sms_updates = excluded.sms_updates,
          push_updates = excluded.push_updates,
          dark_mode = excluded.dark_mode,
          language = excluded.language,
          updated_at = excluded.updated_at
        `
      )
      .bind(
        locals.userId,
        emailUpdates ? 1 : 0,
        smsUpdates ? 1 : 0,
        pushUpdates ? 1 : 0,
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
