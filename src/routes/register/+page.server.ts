import { dev } from '$app/env';
import { fail, isRedirect, redirect, type Actions } from '@sveltejs/kit';
import { hashPassword } from '#lib/server/auth.ts';
import { getSessionCookieName, getSessionCookieOptions } from '#lib/server/authCookies.ts';
import {
	ACTIVE_BUSINESS_COOKIE,
	getActiveBusinessCookieOptions
} from '#lib/server/activeBusiness.ts';
import { hasColumn } from '#lib/server/dbSchema.ts';
import {
	ensureBusinessSchema,
	loadPositionCapabilityOverrides,
	reserveBusinessSlug
} from '#lib/server/business.ts';
import {
	ensureEmployeeProfilesTable
} from '#lib/server/admin.ts';
import {
	LIABILITY_AGREEMENT_VERSION,
	ensureLegalAgreementSchema
} from '#lib/server/legal.ts';
import {
	getBusinessTrialAccess,
	getRequestIpAddress,
	ensureTrialSchema
} from '#lib/server/trial.ts';
import { ensureStoreBillingPlaceholderSchema } from '#lib/server/storeBilling.ts';
import { validateNewPassword } from '#lib/server/passwordReset.ts';
import { checkRateLimit, writeAuditLog, writeAuditLogSafe } from '#lib/server/security.ts';
import { ensureUserPreferencesSchema } from '#lib/server/userPreferences.ts';
import {
	effectiveAppRoleFromBusinessRole,
	normalizeBusinessRole,
	resolveBusinessCapabilities
} from '#lib/server/permissions.ts';
import { sendSignupConfirmationEmail } from '#lib/server/email.ts';
import { normalizeFormText } from '#lib/server/inputSanitizer.ts';
import { recordOperationalEventBestEffort } from '#lib/server/operationalEvents.ts';
import { ensureScheduleSchema } from '#lib/server/schedules.ts';
import { prepareNewAccountRegistration, type NewAccountInvitation } from '#lib/server/registration.ts';
import { isSensitiveEncryptionConfigured } from '#lib/server/sensitive.ts';
import { logOperationalError } from '#lib/server/observability.ts';
import { isCalendarDate } from '#lib/timeZones.ts';
import { acceptExistingAccountInvitation, loadBusinessInvitation } from '#lib/server/businessInvitations.ts';
import type { PageServerLoad } from './$types';

type RegisterActiveSlideId = 'tier' | 'business' | 'security' | 'schedule' | 'purchase';

type RegistrationScheduleDepartment = {
	name: string;
	roles: string[];
};

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
	emailUpdates: boolean | null;
	smsUpdates: boolean | null;
	businessName: string;
	planTier: string;
	addOnTempMonitoring: boolean;
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
	menuTitle: string;
	scheduleSetup: string;
};

type RegistrationDocumentUpload = {
	title: string;
	slug: string;
	section: 'Docs' | 'Menu';
	category: 'General' | 'Menu';
	url: string;
};

const PLAN_TIER_MAP: Record<string, 'starter' | 'growth' | 'enterprise'> = {
	small: 'starter',
	medium: 'growth',
	large: 'enterprise',
	starter: 'starter',
	growth: 'growth',
	enterprise: 'enterprise'
};

async function hasEmailNormalizedColumn(db: App.RuntimeEnv['DB']) {
	return hasColumn(db, 'users', 'email_normalized');
}

async function hasIsActiveColumn(db: App.RuntimeEnv['DB']) {
	return hasColumn(db, 'users', 'is_active');
}

async function hasRoleColumn(db: App.RuntimeEnv['DB']) {
	return hasColumn(db, 'users', 'role');
}

async function cleanupRegistrationMedia(
  db: App.RuntimeEnv['DB'] | null,
  bucket: App.Locals['MEDIA_BUCKET'],
  keys: string[]
) {
  if (!db || !bucket || keys.length === 0) return;
  try {
    const byUrl = new Map(keys.map(key => [mediaUrlForKey(key), key]));
    const rows = await db.prepare(
      'SELECT value AS url FROM json_each(?) candidate WHERE NOT EXISTS ' +
      '(SELECT 1 FROM businesses WHERE sidebar_logo_url = candidate.value) AND NOT EXISTS ' +
      '(SELECT 1 FROM documents WHERE file_url = candidate.value)'
    ).bind(JSON.stringify([...byUrl.keys()])).all<{ url: string }>();
    const unreferenced = (rows.results ?? []).map(row => byUrl.get(row.url)!);
    if (unreferenced.length) await bucket.delete(unreferenced);
  } catch {
    // An ambiguous database result must never cause a committed upload to be deleted.
    logOperationalError({ event: 'registration_media_cleanup_failed', metadata: { phase: 'cleanup' } });
  }
}

function toOptionalString(form: FormData, key: string, maxLength: number) {
	return normalizeFormText(form, key, { maxLength });
}

function looksLikeEmail(value: string) {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parseRegistrationScheduleSetup(value: string): {
	departments: RegistrationScheduleDepartment[];
	error: string | null;
} {
	if (!value.trim()) return { departments: [], error: null };
	let parsed: unknown;
	try {
		parsed = JSON.parse(value);
	} catch {
		return { departments: [], error: 'Schedule setup could not be read. Review your departments and roles.' };
	}
	if (!Array.isArray(parsed) || parsed.length > 24) {
		return { departments: [], error: 'Add no more than 24 schedule departments.' };
	}

	const departments: RegistrationScheduleDepartment[] = [];
	const departmentNames = new Set<string>();
	for (const entry of parsed) {
		if (!entry || typeof entry !== 'object') {
			return { departments: [], error: 'Each schedule department needs a name and roles.' };
		}
		const raw = entry as { name?: unknown; roles?: unknown };
		const name = String(raw.name ?? '').trim().replace(/\s+/g, ' ');
		if (!name || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name)) {
			return { departments: [], error: 'Department names must be 1 to 80 readable characters.' };
		}
		const normalizedName = name.toLowerCase();
		if (departmentNames.has(normalizedName)) {
			return { departments: [], error: `The ${name} department is listed more than once.` };
		}
		departmentNames.add(normalizedName);

		const sourceRoles = Array.isArray(raw.roles) ? raw.roles : [];
		if (sourceRoles.length > 40) {
			return { departments: [], error: `Add no more than 40 roles to ${name}.` };
		}
		const roleNames = new Set<string>();
		const roles: string[] = [];
		for (const roleEntry of sourceRoles) {
			const role = String(roleEntry ?? '').trim().replace(/\s+/g, ' ');
			if (!role || role.length > 100 || /[\u0000-\u001f\u007f]/.test(role)) {
				return { departments: [], error: `Every ${name} role must be 1 to 100 readable characters.` };
			}
			const normalizedRole = role.toLowerCase();
			if (roleNames.has(normalizedRole)) {
				return { departments: [], error: `${role} is listed more than once in ${name}.` };
			}
			roleNames.add(normalizedRole);
			roles.push(role);
		}
		if (roles.length === 0) {
			return { departments: [], error: `Add at least one job role to ${name}, or skip schedule setup for now.` };
		}
		departments.push({ name, roles });
	}

	return { departments, error: null };
}

function isPublicSignupEnabled(env: App.RuntimeEnv | undefined) {
	return env?.PUBLIC_SIGNUP_ENABLED?.trim().toLowerCase() === 'true';
}

function isOwnerSignupAllowlisted(env: App.RuntimeEnv | undefined, email: string) {
	const normalizedEmail = email.trim().toLowerCase();
	if (!normalizedEmail) return false;
	const values = String(env?.OWNER_SIGNUP_ALLOWLIST ?? '')
		.split(',')
		.map((value) => value.trim().toLowerCase())
		.filter(Boolean);
	return values.includes(normalizedEmail);
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

function fileExtension(name: string) {
	const dot = name.trim().lastIndexOf('.');
	return dot > 0 ? name.trim().slice(dot + 1).toLowerCase() : '';
}

function isPdfUpload(file: File) {
	return file.type === 'application/pdf' && fileExtension(file.name) === 'pdf';
}

function isLogoUpload(file: File) {
	const extension = fileExtension(file.name);
	if (file.type === 'image/jpeg') return extension === 'jpg' || extension === 'jpeg';
	if (file.type === 'image/png') return extension === 'png';
	if (file.type === 'image/webp') return extension === 'webp';
	return false;
}

async function hasPdfSignature(file: File) {
	const bytes = new Uint8Array(await file.slice(0, 5).arrayBuffer());
	return bytes.length === 5 && String.fromCharCode(...bytes) === '%PDF-';
}

async function hasLogoSignature(file: File) {
	const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
	if (file.type === 'image/jpeg') {
		return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
	}
	if (file.type === 'image/png') {
		return bytes.length >= 8 && bytes.slice(0, 8).every((value, index) => value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index]);
	}
	if (file.type === 'image/webp') {
		return bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
	}
	return false;
}

function uploadTitle(file: File, fallback: string) {
	const withoutExtension = file.name.trim().replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
	return (withoutExtension || fallback).slice(0, 180);
}

function mediaUrlForKey(key: string) {
	return `/api/documents/media/${key
		.split('/')
		.map((part) => encodeURIComponent(part))
		.join('/')}`;
}

async function uploadRegistrationFile(
	bucket: NonNullable<App.Locals['MEDIA_BUCKET']>,
	key: string,
	file: File,
	cacheControl = 'private, max-age=0'
) {
	await bucket.put(key, await file.arrayBuffer(), {
		httpMetadata: {
			contentType: file.type || 'application/octet-stream',
			cacheControl
		}
	});
	return mediaUrlForKey(key);
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
	default: async ({ request, locals, url, cookies }) => {
		let submittedValues: Partial<RegisterFormValues> = {};
		let registerDb: App.RuntimeEnv['DB'] | null = null;
		let registerEmail = '';
		let registerPhase = 'start';
		let registrationCommitted = false;
		const registrationMediaKeys: string[] = [];
		try {
			registerPhase = 'read_form';
			const formData = await request.formData();
			if (formData.get('existing_account') === '1') {
				return await acceptExistingAccountInvitation({ request, locals, url, cookies }, formData);
			}

			const displayName = normalizeFormText(formData, 'display_name', { maxLength: 120 });
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
			const businessName = normalizeFormText(formData, 'business_name', { maxLength: 120 });
			const requestedBusinessSlug = String(formData.get('business_slug') || '').trim();
			const planTierRaw = String(formData.get('plan_tier') || 'starter').trim().toLowerCase();
			const planTier = PLAN_TIER_MAP[planTierRaw] ?? 'starter';
			const addOnTempMonitoring = false;
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
			const emailUpdatesResponse = String(formData.get('email_updates') ?? '').trim();
			const smsUpdatesResponse = String(formData.get('sms_updates') ?? '').trim();
			const wantsEmailUpdates = emailUpdatesResponse === '1';
			const wantsSmsUpdates = smsUpdatesResponse === '1';
			const purchaseModeRaw = String(formData.get('purchase_mode') || 'buy_now')
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
			const menuTitle = toOptionalString(formData, 'menu_title', 180);
			const scheduleSetupRaw = String(formData.get('schedule_setup') ?? '').trim();
			const scheduleSetup = parseRegistrationScheduleSetup(scheduleSetupRaw);
			const logoEntry = formData.get('business_logo');
			const businessLogo = logoEntry instanceof File && logoEntry.size > 0 ? logoEntry : null;
			const businessDocuments = formData
				.getAll('business_documents')
				.filter((entry): entry is File => entry instanceof File && entry.size > 0)
				.slice(0, 6);
			const menuEntry = formData.get('business_menu');
			const businessMenu = menuEntry instanceof File && menuEntry.size > 0 ? menuEntry : null;

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
				emailUpdates: emailUpdatesResponse ? wantsEmailUpdates : null,
				smsUpdates: smsUpdatesResponse ? wantsSmsUpdates : null,
				businessName,
				planTier: planTierRaw,
				addOnTempMonitoring,
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
				liabilityAgreementAccepted,
				menuTitle,
				scheduleSetup: scheduleSetupRaw
			};

			if (!email || !confirmEmail || !password || !confirmPassword) {
				return registerFailure(400, 'All fields required.', 'security', submittedValues);
			}
			if (!looksLikeEmail(email) || email.length > 254) {
				return registerFailure(400, 'Enter a valid email address.', 'security', submittedValues);
			}
			if (!['0', '1'].includes(emailUpdatesResponse) || !['0', '1'].includes(smsUpdatesResponse)) {
				return registerFailure(400, 'Choose Yes or No for both notification options.', 'security', submittedValues);
			}
			if (wantsSmsUpdates && !userPhone) {
				return registerFailure(400, 'Enter a phone number to allow text notifications.', 'security', submittedValues);
			}
			const accountDisplayName =
				displayName || realName || email.split('@')[0]?.slice(0, 120) || 'Owner';
			if (
				inviteCode &&
				(!realName || !birthday || !userPhone || !userAddressLine1 || !userCity || !userState || !userPostalCode)
			) {
				return registerFailure(400, 'Complete your personal information to continue.', 'security', submittedValues);
			}
			if (!inviteCode && !businessName) {
				return registerFailure(400, 'Business name is required to create your workspace.', 'business', submittedValues);
			}
			if (!inviteCode && scheduleSetup.error) {
				return registerFailure(400, scheduleSetup.error, 'schedule', submittedValues);
			}
			if (email !== confirmEmail) {
				return registerFailure(400, 'Emails do not match.', 'security', submittedValues);
			}
			const passwordError = validateNewPassword(password, confirmPassword);
			if (passwordError) {
				return registerFailure(400, String(passwordError.data?.error ?? 'Enter a valid password.'), 'security', submittedValues);
			}
			if (birthday && !isCalendarDate(birthday)) {
				return registerFailure(400, 'Birthday must use a valid date.', 'security', submittedValues);
			}
			if (contactEmail && !looksLikeEmail(contactEmail)) {
				return registerFailure(400, 'Enter a valid business contact email.', 'business', submittedValues);
			}
			if (!inviteCode && !liabilityAgreementAccepted) {
				return registerFailure(400, 'You must accept the Terms and Billing Terms to continue.', 'purchase', submittedValues);
			}
			if (!inviteCode && purchaseMode !== 'buy_now') {
				return registerFailure(403, 'Trial signup is not available right now. Choose purchase to continue.', 'purchase', {
					...submittedValues,
					purchaseMode: 'buy_now'
				});
			}
			if (!inviteCode && !dev && !isPublicSignupEnabled(locals.env) && !isOwnerSignupAllowlisted(locals.env, email)) {
				return registerFailure(403, 'Public signup is not available right now.', 'security', submittedValues);
			}
			if (!inviteCode && liabilityAgreementVersion && liabilityAgreementVersion !== LIABILITY_AGREEMENT_VERSION) {
				return registerFailure(400, 'Please refresh and accept the latest Terms and Billing Terms.', 'purchase', submittedValues);
			}
			if (
				!inviteCode &&
				businessLogo &&
				(businessLogo.size > 5 * 1024 * 1024 ||
					!isLogoUpload(businessLogo) ||
					!(await hasLogoSignature(businessLogo)))
			) {
				return registerFailure(
					400,
					'Business logo must be a valid JPG, PNG, or WebP file under 5MB.',
					'business',
					submittedValues
				);
			}
			const invalidBusinessDocument =
				!inviteCode && businessDocuments.length > 0
					? (
							await Promise.all(
								businessDocuments.map(async (file) =>
									file.size > 15 * 1024 * 1024 || !isPdfUpload(file) || !(await hasPdfSignature(file))
								)
							)
						).some(Boolean)
					: false;
			if (invalidBusinessDocument) {
				return registerFailure(400, 'Business documents must be PDFs under 15MB each.', 'business', submittedValues);
			}
			if (
				!inviteCode &&
				businessMenu &&
				(businessMenu.size > 15 * 1024 * 1024 ||
					!isPdfUpload(businessMenu) ||
					!(await hasPdfSignature(businessMenu)))
			) {
				return registerFailure(400, 'Menu upload must be a PDF under 15MB.', 'business', submittedValues);
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
			await ensureBusinessSchema(db);
			await ensureScheduleSchema(db);

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
			registerPhase = 'invite_lookup';

			const businessInvite = inviteCode ? await db.prepare(
        'SELECT id, business_id, email_normalized, role, permission_template, position_id, employment_type, ' +
        'job_title, department, primary_schedule_department, schedule_departments_json, start_date, pay_type, ' +
        'manager_user_id, onboarding_required, expires_at, revoked_at, used_at FROM business_invites WHERE invite_code = ? LIMIT 1'
      ).bind(inviteCode).first<NewAccountInvitation & { expires_at: number | null; revoked_at: number | null; used_at: number | null }>() : null;
      if (inviteCode) {
        if (!businessInvite || businessInvite.revoked_at !== null || businessInvite.used_at !== null) {
          return registerFailure(400, 'This invitation is unavailable. Ask your manager for a fresh restaurant invitation.', 'security', submittedValues);
        }
        if (businessInvite.email_normalized !== email) {
          return registerFailure(400, 'This invitation does not match your email address.', 'security', submittedValues);
        }
        if (businessInvite.expires_at !== null && businessInvite.expires_at < now) {
          return registerFailure(400, 'This invitation has expired. Ask your manager for a fresh invitation.', 'security', submittedValues);
        }
        const access = await getBusinessTrialAccess(db, businessInvite.business_id, now);
        if (access.mode !== 'active' || !access.allowApp) {
          return registerFailure(403, 'This workspace is not active yet.', 'security', submittedValues);
        }
        if (businessInvite.onboarding_required === 1 && businessInvite.employment_type !== 'contractor' && !isSensitiveEncryptionConfigured(locals.env)) {
          return registerFailure(503, 'Onboarding is temporarily unavailable. Please try again shortly.', 'security', submittedValues);
        }
      }

			const newBusinessId = inviteCode ? null : crypto.randomUUID();
			let uploadedBusinessLogoUrl: string | null = null;
			const uploadedBusinessDocuments: RegistrationDocumentUpload[] = [];

			if (newBusinessId && (businessLogo || businessDocuments.length > 0 || businessMenu)) {
				registerPhase = 'registration_media';
				if (!locals.MEDIA_BUCKET) {
					return registerFailure(503, 'File uploads are temporarily unavailable. Skip uploads or try again shortly.', 'business', submittedValues);
				}

				if (businessLogo) {
					const extension = fileExtension(businessLogo.name) || 'jpg';
					const key = `businesses/${newBusinessId}/branding/sidebar-logo-${crypto.randomUUID()}.${extension}`;
					registrationMediaKeys.push(key);
					uploadedBusinessLogoUrl = await uploadRegistrationFile(
						locals.MEDIA_BUCKET,
						key,
						businessLogo,
						'public, max-age=31536000, immutable'
					);
				}

				for (const document of businessDocuments) {
					const slug = `setup-${newBusinessId.slice(0, 8)}-${crypto.randomUUID().slice(0, 12)}`;
					const key = `businesses/${newBusinessId}/documents/${slug}/${crypto.randomUUID()}.pdf`;
					registrationMediaKeys.push(key);
					const uploadedUrl = await uploadRegistrationFile(locals.MEDIA_BUCKET, key, document);
					uploadedBusinessDocuments.push({
						title: uploadTitle(document, 'Business document'),
						slug,
						section: 'Docs',
						category: 'General',
						url: uploadedUrl
					});
				}

				if (businessMenu) {
					const slug = `menu-${newBusinessId.slice(0, 8)}-${crypto.randomUUID().slice(0, 12)}`;
					const key = `businesses/${newBusinessId}/documents/${slug}/${crypto.randomUUID()}.pdf`;
					registrationMediaKeys.push(key);
					const uploadedUrl = await uploadRegistrationFile(locals.MEDIA_BUCKET, key, businessMenu);
					uploadedBusinessDocuments.push({
						title: menuTitle || uploadTitle(businessMenu, 'Menu'),
						slug,
						section: 'Menu',
						category: 'Menu',
						url: uploadedUrl
					});
				}
			}

			registerPhase = 'password_hash';
			const userId = crypto.randomUUID();
			const passwordHash = await hashPassword(password, locals.env);

			registerPhase = 'prepare_registration';
      await ensureUserPreferencesSchema(db);
      await ensureEmployeeProfilesTable(db);
      if (!inviteCode) {
        await ensureLegalAgreementSchema(db);
        await ensureTrialSchema(db);
        await ensureStoreBillingPlaceholderSchema(db);
      }
      const invitedBusinessRole = normalizeBusinessRole(businessInvite?.role ?? '');
      const invitedPositionOverrides = businessInvite?.position_id
        ? await loadPositionCapabilityOverrides(db, businessInvite.business_id, businessInvite.position_id) : {};
      const roleValue = businessInvite ? effectiveAppRoleFromBusinessRole(invitedBusinessRole,
        businessInvite.permission_template, resolveBusinessCapabilities(invitedBusinessRole,
          businessInvite.permission_template, {}, invitedPositionOverrides)) : 'admin';
      const plan = await prepareNewAccountRegistration(db, {
        userId, email, passwordHash, displayName: accountDisplayName, appRole: roleValue,
        userColumns: { normalized: hasNormalized, active: hasIsActive, role: hasRole },
        profile: { user_id: userId, real_name: realName || accountDisplayName, phone: userPhone || '',
          birthday: birthday || '', address_line_1: userAddressLine1 || '', address_line_2: userAddressLine2 || '',
          city: userCity || '', state: userState || '', postal_code: userPostalCode || '',
          emergency_contact_name: emergencyContactName || '', emergency_contact_phone: emergencyContactPhone || '',
          emergency_contact_relationship: emergencyContactRelationship || '' },
        emailUpdates: wantsEmailUpdates, smsUpdates: wantsSmsUpdates, invitation: businessInvite, inviteCode,
        business: newBusinessId ? { id: newBusinessId, name: businessName,
          slug: await reserveBusinessSlug(db, requestedBusinessSlug || businessName), planTier,
          logoUrl: uploadedBusinessLogoUrl, documents: uploadedBusinessDocuments, departments: scheduleSetup.departments,
          legalName, registryId, contactEmail, contactPhone, websiteUrl, addressLine1, addressLine2, addressCity,
          addressState, addressPostalCode, addressCountry, addOnTempMonitoring, ownerTitle,
          storeBillingPreference: safeStoreBillingPreference } : null,
        request, env: locals.env, now
      });
      registerPhase = 'commit_registration';
      let committed = false;
      try {
        const result = await db.batch(plan.statements);
        committed = Number(result[0]?.meta?.changes ?? 0) === 1;
      } catch (error) {
        // A lost commit response is not a failed registration when its exact audit and session exist.
        const recovered = await db.prepare(`SELECT 1 FROM account_audit_logs a
          JOIN sessions s ON s.id = ? AND s.user_id = a.actor_user_id
          WHERE a.id = ? AND a.actor_user_id = ? AND a.target_user_id = ? AND a.business_id = ?`)
          .bind(plan.sessionId, plan.auditId, userId, userId, plan.businessId).first();
        if (!recovered) throw error;
        committed = true;
      }
      if (!committed) {
        await cleanupRegistrationMedia(db, locals.MEDIA_BUCKET, registrationMediaKeys);
        return registerFailure(409, 'Registration changed. Refresh and try again, or sign in if your account was created.', 'security', submittedValues);
      }
      registrationCommitted = true;
      const resolvedBusinessId = plan.businessId;
      cookies.set(getSessionCookieName(), plan.sessionToken, getSessionCookieOptions(request));
      cookies.set(ACTIVE_BUSINESS_COOKIE, resolvedBusinessId, getActiveBusinessCookieOptions(request));
      cookies.delete('session_id', { path: '/' });
      cookies.delete('session_id_pwa', { path: '/' });

      registerPhase = 'post_commit_notifications';
      try {
        if (plan.packageId) {
          await recordOperationalEventBestEffort(db, { businessId: resolvedBusinessId,
            eventType: 'onboarding.package.sent', category: 'onboarding', targetUserId: userId,
            subjectType: 'employee_onboarding_package', subjectId: plan.packageId, title: 'Onboarding package ready' }, request);
        }
        if (!inviteCode) {
          await sendSignupConfirmationEmail({ env: locals.env, origin: url.origin, ownerEmail: email,
            ownerName: accountDisplayName, ownerTitle: ownerTitle || 'Owner', businessName, planTier });
        }
      } catch {
        logOperationalError({ event: 'registration_notification_failed', businessId: resolvedBusinessId,
          userId, metadata: { phase: 'post_commit' } });
      }
      if (buyNowRequested) throw redirect(303, '/billing?purchase=pending');

			throw redirect(
				303,
				inviteCode
					? `/register/welcome?onboarding=${plan.packageId ? '1' : '0'}`
					: '/welcome/admin'
			);
		} catch (err) {
			if (!registrationCommitted && registrationMediaKeys.length > 0 && locals.MEDIA_BUCKET) {
				await cleanupRegistrationMedia(registerDb, locals.MEDIA_BUCKET, registrationMediaKeys);
			}
			if (isRedirect(err)) {
				throw err;
			}
			const message = err instanceof Error ? err.message : String(err ?? '');
			logOperationalError({ event: 'registration_failed', request, metadata: { phase: registerPhase } });
			if (registrationCommitted) throw redirect(303, '/login');
			if (registerDb) {
				await writeAuditLogSafe(registerDb, {
					action: 'signup_failed_exception',
					request,
					email: registerEmail || null,
					metadata: {
						phase: registerPhase
					}
				});
			}
			if (/UNIQUE constraint failed: users\.(?:email_normalized|email)\b/.test(message)) {
				return registerFailure(400, 'Account already exists.', 'security', submittedValues);
			}
			if (message.includes('D1_ERROR: no such table')) {
				return registerFailure(503, 'Database tables are not ready yet.', 'purchase', submittedValues);
			}
			return registerFailure(503, 'Registration could not be saved. Please try again.', 'security', submittedValues);
		}
	}
};

export const load: PageServerLoad = async ({ url, locals }) => {
	const inviteCode = String(url.searchParams.get('invite') || url.searchParams.get('code') || '')
		.trim()
		.toUpperCase();
	let onboardingRequired = false;
	let inviteEmail = '';
	if (inviteCode && locals.env.DB) {
		const now = Math.floor(Date.now() / 1000);
		const invite = await locals.env.DB.prepare(
			`
			SELECT onboarding_required, email_normalized
			FROM business_invites
			WHERE invite_code = ?
			  AND revoked_at IS NULL
			  AND used_at IS NULL
			  AND (expires_at IS NULL OR expires_at >= ?)
			LIMIT 1
			`
		)
			.bind(inviteCode, now)
			.first<{ onboarding_required: number; email_normalized: string }>();
		onboardingRequired = invite?.onboarding_required === 1;
		inviteEmail = String(invite?.email_normalized ?? '').trim().toLowerCase();

	}
	let existingInviteAccount = false;
	let canAcceptInvite = false;
	let invitationBusinessName = '';
	const acceptedInvitation = inviteCode && locals.DB && locals.userId
		? await locals.DB.prepare(`SELECT b.id AS businessId, b.name AS businessName
			FROM business_invites i JOIN businesses b ON b.id = i.business_id
			JOIN business_users m ON m.business_id = i.business_id AND m.user_id = i.used_by_user_id AND m.is_active = 1
			WHERE i.invite_code = ? AND i.used_by_user_id = ? AND i.used_at IS NOT NULL LIMIT 1`)
			.bind(inviteCode, locals.userId).first<{ businessId: string; businessName: string }>()
		: null;
	if (inviteEmail && locals.DB) {
		const account = await locals.DB.prepare('SELECT id, is_active FROM users WHERE email_normalized = ? LIMIT 1')
			.bind(inviteEmail).first<{ id: string; is_active: number }>();
		existingInviteAccount = Boolean(account);
		canAcceptInvite = Boolean(account && account.is_active === 1 && account.id === locals.userId);
		const invitation = await loadBusinessInvitation(locals.DB, inviteCode);
		invitationBusinessName = invitation?.business_name ?? '';
	}
	return {
		inviteCode: inviteCode || null,
		inviteEmail: inviteEmail || null,
		existingInviteAccount,
		canAcceptInvite,
		invitationBusinessName,
		acceptedInvitation,
		onboardingRequired,
		agreementVersion: LIABILITY_AGREEMENT_VERSION
	};
};
