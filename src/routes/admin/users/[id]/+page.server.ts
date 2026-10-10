import type { Actions, PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import {
	approveEmployeeOnboardingPackage,
	addEmployeeCertification,
	addEmployeeVerificationCheck,
	deleteEmployeeCertification,
	deleteUser,
	loadAdminEmployeeProfile,
	loadAdminUsers,
	loadBusinessHrSettings,
	loadEmployeeEmploymentRecord,
	loadEmployeeHrPosAccess,
	loadEmployeeOnboarding,
	returnEmployeeOnboardingPackage,
	saveEmployeePosPermissions,
	sendEmployeeOnboardingPackage,
	toggleEmployeeHrAccess,
	toggleScheduleDepartmentApproval,
	updateEmployeeEmploymentRecord,
	updateEmployeeVerificationCheck,
	updateUserBusinessPermissions,
	updateUserCapabilityOverrides,
	verifyEmployeeI9
} from '$lib/server/admin';
import { ensureDefaultBusinessPositions, loadBusinessPositions } from '$lib/server/business';
import {
	loadScheduleDepartments,
	loadScheduleRoleAccessByUser,
	loadScheduleRoleDefinitions,
	saveUserScheduleRoleAccess
} from '$lib/server/schedules';
import { canAccessEmployeeSensitiveData } from '$lib/server/sensitive';
import {
	ALL_BUSINESS_CAPABILITIES,
	hasBusinessCapability,
	normalizeBusinessRole
} from '$lib/server/permissions';

const employeeSections = [
	'profile',
	'employment',
	'onboarding',
	'documents',
	'access',
	'activity'
] as const;
type EmployeeSection = (typeof employeeSections)[number];

export const load: PageServerLoad = async ({ locals, params, platform, url }) => {
	const db = locals.DB;
	const businessId = locals.businessId;
	if (!db) throw error(503, 'Database not configured.');
	if (!businessId) throw error(404, 'Employee not found.');

	const users = await loadAdminUsers(db, businessId);
	const employee = users.find((user) => user.id === params.id);
	if (!employee) throw error(404, 'Employee not found.');

	const canManagePeople = hasBusinessCapability(
		locals.businessRole,
		locals.businessPermissionTemplate,
		'manage_people',
		locals.businessCapabilities
	);
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
	const canManagePermissions = hasBusinessCapability(
		locals.businessRole,
		locals.businessPermissionTemplate,
		'manage_permissions',
		locals.businessCapabilities
	);
	const canManageScheduleAssignments = hasBusinessCapability(
		locals.businessRole,
		locals.businessPermissionTemplate,
		'manage_schedule',
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
	const canReadSensitiveProfile = await canAccessEmployeeSensitiveData(
		db,
		businessId,
		locals.userId,
		locals.businessRole,
		employee.id,
		locals.businessPermissionTemplate,
		locals.businessCapabilities
	);

	const requestedSection = (url.searchParams.get('section') ?? 'profile').trim() as EmployeeSection;
	let activeSection: EmployeeSection = employeeSections.includes(requestedSection)
		? requestedSection
		: 'profile';
	if (activeSection === 'onboarding' && !canReviewOnboarding) activeSection = 'profile';
	if ((activeSection === 'documents' || activeSection === 'activity') && !canReadSensitiveProfile) {
		activeSection = 'profile';
	}
	if (activeSection === 'access' && !canManagePermissions) activeSection = 'profile';

	const targetRole = normalizeBusinessRole(employee.role);
	const canEditPermissions =
		canManagePermissions &&
		targetRole !== 'owner' &&
		employee.id !== locals.userId &&
		(targetRole !== 'manager' || canManageManagers);
	const canDeleteEmployee =
		canManagePeople &&
		targetRole !== 'owner' &&
		employee.id !== locals.userId &&
		(targetRole !== 'manager' || canManageManagers);
	const shouldLoadOnboarding = canReviewOnboarding && activeSection === 'onboarding';
	const shouldLoadHrRecords =
		(canReadSensitiveProfile || canManagePermissions) &&
		['documents', 'access', 'activity'].includes(activeSection);

	if (canManagePermissions) await ensureDefaultBusinessPositions(db, businessId, locals.userId ?? null);
	const [
		profile,
		employment,
		departments,
		roleDefinitions,
		roleAccessMap,
		onboarding,
		hrSettings,
		hrPos,
		positions
	] = await Promise.all([
		canReadSensitiveProfile
			? loadAdminEmployeeProfile(db, employee.id, businessId)
			: Promise.resolve({
					user_id: employee.id,
					phone: '',
					birthday: '',
					address_line_1: '',
					address_line_2: '',
					city: '',
					state: '',
					postal_code: '',
					emergency_contact_name: '',
					emergency_contact_phone: '',
					emergency_contact_relationship: ''
				}),
		loadEmployeeEmploymentRecord(db, employee.id, businessId),
		loadScheduleDepartments(db, businessId),
		loadScheduleRoleDefinitions(db, businessId),
		loadScheduleRoleAccessByUser(db, businessId, [employee.id]),
		shouldLoadOnboarding
			? loadEmployeeOnboarding(db, employee.id, businessId, {
					env: platform?.env,
					actorUserId: locals.userId,
					actorBusinessRole: locals.businessRole,
					actorPermissionTemplate: locals.businessPermissionTemplate,
					actorCapabilities: locals.businessCapabilities,
					auditSensitiveRead: true
				})
			: Promise.resolve({ package: null, items: [], i9Verification: null }),
		shouldLoadOnboarding
			? loadBusinessHrSettings(db, businessId)
			: Promise.resolve({ retain_i9_document_copies: 0, everify_participant: 0 }),
		shouldLoadHrRecords
			? loadEmployeeHrPosAccess(db, employee.id, businessId)
			: Promise.resolve(null),
		canManagePermissions ? loadBusinessPositions(db, businessId, true) : Promise.resolve([])
	]);

	return {
		activeSection,
		employee,
		profile,
		employment,
		onboarding,
		hrSettings,
		hrPos:
			hrPos && !canReadSensitiveProfile
				? {
						...hrPos,
						certifications: [],
						verificationChecks: [],
						documentAudit: [],
						complianceDocuments: []
					}
				: hrPos,
		canReadSensitiveProfile,
		canManagePeople,
		canReviewOnboarding,
		canManageOnboarding,
		canManageScheduleAssignments,
		canEditHrRecords: canManagePeople && canReadSensitiveProfile,
		canManageHrPos: canReadSensitiveProfile || canManagePermissions,
		canManagePermissions,
		positions: positions.filter((position) => position.is_active === 1 || position.id === employee.position_id),
		departments,
		roleDefinitions,
		scheduleRoleAccess: roleAccessMap.get(employee.id) ?? {
			restrictToSelected: false,
			roleDefinitionIds: []
		},
		managerOptions: users
			.filter((user) => ['owner', 'manager'].includes(normalizeBusinessRole(user.role)))
			.map((user) => ({ id: user.id, displayName: user.display_name, email: user.email })),
		canEditPermissions,
		canDeleteEmployee,
		canManageManagerAccess: canManageManagers,
		actorIsOwner,
		editableCapabilities: actorIsOwner
			? ALL_BUSINESS_CAPABILITIES
			: (locals.businessCapabilities ?? []).filter((capability) => capability !== 'manage_managers')
	};
};

export const actions: Actions = {
	delete_user: ({ request, locals }) => deleteUser(request, locals),
	update_employment: ({ request, locals }) => updateEmployeeEmploymentRecord(request, locals),
	update_permissions: ({ request, locals }) => updateUserBusinessPermissions(request, locals),
	update_capabilities: ({ request, locals }) => updateUserCapabilityOverrides(request, locals),
	toggle_schedule_department: ({ request, locals }) =>
		toggleScheduleDepartmentApproval(request, locals),
	save_schedule_roles: ({ request, locals }) => saveUserScheduleRoleAccess(request, locals),
	save_pos_permissions: ({ request, locals }) => saveEmployeePosPermissions(request, locals),
	toggle_hr_access: ({ request, locals }) => toggleEmployeeHrAccess(request, locals),
	add_certification: ({ request, locals }) => addEmployeeCertification(request, locals),
	delete_certification: ({ request, locals }) => deleteEmployeeCertification(request, locals),
	add_verification_check: ({ request, locals }) => addEmployeeVerificationCheck(request, locals),
	update_verification_check: ({ request, locals }) =>
		updateEmployeeVerificationCheck(request, locals),
	send_onboarding_package: ({ request, locals }) => sendEmployeeOnboardingPackage(request, locals),
	verify_i9: ({ request, locals }) => verifyEmployeeI9(request, locals),
	approve_onboarding_packet: ({ request, locals }) =>
		approveEmployeeOnboardingPackage(request, locals),
	return_onboarding_packet: ({ request, locals }) =>
		returnEmployeeOnboardingPackage(request, locals)
};
