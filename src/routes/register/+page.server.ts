import { dev } from '$app/environment';
import { fail, isRedirect, redirect, type Actions } from '@sveltejs/kit';
import { hashPassword, hashSessionToken } from '$lib/server/auth';
import { getSessionCookieName, getSessionCookieOptions } from '$lib/server/authCookies';
import {
	ACTIVE_BUSINESS_COOKIE,
	getActiveBusinessCookieOptions
} from '$lib/server/activeBusiness';
import { hasColumn } from '$lib/server/dbSchema';
import { ensureBusinessSchema, reserveBusinessSlug } from '$lib/server/business';
import { ensureEmployeeOnboardingRequirement, ensureEmployeeProfilesTable } from '$lib/server/admin';
import {
	LIABILITY_AGREEMENT_KEY,
	LIABILITY_AGREEMENT_VERSION,
	recordLegalAgreementAcceptance
} from '$lib/server/legal';
import {
	createTrialDenialRecord,
	evaluateTrialEligibility,
	getRequestIpAddress,
	initializeBusinessTrial,
	type TrialEligibility
} from '$lib/server/trial';
import { upsertStoreBillingPlaceholder } from '$lib/server/storeBilling';
import { validateNewPassword } from '$lib/server/passwordReset';
import { checkRateLimit, writeAuditLog, writeAuditLogSafe } from '$lib/server/security';
import { ensureUserPreferencesSchema } from '$lib/server/userPreferences';
import { effectiveAppRoleFromBusinessRole, normalizeBusinessRole } from '$lib/server/permissions';
import { sendSignupConfirmationEmail } from '$lib/server/email';
import type { PageServerLoad } from './$types';

type RegisterActiveSlideId = 'tier' | 'business' | 'security' | 'purchase';

type RegisterFormValues = {
	displayName: string;
	ownerTitle: string;
	realName: string;
	birthday: string;
	email: string;
	confirmEmail: string;
	userPhone: string;
	userAddressLine1: string;
	userAddressLine2: string;
	userCity: string;
	userState: string;
	userPostalCode: string;
	emergencyContactName: string;
	emergencyContactPhone: string;
	emergencyContactRelationship: string;
	emailUpdates: boolean;
	businessName: string;
	planTier: string;
	addOnTempMonitoring: boolean;
	addOnCameraMonitoring: boolean;
	legalName: string;
	registryId: string;
	contactEmail: string;
	contactPhone: string;
	websiteUrl: string;
	addressLine1: string;
	addressLine2: string;
	addressCity: string;
	addressState: string;
	addressPostalCode: string;
	addressCountry: string;
	purchaseMode: 'trial' | 'buy_now';
	storeBillingPreference: 'both' | 'google_play' | 'app_store';
	liabilityAgreementAccepted: boolean;
};

function parseInviteDepartments(value: string | null | undefined, fallback = '') {
	try {
		const parsed = JSON.parse(value || '[]');
		if (Array.isArray(parsed)) {
			const cleaned = parsed.map((item) => String(item ?? '').trim()).filter(Boolean);
			if (cleaned.length > 0) return Array.from(new Set(cleaned));
		}
	} catch {
		// Fall back to legacy invite department fields below.
	}
	const normalizedFallback = fallback.trim();
	return normalizedFallback ? [normalizedFallback] : [];
}

const PLAN_TIER_MAP: Record<string, 'starter' | 'growth' | 'enterprise'> = {
	small: 'starter',
	medium: 'growth',
	large: 'enterprise',
	starter: 'starter',
	growth: 'growth',
	enterprise: 'enterprise'
};

function tempMonitoringIncludedForPlan(planTier: 'starter' | 'growth' | 'enterprise') {
	return planTier === 'growth' || planTier === 'enterprise';
}

async function hasEmailNormalizedColumn(db: App.Platform['env']['DB']) {
	return hasColumn(db, 'users', 'email_normalized');
}

async function hasIsActiveColumn(db: App.Platform['env']['DB']) {
	return hasColumn(db, 'users', 'is_active');
}

async function hasRoleColumn(db: App.Platform['env']['DB']) {
	return hasColumn(db, 'users', 'role');
}

async function createRegistrationSession({
	db,
	cookies,
	request,
	userId,
	businessId,
	now
}: {
	db: App.Platform['env']['DB'];
	cookies: Parameters<Actions['default']>[0]['cookies'];
	request: Request;
	userId: string;
	businessId: string;
	now: number;
}) {
	const deviceId = crypto.randomUUID();
	const sessionId = crypto.randomUUID();
	const sessionToken = crypto.randomUUID();
	const sessionTokenHash = await hashSessionToken(sessionToken);
	const expires = now + 60 * 60 * 24 * 30;

	await db
		.prepare(
			`
			INSERT INTO devices (
				id,
				user_id,
				pin_hash,
				user_agent,
				last_ip,
				created_at,
				updated_at
			)
			VALUES (?, ?, '', ?, ?, ?, ?)
		`
		)
		.bind(deviceId, userId, request.headers.get('user-agent') ?? null, getRequestIpAddress(request), now, now)
		.run();

	await db
		.prepare(
			`
			INSERT INTO sessions (
				id,
				user_id,
				device_id,
				session_token_hash,
				created_at,
				last_seen_at,
				expires_at
			)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`
		)
		.bind(sessionId, userId, deviceId, sessionTokenHash, now, now, expires)
		.run();

	cookies.set(getSessionCookieName(), sessionToken, getSessionCookieOptions(request));
	cookies.set(ACTIVE_BUSINESS_COOKIE, businessId, getActiveBusinessCookieOptions(request));
	cookies.delete('session_id', { path: '/' });
	cookies.delete('session_id_pwa', { path: '/' });
}

async function ensureUserInvitesTable(db: App.Platform['env']['DB']) {
	if (!dev) return;

	await db.prepare(`
		CREATE TABLE IF NOT EXISTS user_invites (
			id TEXT PRIMARY KEY,
			email TEXT NOT NULL,
			email_normalized TEXT NOT NULL,
			invite_code TEXT NOT NULL UNIQUE,
			invited_by TEXT,
			created_at INTEGER NOT NULL,
			expires_at INTEGER,
			used_at INTEGER,
			used_by_user_id TEXT,
			revoked_at INTEGER
		)
	`).run();
}

function toOptionalString(form: FormData, key: string, maxLength: number) {
	return String(form.get(key) ?? '').trim().slice(0, maxLength);
}

function looksLikeEmail(value: string) {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeWebsite(raw: string) {
	if (!raw) return '';
	const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
	try {
		const parsed = new URL(withProtocol);
		if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
		return parsed.toString();
	} catch {
		return null;
	}
}

function registerFailure(
	status: number,
	error: string,
	activeSlideId: RegisterActiveSlideId,
	values: Partial<RegisterFormValues>
) {
	return fail(status, { error, activeSlideId, values });
}

export const actions: Actions = {
	default: async ({ request, locals, url, cookies, platform }) => {
		let submittedValues: Partial<RegisterFormValues> = {};
		let registerDb: App.Platform['env']['DB'] | null = null;
		let registerEmail = '';
		let registerPhase = 'start';
		try {
			registerPhase = 'read_form';
			const formData = await request.formData();

			const displayName = String(formData.get('display_name') || '').trim();
			const ownerTitle = toOptionalString(formData, 'owner_title', 120);
			const email = String(formData.get('email') || '').trim().toLowerCase();
			registerEmail = email;
			const confirmEmail = String(formData.get('confirm_email') || '').trim().toLowerCase();
			const password = String(formData.get('password') || '');
			const confirmPassword = String(formData.get('confirm_password') || '');
			const inviteCodeFromForm = String(formData.get('invite_code') || '').trim().toUpperCase();
			const inviteCodeFromUrl = String(url.searchParams.get('invite') || url.searchParams.get('code') || '')
				.trim()
				.toUpperCase();
			const inviteCode = inviteCodeFromForm || inviteCodeFromUrl;
			const businessName = String(formData.get('business_name') || '').trim();
			const requestedBusinessSlug = String(formData.get('business_slug') || '').trim();
			const planTierRaw = String(formData.get('plan_tier') || 'starter').trim().toLowerCase();
			const planTier = PLAN_TIER_MAP[planTierRaw] ?? 'starter';
			const addOnTempMonitoring = tempMonitoringIncludedForPlan(planTier);
			const addOnCameraMonitoring = false;
			const legalName = toOptionalString(formData, 'legal_name', 120);
			const registryId = toOptionalString(formData, 'registry_id', 80);
			const contactEmail = toOptionalString(formData, 'contact_email', 120).toLowerCase();
			const contactPhone = toOptionalString(formData, 'contact_phone', 48);
			const websiteRaw = toOptionalString(formData, 'website_url', 180);
			const addressLine1 = toOptionalString(formData, 'address_line_1', 120);
			const addressLine2 = toOptionalString(formData, 'address_line_2', 120);
			const addressCity = toOptionalString(formData, 'address_city', 80);
			const addressState = toOptionalString(formData, 'address_state', 80);
			const addressPostalCode = toOptionalString(formData, 'address_postal_code', 24);
			const addressCountry = toOptionalString(formData, 'address_country', 80);
			const realName = toOptionalString(formData, 'real_name', 120);
			const birthday = toOptionalString(formData, 'birthday', 10);
			const userPhone = toOptionalString(formData, 'user_phone', 48);
			const userAddressLine1 = toOptionalString(formData, 'user_address_line_1', 120);
			const userAddressLine2 = toOptionalString(formData, 'user_address_line_2', 120);
			const userCity = toOptionalString(formData, 'user_city', 80);
			const userState = toOptionalString(formData, 'user_state', 80);
			const userPostalCode = toOptionalString(formData, 'user_postal_code', 24);
			const emergencyContactName = toOptionalString(formData, 'emergency_contact_name', 120);
			const emergencyContactPhone = toOptionalString(formData, 'emergency_contact_phone', 48);
			const emergencyContactRelationship = toOptionalString(formData, 'emergency_contact_relationship', 80);
			const wantsEmailUpdates = String(formData.get('email_updates') || '0') === '1';
			const clientFingerprint = String(formData.get('client_fingerprint') || '').trim();
			const purchaseModeRaw = String(formData.get('purchase_mode') || 'trial')
				.trim()
				.toLowerCase();
			const purchaseMode = purchaseModeRaw === 'buy_now' ? 'buy_now' : 'trial';
			const storeBillingPreference = String(formData.get('store_billing_preference') || 'both')
				.trim()
				.toLowerCase();
			const safeStoreBillingPreference =
				storeBillingPreference === 'google_play' || storeBillingPreference === 'app_store'
					? storeBillingPreference
					: 'both';
			const liabilityAgreementAccepted =
				String(formData.get('liability_agreement_accepted') || '0') === '1';
			const liabilityAgreementVersion = String(formData.get('liability_agreement_version') || '')
				.trim()
				.slice(0, 32);

			submittedValues = {
				displayName,
				ownerTitle,
				realName,
				birthday,
				email,
				confirmEmail,
				userPhone,
				userAddressLine1,
				userAddressLine2,
				userCity,
				userState,
				userPostalCode,
				emergencyContactName,
				emergencyContactPhone,
				emergencyContactRelationship,
				emailUpdates: wantsEmailUpdates,
				businessName,
				planTier: planTierRaw,
				addOnTempMonitoring,
				addOnCameraMonitoring,
				legalName,
				registryId,
				contactEmail,
				contactPhone,
				websiteUrl: websiteRaw,
				addressLine1,
				addressLine2,
				addressCity,
				addressState,
				addressPostalCode,
				addressCountry,
				purchaseMode,
				storeBillingPreference: safeStoreBillingPreference,
				liabilityAgreementAccepted
			};

			if (!displayName || !email || !confirmEmail || !password || !confirmPassword) {
				return registerFailure(400, 'All fields required.', 'security', submittedValues);
			}
			if (!inviteCode && !businessName) {
				return registerFailure(400, 'Business name is required to create your workspace.', 'business', submittedValues);
			}
			if (email !== confirmEmail) {
				return registerFailure(400, 'Emails do not match.', 'security', submittedValues);
			}
			const passwordError = validateNewPassword(password, confirmPassword);
			if (passwordError) {
				return registerFailure(400, String(passwordError.data?.error ?? 'Enter a valid password.'), 'security', submittedValues);
			}
			if (birthday && !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
				return registerFailure(400, 'Birthday must use a valid date.', 'security', submittedValues);
			}
			if (contactEmail && !looksLikeEmail(contactEmail)) {
				return registerFailure(400, 'Enter a valid business contact email.', 'business', submittedValues);
			}
			if (!inviteCode && !liabilityAgreementAccepted) {
				return registerFailure(400, 'You must accept the liability agreement to continue.', 'purchase', submittedValues);
			}
			if (!inviteCode && liabilityAgreementVersion && liabilityAgreementVersion !== LIABILITY_AGREEMENT_VERSION) {
				return registerFailure(400, 'Please refresh and accept the latest liability agreement.', 'purchase', submittedValues);
			}

			const websiteUrl = normalizeWebsite(websiteRaw);
			if (websiteRaw && !websiteUrl) {
				return registerFailure(400, 'Enter a valid business website URL.', 'business', submittedValues);
			}

			registerPhase = 'database';
			const db = locals.DB;
			registerDb = db ?? null;
			if (!db) {
				return registerFailure(503, 'Database is not configured yet.', 'purchase', submittedValues);
			}
			const buyNowRequested = !inviteCode && purchaseMode === 'buy_now';

			registerPhase = 'schema';
			await ensureUserInvitesTable(db);
			await ensureBusinessSchema(db);

			registerPhase = 'rate_limit';
			const signupIp = getRequestIpAddress(request);
			const [signupIpLimit, signupEmailLimit] = await Promise.all([
				checkRateLimit(db, {
					action: 'signup_ip',
					identifier: signupIp,
					limit: 8,
					windowSeconds: 60 * 60,
					blockSeconds: 60 * 60
				}),
				checkRateLimit(db, {
					action: 'signup_email',
					identifier: email,
					limit: 3,
					windowSeconds: 24 * 60 * 60,
					blockSeconds: 24 * 60 * 60
				})
			]);
			if (!signupIpLimit.allowed || !signupEmailLimit.allowed) {
				await writeAuditLog(db, {
					action: 'signup_rate_limited',
					request,
					email
				});
				return registerFailure(429, 'Too many attempts. Try again shortly.', 'security', submittedValues);
			}

			registerPhase = 'existing_account';
			const hasNormalized = await hasEmailNormalizedColumn(db);
			const hasIsActive = await hasIsActiveColumn(db);
			const hasRole = await hasRoleColumn(db);
			const existing = hasNormalized
				? await db
						.prepare(
							`
			SELECT id FROM users
			WHERE email_normalized = ?
		`
						)
						.bind(email)
						.first()
				: await db
						.prepare(
							`
			SELECT id FROM users
			WHERE lower(email) = ?
		`
						)
						.bind(email)
						.first();

			if (existing) {
				await writeAuditLog(db, {
					action: 'signup_blocked_existing_account',
					request,
					email
				});
				return registerFailure(400, 'Account already exists.', 'security', submittedValues);
			}

			const now = Math.floor(Date.now() / 1000);
			registerPhase = 'trial_eligibility';
			let trialEligibility: TrialEligibility = { eligible: true, reason: null };
			if (!inviteCode && purchaseMode !== 'buy_now') {
				trialEligibility = await evaluateTrialEligibility(db, {
					emailNormalized: email,
					businessName,
					clientFingerprint,
					ipAddress: getRequestIpAddress(request),
					userAgent: request.headers.get('user-agent') ?? ''
				});
				if (!trialEligibility.eligible) {
					await createTrialDenialRecord(
						db,
						{
							emailNormalized: email,
							businessName,
							clientFingerprint,
							ipAddress: getRequestIpAddress(request),
							userAgent: request.headers.get('user-agent') ?? ''
						},
						'abuse',
						trialEligibility.reason ?? 'trial_reuse'
					);
					return registerFailure(400, 'Free trial unavailable. Choose purchase to continue.', 'purchase', submittedValues);
				}
			}

			let businessInvite:
				| {
						id: string;
						business_id: string;
						email_normalized: string;
						role: string;
						permission_template: string;
						employment_type: string;
						job_title: string;
						department: string;
						primary_schedule_department: string;
						schedule_departments_json: string;
						start_date: string;
						pay_type: string;
						manager_user_id: string | null;
						onboarding_required: number;
						expires_at: number | null;
						revoked_at: number | null;
						used_at: number | null;
				  }
				| null = null;
			let invite:
				| {
						id: string;
						email_normalized: string;
						expires_at: number | null;
						revoked_at: number | null;
						used_at: number | null;
						invited_by: string | null;
				  }
				| null = null;
			if (inviteCode) {
				businessInvite = await db
					.prepare(
						`
				SELECT
					id,
					business_id,
					email_normalized,
					role,
					permission_template,
					employment_type,
					job_title,
					department,
					primary_schedule_department,
					schedule_departments_json,
					start_date,
					pay_type,
					manager_user_id,
					onboarding_required,
					expires_at,
					revoked_at,
					used_at
				FROM business_invites
				WHERE invite_code = ?
				LIMIT 1
			`
					)
					.bind(inviteCode)
					.first<{
						id: string;
						business_id: string;
						email_normalized: string;
						role: string;
						permission_template: string;
						employment_type: string;
						job_title: string;
						department: string;
						primary_schedule_department: string;
						schedule_departments_json: string;
						start_date: string;
						pay_type: string;
						manager_user_id: string | null;
						onboarding_required: number;
						expires_at: number | null;
						revoked_at: number | null;
						used_at: number | null;
					}>();

				if (businessInvite) {
					if (businessInvite.revoked_at !== null || businessInvite.used_at !== null) {
						return registerFailure(400, 'Invite code is invalid.', 'security', submittedValues);
					}

					if (businessInvite.email_normalized !== email) {
						return registerFailure(400, 'Invite code does not match this email address.', 'security', submittedValues);
					}

					if (businessInvite.expires_at !== null && businessInvite.expires_at < now) {
						return registerFailure(400, 'Invite code has expired.', 'security', submittedValues);
					}
				} else {
					invite = await db
						.prepare(
							`
					SELECT id, email_normalized, expires_at, revoked_at, used_at, invited_by
					FROM user_invites
					WHERE invite_code = ?
					LIMIT 1
				`
						)
						.bind(inviteCode)
						.first<{
							id: string;
							email_normalized: string;
							expires_at: number | null;
							revoked_at: number | null;
							used_at: number | null;
							invited_by: string | null;
						}>();

					if (!invite || invite.revoked_at !== null || invite.used_at !== null) {
						return registerFailure(400, 'Invite code is invalid.', 'security', submittedValues);
					}

					if (invite.email_normalized !== email) {
						return registerFailure(400, 'Invite code does not match this email address.', 'security', submittedValues);
					}

					if (invite.expires_at !== null && invite.expires_at < now) {
						return registerFailure(400, 'Invite code has expired.', 'security', submittedValues);
					}
				}
			}

			registerPhase = 'password_hash';
			const userId = crypto.randomUUID();
			const passwordHash = await hashPassword(password);
			let resolvedBusinessId: string | null = null;

			registerPhase = 'create_user';
			const invitedBusinessRole = normalizeBusinessRole(businessInvite?.role ?? '');
			const roleValue = inviteCode
				? effectiveAppRoleFromBusinessRole(invitedBusinessRole, businessInvite?.permission_template)
				: 'admin';
			if (hasNormalized) {
				const sql = hasIsActive
					? `
			INSERT INTO users (
				id,
				email,
				email_normalized,
				password_hash,
				display_name,
				${hasRole ? 'role,' : ''}
				is_active,
				created_at,
				updated_at
			)
			VALUES (?, ?, ?, ?, ?, ${hasRole ? '?, ' : ''}1, ?, ?)
		`
					: `
			INSERT INTO users (
				id,
				email,
				email_normalized,
				password_hash,
				display_name,
				${hasRole ? 'role,' : ''}
				created_at,
				updated_at
			)
			VALUES (?, ?, ?, ?, ?, ${hasRole ? '?, ' : ''}?, ?)
		`;
				const stmt = db.prepare(sql);
				if (hasIsActive && hasRole) {
					await stmt.bind(userId, email, email, passwordHash, displayName, roleValue, now, now).run();
				} else if (hasIsActive) {
					await stmt.bind(userId, email, email, passwordHash, displayName, now, now).run();
				} else if (hasRole) {
					await stmt.bind(userId, email, email, passwordHash, displayName, roleValue, now, now).run();
				} else {
					await stmt.bind(userId, email, email, passwordHash, displayName, now, now).run();
				}
			} else {
				const sql = hasIsActive
					? `
			INSERT INTO users (
				id,
				email,
				password_hash,
				display_name,
				${hasRole ? 'role,' : ''}
				is_active,
				created_at,
				updated_at
			)
			VALUES (?, ?, ?, ?, ${hasRole ? '?, ' : ''}1, ?, ?)
		`
					: `
			INSERT INTO users (
				id,
				email,
				password_hash,
				display_name,
				${hasRole ? 'role,' : ''}
				created_at,
				updated_at
			)
			VALUES (?, ?, ?, ?, ${hasRole ? '?, ' : ''}?, ?)
		`;
				const stmt = db.prepare(sql);
				if (hasIsActive && hasRole) {
					await stmt.bind(userId, email, passwordHash, displayName, roleValue, now, now).run();
				} else if (hasIsActive) {
					await stmt.bind(userId, email, passwordHash, displayName, now, now).run();
				} else if (hasRole) {
					await stmt.bind(userId, email, passwordHash, displayName, roleValue, now, now).run();
				} else {
					await stmt.bind(userId, email, passwordHash, displayName, now, now).run();
				}
			}

			registerPhase = 'user_preferences';
			await ensureUserPreferencesSchema(db);
			await ensureEmployeeProfilesTable(db);
			await db
				.prepare(
					`
			INSERT INTO user_preferences (user_id, email_updates, sms_updates, dark_mode, language, updated_at)
			VALUES (?, ?, 0, 0, 'en', ?)
			ON CONFLICT(user_id) DO UPDATE SET
				email_updates = excluded.email_updates,
				updated_at = excluded.updated_at
		`
				)
				.bind(userId, wantsEmailUpdates ? 1 : 0, now)
				.run();

			registerPhase = inviteCode ? 'accept_invite' : 'create_business';
			if (businessInvite) {
				await db
					.prepare(
						`
				UPDATE business_invites
				SET used_at = ?, used_by_user_id = ?
				WHERE id = ?
			`
					)
					.bind(now, userId, businessInvite.id)
					.run();
				await db
					.prepare(
						`
				INSERT INTO business_users (business_id, user_id, role, permission_template, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?)
			`
					)
					.bind(
						businessInvite.business_id,
						userId,
						invitedBusinessRole === 'user' ? 'staff' : invitedBusinessRole,
						businessInvite.permission_template || invitedBusinessRole || 'staff',
						now,
						now
					)
					.run();
				if (invitedBusinessRole !== 'owner') {
					await db
						.prepare(
							`
				INSERT INTO employee_employment_records (
					business_id,
					user_id,
					employment_status,
					employment_type,
					job_title,
					department,
					primary_schedule_department,
					hire_date,
					start_date,
					pay_type,
					manager_user_id,
					created_at,
					updated_at,
					updated_by
				)
				VALUES (?, ?, 'onboarding', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				ON CONFLICT(business_id, user_id) DO UPDATE SET
					employment_status = CASE
						WHEN employee_employment_records.employment_status = 'terminated' THEN employee_employment_records.employment_status
						ELSE 'onboarding'
					END,
					employment_type = excluded.employment_type,
					job_title = excluded.job_title,
					department = excluded.department,
					primary_schedule_department = excluded.primary_schedule_department,
					hire_date = excluded.hire_date,
					start_date = excluded.start_date,
					pay_type = excluded.pay_type,
					manager_user_id = excluded.manager_user_id,
					updated_at = excluded.updated_at,
					updated_by = excluded.updated_by
			`
						)
						.bind(
							businessInvite.business_id,
							userId,
							businessInvite.employment_type || 'employee',
							businessInvite.job_title || '',
							businessInvite.department || '',
							businessInvite.primary_schedule_department || businessInvite.department || '',
							businessInvite.start_date || '',
							businessInvite.start_date || '',
							businessInvite.pay_type || '',
							businessInvite.manager_user_id ?? null,
							now,
							now,
							businessInvite.manager_user_id ?? null
						)
						.run();

					const invitedDepartments = parseInviteDepartments(
						businessInvite.schedule_departments_json,
						businessInvite.primary_schedule_department || businessInvite.department || ''
					);
					if (invitedDepartments.length > 0) {
						await db.batch(
							invitedDepartments.map((department) =>
								db
									.prepare(
										`
					INSERT OR IGNORE INTO user_schedule_departments (
						user_id,
						department,
						updated_at,
						business_id
					)
					VALUES (?, ?, ?, ?)
				`
									)
									.bind(userId, department, now, businessInvite.business_id)
							)
						);
					}
				}
				resolvedBusinessId = businessInvite.business_id;
			} else if (invite) {
				await db
					.prepare(
						`
				UPDATE user_invites
				SET used_at = ?, used_by_user_id = ?
				WHERE id = ?
			`
				)
					.bind(now, userId, invite.id)
					.run();

				if (invite.invited_by) {
					const inviterBusiness = await db
						.prepare(
							`
					SELECT b.id AS business_id
					FROM business_users bu
					JOIN businesses b ON b.id = bu.business_id
					WHERE bu.user_id = ?
					  AND COALESCE(b.status, 'active') IN ('active', 'trialing')
					ORDER BY
					  CASE bu.role
					    WHEN 'owner' THEN 0
					    WHEN 'admin' THEN 1
					    WHEN 'general_manager' THEN 2
              WHEN 'manager' THEN 2
              WHEN 'foh_manager' THEN 3
              WHEN 'boh_manager' THEN 3
              WHEN 'hourly_manager' THEN 4
              ELSE 5
					  END ASC,
					  b.created_at ASC
					LIMIT 1
				`
						)
						.bind(invite.invited_by)
						.first<{ business_id: string }>();
					if (inviterBusiness?.business_id) {
						await db
							.prepare(
								`
						INSERT INTO business_users (business_id, user_id, role, permission_template, created_at, updated_at)
            VALUES (?, ?, 'staff', 'staff', ?, ?)
					`
							)
							.bind(inviterBusiness.business_id, userId, now, now)
							.run();
						resolvedBusinessId = inviterBusiness.business_id;
					}
				}
			} else {
				const businessId = crypto.randomUUID();
				const businessSlug = await reserveBusinessSlug(db, requestedBusinessSlug || businessName);
				const initialBusinessStatus = purchaseMode === 'buy_now' ? 'pending_payment' : 'trialing';
				await db
					.prepare(
						`
				INSERT INTO businesses (
					id,
					name,
					slug,
					plan_tier,
					status,
					legal_business_name,
					registry_id,
					contact_email,
					contact_phone,
					website_url,
					address_line_1,
					address_line_2,
					address_city,
					address_state,
					address_postal_code,
					address_country,
					addon_temp_monitoring,
					addon_camera_monitoring,
					created_at,
					updated_at
				)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`
					)
					.bind(
						businessId,
						businessName,
						businessSlug,
						planTier,
						initialBusinessStatus,
						legalName || null,
						registryId || null,
						contactEmail || null,
						contactPhone || null,
						websiteUrl || null,
						addressLine1 || null,
						addressLine2 || null,
						addressCity || null,
						addressState || null,
						addressPostalCode || null,
						addressCountry || null,
						addOnTempMonitoring ? 1 : 0,
						addOnCameraMonitoring ? 1 : 0,
						now,
						now
					)
					.run();
				await db
					.prepare(
						`
				INSERT INTO business_users (business_id, user_id, role, permission_template, created_at, updated_at)
        VALUES (?, ?, 'owner', 'owner', ?, ?)
			`
					)
					.bind(businessId, userId, now, now)
					.run();
				await db
					.prepare(
						`
				INSERT INTO employee_employment_records (
					business_id,
					user_id,
					employment_status,
					employment_type,
					job_title,
					department,
					primary_schedule_department,
					hire_date,
					start_date,
					pay_type,
					manager_user_id,
					created_at,
					updated_at,
					updated_by
				)
				VALUES (?, ?, 'active', 'owner', ?, '', '', '', '', '', NULL, ?, ?, ?)
				ON CONFLICT(business_id, user_id) DO UPDATE SET
					employment_status = CASE
						WHEN employee_employment_records.employment_status = 'terminated' THEN employee_employment_records.employment_status
						ELSE 'active'
					END,
					employment_type = 'owner',
					job_title = excluded.job_title,
					updated_at = excluded.updated_at,
					updated_by = excluded.updated_by
			`
					)
					.bind(businessId, userId, ownerTitle || 'Owner', now, now, userId)
					.run();
				resolvedBusinessId = businessId;
				await initializeBusinessTrial(db, {
					businessId,
					ownerUserId: userId,
					eligible: purchaseMode === 'buy_now' ? true : trialEligibility.eligible,
					denialReason: purchaseMode === 'buy_now' ? null : trialEligibility.reason,
					statusOverride: purchaseMode === 'buy_now' ? 'pending_payment' : null,
					identity: {
						emailNormalized: email,
						businessName,
						clientFingerprint,
						ipAddress: getRequestIpAddress(request),
						userAgent: request.headers.get('user-agent') ?? ''
					},
					now
				});
			}

			registerPhase = 'employee_profile';
			if (!resolvedBusinessId) {
				return registerFailure(
					400,
					'Could not attach this account to a workspace. Ask your admin for a fresh invite.',
					'security',
					submittedValues
				);
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
				real_name = excluded.real_name,
				phone = excluded.phone,
				birthday = excluded.birthday,
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
					resolvedBusinessId,
					userId,
					realName || '',
					userPhone || '',
					birthday || '',
					userAddressLine1 || '',
					userAddressLine2 || '',
					userCity || '',
					userState || '',
					userPostalCode || '',
					emergencyContactName || '',
					emergencyContactPhone || '',
					emergencyContactRelationship || '',
					now,
					userId
				)
				.run();

			if (businessInvite && businessInvite.onboarding_required === 1 && businessInvite.employment_type !== 'contractor') {
				await ensureEmployeeOnboardingRequirement(db, resolvedBusinessId, userId, null);
			}

			registerPhase = 'legal_agreement';
			if (!inviteCode) {
				await recordLegalAgreementAcceptance(db, {
					businessId: resolvedBusinessId,
					userId,
					agreementKey: LIABILITY_AGREEMENT_KEY,
					agreementVersion: LIABILITY_AGREEMENT_VERSION,
					acceptedAt: now,
					acceptanceSource: 'register',
					ipAddress: getRequestIpAddress(request),
					userAgent: request.headers.get('user-agent') ?? ''
				});
			}

			registerPhase = 'audit_success';
			await writeAuditLog(db, {
				action: inviteCode ? 'signup_completed_from_invite' : 'signup_completed_new_business',
				request,
				businessId: resolvedBusinessId,
				actorUserId: userId,
				targetUserId: userId,
				email
			});

			registerPhase = 'signup_confirmation_email';
			if (!inviteCode) {
				const emailResult = await sendSignupConfirmationEmail({
					env: platform?.env,
					origin: url.origin,
					ownerEmail: email,
					ownerName: displayName,
					ownerTitle: ownerTitle || 'Owner',
					businessName,
					planTier,
					purchaseMode
				});
				if (!emailResult.sent && !emailResult.skipped) {
					console.warn('Signup confirmation email was not sent:', emailResult.reason ?? 'unknown error');
				}
			}

			registerPhase = 'create_session';
			await createRegistrationSession({
				db,
				cookies,
				request,
				userId,
				businessId: resolvedBusinessId,
				now
			});

			registerPhase = 'billing_or_redirect';
			if (buyNowRequested) {
				await upsertStoreBillingPlaceholder(db, {
					businessId: resolvedBusinessId,
					ownerUserId: userId,
					preferredStore: safeStoreBillingPreference,
					planTier,
					addOnTempMonitoring,
					addOnCameraMonitoring,
					status: 'pending_setup',
					now
				});
				throw redirect(303, '/billing?purchase=pending');
			}

			throw redirect(303, '/app');
		} catch (err) {
			if (isRedirect(err)) {
				throw err;
			}
			const message = err instanceof Error ? err.message : String(err ?? '');
			console.error('Register action failed:', message);
			if (registerDb) {
				await writeAuditLogSafe(registerDb, {
					action: 'signup_failed_exception',
					request,
					email: registerEmail || null,
					metadata: {
						phase: registerPhase,
						message: message.slice(0, 240)
					}
				});
			}
			if (message.includes('UNIQUE constraint failed')) {
				return registerFailure(400, 'Account already exists.', 'security', submittedValues);
			}
			if (message.includes('D1_ERROR: no such table')) {
				return registerFailure(503, 'Database tables are not ready yet.', 'purchase', submittedValues);
			}
			return registerFailure(500, 'Registration failed. Please try again.', 'purchase', submittedValues);
		}
	}
};

export const load: PageServerLoad = async ({ url }) => {
	const inviteCode = String(url.searchParams.get('invite') || url.searchParams.get('code') || '')
		.trim()
		.toUpperCase();
	return {
		inviteCode: inviteCode || null,
		agreementVersion: LIABILITY_AGREEMENT_VERSION
	};
};
