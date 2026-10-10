import type { Actions, PageServerLoad } from './$types';
import {
	createBusinessPosition,
	loadAdminUsers,
	loadEmployeeOnboardingDashboard,
	toggleBusinessPosition,
	updateBusinessPosition
} from '$lib/server/admin';
import { ensureDefaultBusinessPositions, loadBusinessPositions } from '$lib/server/business';
import { ALL_BUSINESS_CAPABILITIES, normalizeBusinessRole } from '$lib/server/permissions';
import { hasBusinessCapability } from '$lib/server/permissions';

const peopleViews = new Set(['overview', 'team', 'hr', 'access']);

export const load: PageServerLoad = async ({ locals, url }) => {
	const db = locals.DB;
	const requestedView = String(url.searchParams.get('view') ?? 'overview')
		.trim()
		.toLowerCase();
	const canReviewOnboarding = hasBusinessCapability(
		locals.businessRole,
		locals.businessPermissionTemplate,
		'review_onboarding',
		locals.businessCapabilities
	);
	const canManageOnboarding = hasBusinessCapability(
		locals.businessRole,
		locals.businessPermissionTemplate,
		'manage_onboarding',
		locals.businessCapabilities
	);
	const canViewSensitive = hasBusinessCapability(
		locals.businessRole,
		locals.businessPermissionTemplate,
		'view_sensitive_employee_data',
		locals.businessCapabilities
	);
	const canManagePermissions = hasBusinessCapability(
		locals.businessRole,
		locals.businessPermissionTemplate,
		'manage_permissions',
		locals.businessCapabilities
	);
	const actorIsOwner = normalizeBusinessRole(locals.businessRole) === 'owner';
	const canManageManagers =
		actorIsOwner ||
		hasBusinessCapability(
			locals.businessRole,
			locals.businessPermissionTemplate,
			'manage_managers',
			locals.businessCapabilities
		);
	const activeView = peopleViews.has(requestedView) ? requestedView : 'overview';
	const permittedView =
		(activeView === 'hr' && !canViewSensitive) || (activeView === 'access' && !canManagePermissions)
			? 'overview'
			: activeView;

	if (!db || !locals.businessId) {
		return {
			activeView: permittedView,
			users: [],
			positions: [],
			onboardingRows: [],
			expiringCertifications: [],
			pendingVerifications: [],
			pendingDocuments: [],
			canReviewOnboarding,
			canManageOnboarding,
			canViewSensitive,
			canManagePermissions,
			canManageManagers,
			actorIsOwner,
			actorPositionId: locals.businessPositionId ?? null,
			editableCapabilities: actorIsOwner
				? ALL_BUSINESS_CAPABILITIES
				: (locals.businessCapabilities ?? []).filter((capability) => capability !== 'manage_managers')
		};
	}

	if (canManagePermissions) await ensureDefaultBusinessPositions(db, locals.businessId, locals.userId ?? null);
	const users = await loadAdminUsers(db, locals.businessId);
	const positions = canManagePermissions
		? await loadBusinessPositions(db, locals.businessId, true)
		: [];
	const shouldLoadOnboarding =
		canReviewOnboarding && (permittedView === 'overview' || permittedView === 'hr');
	const onboardingRows = shouldLoadOnboarding
		? await loadEmployeeOnboardingDashboard(db, locals.businessId)
		: [];

	let expiringCertifications: Array<{
		id: string;
		user_id: string;
		employee_name: string | null;
		employee_email: string;
		title: string;
		expires_at: number | null;
		status: string;
	}> = [];
	let pendingVerifications: Array<{
		id: string;
		user_id: string;
		employee_name: string | null;
		employee_email: string;
		check_type: string;
		status: string;
	}> = [];
	let pendingDocuments: Array<{
		id: string;
		user_id: string;
		employee_name: string | null;
		employee_email: string;
		document_type: string;
		status: string;
		submitted_at: number | null;
	}> = [];

	if (permittedView === 'hr' && canViewSensitive) {
		const certificationCutoff = Math.floor(Date.now() / 1000) + 45 * 24 * 60 * 60;
		const [certifications, verifications, documents] = await Promise.all([
			db
				.prepare(
					`
          SELECT c.id, c.user_id, u.display_name AS employee_name, u.email AS employee_email,
            c.title, c.expires_at, c.status
          FROM employee_certifications c
          JOIN users u ON u.id = c.user_id
          WHERE c.business_id = ?
            AND c.expires_at IS NOT NULL
            AND c.expires_at <= ?
            AND c.status NOT IN ('expired', 'revoked')
          ORDER BY c.expires_at ASC
          LIMIT 50
          `
				)
				.bind(locals.businessId, certificationCutoff)
				.all<(typeof expiringCertifications)[number]>()
				.catch(() => ({ results: [] as typeof expiringCertifications })),
			db
				.prepare(
					`
          SELECT v.id, v.user_id, u.display_name AS employee_name, u.email AS employee_email,
            v.check_type, v.status
          FROM employee_verification_checks v
          JOIN users u ON u.id = v.user_id
          WHERE v.business_id = ?
            AND v.status NOT IN ('complete', 'completed', 'approved', 'clear')
          ORDER BY v.updated_at DESC
          LIMIT 50
          `
				)
				.bind(locals.businessId)
				.all<(typeof pendingVerifications)[number]>()
				.catch(() => ({ results: [] as typeof pendingVerifications })),
			db
				.prepare(
					`
          SELECT d.id, d.user_id, u.display_name AS employee_name, u.email AS employee_email,
            d.document_type, d.status, d.submitted_at
          FROM employee_compliance_documents d
          JOIN users u ON u.id = d.user_id
          WHERE d.business_id = ?
            AND d.status IN ('pending', 'submitted', 'needs_review', 'needs_changes')
          ORDER BY COALESCE(d.submitted_at, d.updated_at) DESC
          LIMIT 50
          `
				)
				.bind(locals.businessId)
				.all<(typeof pendingDocuments)[number]>()
				.catch(() => ({ results: [] as typeof pendingDocuments }))
		]);
		expiringCertifications = certifications.results ?? [];
		pendingVerifications = verifications.results ?? [];
		pendingDocuments = documents.results ?? [];
	}

	return {
		activeView: permittedView,
		users,
		positions,
		onboardingRows,
		expiringCertifications,
		pendingVerifications,
		pendingDocuments,
		canReviewOnboarding,
		canManageOnboarding,
		canViewSensitive,
		canManagePermissions,
		canManageManagers,
		actorIsOwner,
		actorPositionId: locals.businessPositionId ?? null,
		editableCapabilities: actorIsOwner
			? ALL_BUSINESS_CAPABILITIES
			: (locals.businessCapabilities ?? []).filter((capability) => capability !== 'manage_managers')
	};
};

export const actions: Actions = {
	create_position: ({ request, locals }) => createBusinessPosition(request, locals),
	update_position: ({ request, locals }) => updateBusinessPosition(request, locals),
	toggle_position: ({ request, locals }) => toggleBusinessPosition(request, locals)
};
