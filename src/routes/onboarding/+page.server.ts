import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { ensureBusinessSchema, normalizeBusinessSlug, reserveBusinessSlug } from '$lib/server/business';
import {
	isValidScheduleDepartment,
	scheduleDepartments,
	scheduleRolesByDepartment,
	type ScheduleDepartment
} from '$lib/assets/schedule';
import { ensureScheduleSchema } from '$lib/server/schedules';
import { sendInviteEmail } from '$lib/server/email';

const PLAN_TIERS = new Set(['starter', 'growth', 'enterprise']);
const TEAM_ROLES = new Set(['manager', 'admin', 'staff']);
const TEMPLATE_KEYS = new Set(['full-operations', 'custom']);

const TEMPLATE_DEPARTMENTS: Record<string, ScheduleDepartment[]> = {
	'full-operations': [...scheduleDepartments]
};

type FormResponse = {
	error?: string;
	success?: boolean;
	section?: 'profile' | 'invite' | 'template' | 'complete';
	message?: string;
	inviteCode?: string;
};

function requireOwnerRole(locals: App.Locals) {
	if (locals.businessRole !== 'owner' && locals.businessRole !== 'admin') {
		throw redirect(303, '/app');
	}
}

function generateInviteCode() {
	return `INV-${crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
}

function normalizeEmail(value: string) {
	return value.trim().toLowerCase();
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

async function uniqueBusinessInviteCode(db: App.Platform['env']['DB']) {
	let code = generateInviteCode();
	let exists = true;
	while (exists) {
		const row = await db
			.prepare(
				`
        SELECT id
        FROM business_invites
        WHERE invite_code = ?
        LIMIT 1
        `
			)
			.bind(code)
			.first<{ id: string }>();
		if (!row?.id) {
			exists = false;
			break;
		}
		code = generateInviteCode();
	}
	return code;
}

function parseSelectedDepartments(form: FormData) {
	const templateRaw = String(form.get('template') ?? 'full-operations').trim().toLowerCase();
	const template = TEMPLATE_KEYS.has(templateRaw) ? templateRaw : 'full-operations';

	if (template !== 'custom') {
		return {
			template,
			departments: [...(TEMPLATE_DEPARTMENTS[template] ?? TEMPLATE_DEPARTMENTS['full-operations'])]
	};
}

	const picked = Array.from(
		new Set(
			form
				.getAll('departments')
				.map((value) => String(value ?? '').trim())
				.filter((value): value is ScheduleDepartment => isValidScheduleDepartment(value, scheduleDepartments))
		)
	);

	return {
		template,
		departments: picked
	};
}

async function upsertDepartmentTemplate(
	db: App.Platform['env']['DB'],
	selectedDepartments: ScheduleDepartment[]
) {
	const now = Math.floor(Date.now() / 1000);
	const selected = new Set(selectedDepartments);

	for (const [index, department] of scheduleDepartments.entries()) {
		const existing = await db
			.prepare(
				`
        SELECT id
        FROM schedule_departments
        WHERE LOWER(name) = LOWER(?)
        LIMIT 1
        `
			)
			.bind(department)
			.first<{ id: string }>();

		const isActive = selected.has(department) ? 1 : 0;
		if (existing?.id) {
			await db
				.prepare(
					`
          UPDATE schedule_departments
          SET name = ?, sort_order = ?, is_active = ?, updated_at = ?
          WHERE id = ?
          `
				)
				.bind(department, index, isActive, now, existing.id)
				.run();
		} else {
			await db
				.prepare(
					`
          INSERT INTO schedule_departments (
            id, name, sort_order, is_active, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?)
          `
				)
				.bind(crypto.randomUUID(), department, index, isActive, now, now)
				.run();
		}
	}

	for (const department of scheduleDepartments) {
		const roles = scheduleRolesByDepartment[department];
		for (const [index, roleName] of roles.entries()) {
			const existing = await db
				.prepare(
					`
          SELECT id
          FROM schedule_role_definitions
          WHERE LOWER(department) = LOWER(?)
            AND LOWER(role_name) = LOWER(?)
          LIMIT 1
          `
				)
				.bind(department, roleName)
				.first<{ id: string }>();

			const isActive = selected.has(department) ? 1 : 0;
			if (existing?.id) {
				await db
					.prepare(
						`
            UPDATE schedule_role_definitions
            SET department = ?, role_name = ?, sort_order = ?, is_active = ?, updated_at = ?
            WHERE id = ?
            `
					)
					.bind(department, roleName, index, isActive, now, existing.id)
					.run();
			} else {
				await db
					.prepare(
						`
            INSERT INTO schedule_role_definitions (
              id, department, role_name, sort_order, is_active, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            `
					)
					.bind(crypto.randomUUID(), department, roleName, index, isActive, now, now)
					.run();
			}
		}
	}
}

export const load: PageServerLoad = async ({ locals }) => {
	requireOwnerRole(locals);
	const db = locals.DB;
	if (!db || !locals.businessId) {
		throw redirect(303, '/app');
	}

	await ensureBusinessSchema(db);

	const [business, invitesResult, teamCountRow] = await Promise.all([
		db
			.prepare(
				`
      SELECT
        id,
        name,
        slug,
        plan_tier,
        onboarding_completed_at,
        onboarding_schedule_template,
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
        address_country
      FROM businesses
      WHERE id = ?
      LIMIT 1
      `
			)
			.bind(locals.businessId)
			.first<{
				id: string;
				name: string;
				slug: string;
				plan_tier: string;
				onboarding_completed_at: number | null;
				onboarding_schedule_template: string | null;
				legal_business_name: string | null;
				registry_id: string | null;
				contact_email: string | null;
				contact_phone: string | null;
				website_url: string | null;
				address_line_1: string | null;
				address_line_2: string | null;
				address_city: string | null;
				address_state: string | null;
				address_postal_code: string | null;
				address_country: string | null;
			}>(),
		db
			.prepare(
				`
      SELECT id, email, role, invite_code, created_at, expires_at
      FROM business_invites
      WHERE business_id = ?
        AND revoked_at IS NULL
        AND used_at IS NULL
      ORDER BY created_at DESC
      LIMIT 8
      `
			)
			.bind(locals.businessId)
			.all<{
				id: string;
				email: string;
				role: string;
				invite_code: string;
				created_at: number;
				expires_at: number | null;
			}>(),
		db
			.prepare(
				`
      SELECT COUNT(*) AS count
      FROM business_users
      WHERE business_id = ?
      `
			)
			.bind(locals.businessId)
			.first<{ count: number }>()
	]);

	if (!business) {
		throw redirect(303, '/app');
	}
	if (business.onboarding_completed_at) {
		throw redirect(303, '/app');
	}

	const invites = invitesResult.results ?? [];
	const teamCount = teamCountRow?.count ?? 1;
	const profileComplete = business.name.trim().length > 0 && business.slug.trim().length > 0;
	const inviteComplete = teamCount > 1 || invites.length > 0;
	const templateComplete = Boolean(business.onboarding_schedule_template);
	const completeReady = profileComplete && templateComplete;

	return {
		business: {
			id: business.id,
			name: business.name,
			slug: business.slug,
			planTier: business.plan_tier,
			template: business.onboarding_schedule_template,
			legalName: business.legal_business_name ?? '',
			registryId: business.registry_id ?? '',
			contactEmail: business.contact_email ?? '',
			contactPhone: business.contact_phone ?? '',
			websiteUrl: business.website_url ?? '',
			addressLine1: business.address_line_1 ?? '',
			addressLine2: business.address_line_2 ?? '',
			addressCity: business.address_city ?? '',
			addressState: business.address_state ?? '',
			addressPostalCode: business.address_postal_code ?? '',
			addressCountry: business.address_country ?? ''
		},
		invites: invites.map((invite) => ({
			id: invite.id,
			email: invite.email,
			role: invite.role,
			code: invite.invite_code,
			createdAt: invite.created_at,
			expiresAt: invite.expires_at
		})),
		teamCount,
		steps: {
			profileComplete,
			inviteComplete,
			templateComplete,
			completeReady
		}
	};
};

export const actions: Actions = {
	save_profile: async ({ request, locals }) => {
		requireOwnerRole(locals);
		const db = locals.DB;
		if (!db || !locals.businessId) {
			return fail(503, {
				error: 'Business workspace could not be loaded.',
				section: 'profile'
			} satisfies FormResponse);
		}

		await ensureBusinessSchema(db);
		const form = await request.formData();
		const currentBusiness = await db
			.prepare(
				`
        SELECT slug
        FROM businesses
        WHERE id = ?
        LIMIT 1
        `
			)
			.bind(locals.businessId)
			.first<{ slug: string }>();

		const businessName = String(form.get('business_name') ?? '').trim();
		const planTierRaw = String(form.get('plan_tier') ?? 'starter').trim().toLowerCase();
		const legalName = toOptionalString(form, 'legal_name', 120);
		const registryId = toOptionalString(form, 'registry_id', 80);
		const contactEmail = toOptionalString(form, 'contact_email', 120).toLowerCase();
		const contactPhone = toOptionalString(form, 'contact_phone', 48);
		const websiteRaw = toOptionalString(form, 'website_url', 180);
		const addressLine1 = toOptionalString(form, 'address_line_1', 120);
		const addressLine2 = toOptionalString(form, 'address_line_2', 120);
		const addressCity = toOptionalString(form, 'address_city', 80);
		const addressState = toOptionalString(form, 'address_state', 80);
		const addressPostalCode = toOptionalString(form, 'address_postal_code', 24);
		const addressCountry = toOptionalString(form, 'address_country', 80);

		if (!businessName) {
			return fail(400, {
				error: 'Business name is required.',
				section: 'profile'
			} satisfies FormResponse);
		}
		if (contactEmail && !looksLikeEmail(contactEmail)) {
			return fail(400, {
				error: 'Enter a valid business contact email.',
				section: 'profile'
			} satisfies FormResponse);
		}

		const websiteUrl = normalizeWebsite(websiteRaw);
		if (websiteRaw && !websiteUrl) {
			return fail(400, {
				error: 'Enter a valid website URL.',
				section: 'profile'
			} satisfies FormResponse);
		}

		const planTier = PLAN_TIERS.has(planTierRaw) ? planTierRaw : 'starter';
		const slugInput = currentBusiness?.slug || businessName;
		let businessSlug = normalizeBusinessSlug(slugInput);
		if (!businessSlug) {
			return fail(400, {
				error: 'Workspace address could not be prepared. Try a different business name.',
				section: 'profile'
			} satisfies FormResponse);
		}

		const existingBySlug = await db
			.prepare(
				`
        SELECT id
        FROM businesses
        WHERE slug = ?
        LIMIT 1
        `
			)
			.bind(businessSlug)
			.first<{ id: string }>();
		if (existingBySlug && existingBySlug.id !== locals.businessId) {
			businessSlug = await reserveBusinessSlug(db, businessSlug);
		}

		await db
			.prepare(
				`
        UPDATE businesses
        SET
          name = ?,
          slug = ?,
          plan_tier = ?,
          legal_business_name = ?,
          registry_id = ?,
          contact_email = ?,
          contact_phone = ?,
          website_url = ?,
          address_line_1 = ?,
          address_line_2 = ?,
          address_city = ?,
          address_state = ?,
          address_postal_code = ?,
          address_country = ?,
          updated_at = ?
        WHERE id = ?
        `
			)
			.bind(
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
				Math.floor(Date.now() / 1000),
				locals.businessId
			)
			.run();

		return {
			success: true,
			section: 'profile',
			message: 'Workspace profile saved.'
		} satisfies FormResponse;
	},

	invite_manager: async ({ request, locals, platform, url }) => {
		requireOwnerRole(locals);
		const db = locals.DB;
		if (!db || !locals.businessId || !locals.userId) {
			return fail(503, {
				error: 'Business workspace could not be loaded.',
				section: 'invite'
			} satisfies FormResponse);
		}

		await ensureBusinessSchema(db);
		const form = await request.formData();
		const email = normalizeEmail(String(form.get('email') ?? ''));
		const role = String(form.get('role') ?? 'manager').trim().toLowerCase();
		if (!email || !email.includes('@')) {
			return fail(400, {
				error: 'A valid email is required.',
				section: 'invite'
			} satisfies FormResponse);
		}
		if (!TEAM_ROLES.has(role)) {
			return fail(400, {
				error: 'Invalid team role selected.',
				section: 'invite'
			} satisfies FormResponse);
		}

		const alreadyMember = await db
			.prepare(
				`
        SELECT u.id
        FROM users u
        JOIN business_users bu ON bu.user_id = u.id
        WHERE bu.business_id = ?
          AND COALESCE(u.email_normalized, LOWER(u.email)) = ?
        LIMIT 1
        `
			)
			.bind(locals.businessId, email)
			.first<{ id: string }>();
		if (alreadyMember?.id) {
			return fail(400, {
				error: 'That person is already part of this business workspace.',
				section: 'invite'
			} satisfies FormResponse);
		}

		const existingInvite = await db
			.prepare(
				`
        SELECT id
        FROM business_invites
        WHERE business_id = ?
          AND email_normalized = ?
          AND revoked_at IS NULL
          AND used_at IS NULL
        LIMIT 1
        `
			)
			.bind(locals.businessId, email)
			.first<{ id: string }>();
		if (existingInvite?.id) {
			return fail(400, {
				error: 'An active invite already exists for this email.',
				section: 'invite'
			} satisfies FormResponse);
		}

		const now = Math.floor(Date.now() / 1000);
		const inviteCode = await uniqueBusinessInviteCode(db);
		const expiresAt = now + 60 * 60 * 24 * 14;
		await db
			.prepare(
				`
        INSERT INTO business_invites (
          id,
          business_id,
          email,
          email_normalized,
          invite_code,
          role,
          invited_by,
          created_at,
          expires_at,
          revoked_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
        `
			)
			.bind(
				crypto.randomUUID(),
				locals.businessId,
				email,
				email,
				inviteCode,
				role,
				locals.userId,
				now,
				expiresAt
			)
			.run();

		const emailResult = await sendInviteEmail({
			env: platform?.env,
			origin: url.origin,
			inviteeEmail: email,
			inviteCode,
			expiresAt
		});

		return {
			success: true,
			section: 'invite',
			inviteCode,
			message: emailResult.sent
				? `Invite sent to ${email}.`
				: `Invite created for ${email}. ${emailResult.reason ?? 'Email delivery skipped.'}`
		} satisfies FormResponse;
	},

	apply_template: async ({ request, locals }) => {
		requireOwnerRole(locals);
		const db = locals.DB;
		if (!db || !locals.businessId) {
			return fail(503, {
				error: 'Business workspace could not be loaded.',
				section: 'template'
			} satisfies FormResponse);
		}

		const form = await request.formData();
		const { template, departments } = parseSelectedDepartments(form);
		if (departments.length === 0) {
			return fail(400, {
				error: 'Select at least one department for your schedule template.',
				section: 'template'
			} satisfies FormResponse);
		}

		await ensureScheduleSchema(db);
		await upsertDepartmentTemplate(db, departments);
		await db
			.prepare(
				`
        UPDATE businesses
        SET onboarding_schedule_template = ?, updated_at = ?
        WHERE id = ?
        `
			)
			.bind(template, Math.floor(Date.now() / 1000), locals.businessId)
			.run();

		return {
			success: true,
			section: 'template',
			message: `Template applied with ${departments.length} department(s).`
		} satisfies FormResponse;
	},

	skip_template: async ({ locals }) => {
		requireOwnerRole(locals);
		const db = locals.DB;
		if (!db || !locals.businessId) {
			return fail(503, {
				error: 'Business workspace could not be loaded.',
				section: 'template'
			} satisfies FormResponse);
		}

		const departments = [...TEMPLATE_DEPARTMENTS['full-operations']];
		await ensureScheduleSchema(db);
		await upsertDepartmentTemplate(db, departments);
		await db
			.prepare(
				`
        UPDATE businesses
        SET onboarding_schedule_template = 'full-operations', updated_at = ?
        WHERE id = ?
        `
			)
			.bind(Math.floor(Date.now() / 1000), locals.businessId)
			.run();

		return {
			success: true,
			section: 'template',
			message: 'Applied recommended schedule setup.'
		} satisfies FormResponse;
	},

	complete_onboarding: async ({ locals }) => {
		requireOwnerRole(locals);
		const db = locals.DB;
		if (!db || !locals.businessId) {
			return fail(503, {
				error: 'Business workspace could not be loaded.',
				section: 'complete'
			} satisfies FormResponse);
		}

		await ensureBusinessSchema(db);
		const business = await db
			.prepare(
				`
        SELECT name, slug, onboarding_schedule_template
        FROM businesses
        WHERE id = ?
        LIMIT 1
        `
			)
			.bind(locals.businessId)
			.first<{
				name: string;
				slug: string;
				onboarding_schedule_template: string | null;
			}>();
		if (!business) {
			return fail(404, {
				error: 'Business workspace could not be found.',
				section: 'complete'
			} satisfies FormResponse);
		}

		const now = Math.floor(Date.now() / 1000);
		const businessName = business.name.trim() || 'My Kitchen Workspace';
		let businessSlug = business.slug.trim() || normalizeBusinessSlug(businessName);
		if (!businessSlug) {
			businessSlug = `workspace-${locals.businessId.slice(0, 8).toLowerCase()}`;
		}

		const existingBySlug = await db
			.prepare(
				`
        SELECT id
        FROM businesses
        WHERE slug = ?
        LIMIT 1
        `
			)
			.bind(businessSlug)
			.first<{ id: string }>();
		if (existingBySlug && existingBySlug.id !== locals.businessId) {
			businessSlug = await reserveBusinessSlug(db, businessSlug);
		}

		let scheduleTemplate = business.onboarding_schedule_template || 'full-operations';
		if (!business.onboarding_schedule_template) {
			await ensureScheduleSchema(db);
			await upsertDepartmentTemplate(db, [...TEMPLATE_DEPARTMENTS['full-operations']]);
		}

		await db
			.prepare(
				`
        UPDATE businesses
        SET
          name = ?,
          slug = ?,
          onboarding_schedule_template = ?,
          onboarding_completed_at = COALESCE(onboarding_completed_at, ?),
          updated_at = ?
        WHERE id = ?
        `
			)
			.bind(businessName, businessSlug, scheduleTemplate, now, now, locals.businessId)
			.run();

		throw redirect(303, '/app?onboarding=complete');
	}
};
