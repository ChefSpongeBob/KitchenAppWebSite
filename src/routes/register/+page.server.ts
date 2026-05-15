import { dev } from '$app/environment';
import { fail, isRedirect, redirect, type Actions } from '@sveltejs/kit';
import { hashPassword } from '$lib/server/auth';
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
import { checkRateLimit, rateLimitFailure, writeAuditLog } from '$lib/server/security';
import type { PageServerLoad } from './$types';

const PLAN_TIER_MAP: Record<string, 'starter' | 'growth' | 'enterprise'> = {
	small: 'starter',
	medium: 'growth',
	large: 'enterprise',
	starter: 'starter',
	growth: 'growth',
	enterprise: 'enterprise'
};

async function hasEmailNormalizedColumn(db: App.Platform['env']['DB']) {
	return hasColumn(db, 'users', 'email_normalized');
}

async function hasIsActiveColumn(db: App.Platform['env']['DB']) {
	return hasColumn(db, 'users', 'is_active');
}

async function hasRoleColumn(db: App.Platform['env']['DB']) {
	return hasColumn(db, 'users', 'role');
}

async function ensureUserPreferencesTable(db: App.Platform['env']['DB']) {
	if (!dev) return;

	await db.prepare(`
		CREATE TABLE IF NOT EXISTS user_preferences (
			user_id TEXT PRIMARY KEY,
			email_updates INTEGER NOT NULL DEFAULT 1,
			updated_at INTEGER NOT NULL,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		)
	`).run();
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

export const actions: Actions = {
	default: async ({ request, locals, url }) => {
		try {
			const formData = await request.formData();

			const displayName = String(formData.get('display_name') || '').trim();
			const email = String(formData.get('email') || '').trim().toLowerCase();
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
			const addOnTempMonitoring = String(formData.get('addon_temp_monitoring') || '0') === '1';
			const addOnCameraMonitoring = String(formData.get('addon_camera_monitoring') || '0') === '1';
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
			const liabilityAgreementAccepted =
				String(formData.get('liability_agreement_accepted') || '0') === '1';
			const liabilityAgreementVersion = String(formData.get('liability_agreement_version') || '')
				.trim()
				.slice(0, 32);

			if (!displayName || !email || !confirmEmail || !password || !confirmPassword) {
				return fail(400, { error: 'All fields required.' });
			}
			if (!inviteCode && !businessName) {
				return fail(400, { error: 'Business name is required to create your workspace.' });
			}
			if (email !== confirmEmail) {
				return fail(400, { error: 'Emails do not match.' });
			}
			const passwordError = validateNewPassword(password, confirmPassword);
			if (passwordError) return passwordError;
			if (birthday && !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
				return fail(400, { error: 'Birthday must use a valid date.' });
			}
			if (contactEmail && !looksLikeEmail(contactEmail)) {
				return fail(400, { error: 'Enter a valid business contact email.' });
			}
			if (!liabilityAgreementAccepted) {
				return fail(400, { error: 'You must accept the liability agreement to continue.' });
			}
			if (liabilityAgreementVersion && liabilityAgreementVersion !== LIABILITY_AGREEMENT_VERSION) {
				return fail(400, { error: 'Please refresh and accept the latest liability agreement.' });
			}

			const websiteUrl = normalizeWebsite(websiteRaw);
			if (websiteRaw && !websiteUrl) {
				return fail(400, { error: 'Enter a valid business website URL.' });
			}

			const planTier = PLAN_TIER_MAP[planTierRaw] ?? 'starter';

			const db = locals.DB;
			if (!db) {
				return fail(503, { error: 'Database is not configured yet.' });
			}
			const buyNowRequested = !inviteCode && purchaseMode === 'buy_now';

			await ensureUserInvitesTable(db);
			await ensureBusinessSchema(db);

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
				return rateLimitFailure();
			}

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
				return fail(400, { error: 'Account already exists.' });
			}

			const now = Math.floor(Date.now() / 1000);
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
					return fail(400, { error: 'Free trial unavailable. Choose purchase to continue.' });
				}
			}

			let businessInvite:
				| {
						id: string;
						business_id: string;
						email_normalized: string;
						role: string;
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
				SELECT id, business_id, email_normalized, role, expires_at, revoked_at, used_at
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
						expires_at: number | null;
						revoked_at: number | null;
						used_at: number | null;
					}>();

				if (businessInvite) {
					if (businessInvite.revoked_at !== null || businessInvite.used_at !== null) {
						return fail(400, { error: 'Invite code is invalid.' });
					}

					if (businessInvite.email_normalized !== email) {
						return fail(400, { error: 'Invite code does not match this email address.' });
					}

					if (businessInvite.expires_at !== null && businessInvite.expires_at < now) {
						return fail(400, { error: 'Invite code has expired.' });
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
						return fail(400, { error: 'Invite code is invalid.' });
					}

					if (invite.email_normalized !== email) {
						return fail(400, { error: 'Invite code does not match this email address.' });
					}

					if (invite.expires_at !== null && invite.expires_at < now) {
						return fail(400, { error: 'Invite code has expired.' });
					}
				}
			}

			const userId = crypto.randomUUID();
			const passwordHash = await hashPassword(password);
			let resolvedBusinessId: string | null = null;

			const invitedBusinessRole = String(businessInvite?.role ?? '').toLowerCase();
			const roleValue = inviteCode
				? invitedBusinessRole === 'admin' || invitedBusinessRole === 'manager'
					? 'admin'
					: 'user'
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

			await ensureUserPreferencesTable(db);
			await ensureEmployeeProfilesTable(db);
			await db
				.prepare(
					`
			INSERT OR REPLACE INTO user_preferences (user_id, email_updates, updated_at)
			VALUES (?, ?, ?)
		`
				)
				.bind(userId, wantsEmailUpdates ? 1 : 0, now)
				.run();

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
				INSERT INTO business_users (business_id, user_id, role, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?)
			`
					)
					.bind(
						businessInvite.business_id,
						userId,
						invitedBusinessRole && invitedBusinessRole !== 'admin' && invitedBusinessRole !== 'manager'
							? 'staff'
							: invitedBusinessRole || 'staff',
						now,
						now
					)
					.run();
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
					    WHEN 'manager' THEN 2
					    ELSE 3
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
						INSERT INTO business_users (business_id, user_id, role, created_at, updated_at)
						VALUES (?, ?, 'staff', ?, ?)
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
				VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`
					)
					.bind(
						businessId,
						businessName,
						businessSlug,
						planTier,
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
				INSERT INTO business_users (business_id, user_id, role, created_at, updated_at)
				VALUES (?, ?, 'owner', ?, ?)
			`
					)
					.bind(businessId, userId, now, now)
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

			if (!resolvedBusinessId) {
				return fail(400, {
					error: 'Could not attach this account to a workspace. Ask your admin for a fresh invite.'
				});
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

			if (inviteCode && roleValue !== 'admin') {
				await ensureEmployeeOnboardingRequirement(db, resolvedBusinessId, userId, null);
			}

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

			await writeAuditLog(db, {
				action: inviteCode ? 'signup_completed_from_invite' : 'signup_completed_new_business',
				request,
				businessId: resolvedBusinessId,
				actorUserId: userId,
				targetUserId: userId,
				email
			});

			if (buyNowRequested) {
				await upsertStoreBillingPlaceholder(db, {
					businessId: resolvedBusinessId,
					ownerUserId: userId,
					preferredStore: storeBillingPreference,
					planTier,
					addOnTempMonitoring,
					addOnCameraMonitoring,
					status: 'pending_setup',
					now
				});
				throw redirect(303, '/login?registered=success&purchase=pending');
			}

			throw redirect(303, '/login?registered=success');
		} catch (err) {
			if (isRedirect(err)) {
				throw err;
			}
			const message = err instanceof Error ? err.message : String(err ?? '');
			console.error('Register action failed:', message);
			if (message.includes('UNIQUE constraint failed')) {
				return fail(400, { error: 'Account already exists.' });
			}
			if (message.includes('D1_ERROR: no such table')) {
				return fail(503, { error: 'Database tables are not ready yet.' });
			}
			return fail(500, { error: 'Registration failed. Please try again.' });
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
