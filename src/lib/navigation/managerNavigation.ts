import {
	canRoleAccessFeature,
	defaultAppFeatureModes,
	type AppFeatureKey,
	type AppFeatureModes
} from '#lib/features/appFeatures.ts';
import { hasBusinessCapability, type BusinessCapability } from '#lib/auth/roles.ts';

export type ManagerNavigationItem = {
	id: string;
	label: string;
	href: string;
	icon: string;
	requiredCapability: BusinessCapability;
	featureKey?: AppFeatureKey;
	showInSidebar?: boolean;
};

export type ManagerNavigationGroup = {
	id: 'manager' | 'people' | 'schedule' | 'workspace' | 'business';
	label: string;
	icon: string;
	items: ManagerNavigationItem[];
};

export type ManagerNavigationUser = {
	role?: string | null;
	businessRole?: string | null;
	businessPermissionTemplate?: string | null;
	businessCapabilities?: BusinessCapability[];
} | null;

export const managerNavigationGroups: ManagerNavigationGroup[] = [
	{
		id: 'manager',
		label: 'Manager',
		icon: 'space_dashboard',
		items: [
			{
				id: 'manager-dashboard',
				label: 'Manager Dashboard',
				href: '/admin',
				icon: 'space_dashboard',
				requiredCapability: 'admin_access',
				showInSidebar: true
			}
		]
	},
	{
		id: 'people',
		label: 'People & HR',
		icon: 'groups',
		items: [
			{ id: 'people-overview', label: 'Overview', href: '/admin/users?view=overview', icon: 'space_dashboard', requiredCapability: 'view_people', showInSidebar: true },
			{ id: 'people-team', label: 'Team Directory', href: '/admin/users?view=team', icon: 'groups', requiredCapability: 'view_people', showInSidebar: true },
			{ id: 'people-invitations', label: 'Invitations', href: '/admin/onboarding?view=invites', icon: 'person_add', requiredCapability: 'manage_onboarding', showInSidebar: true },
			{ id: 'people-onboarding', label: 'Onboarding Packets', href: '/admin/onboarding?view=packets', icon: 'assignment_turned_in', requiredCapability: 'review_onboarding', showInSidebar: true },
			{ id: 'people-forms', label: 'Forms & Policies', href: '/admin/onboarding?view=forms', icon: 'description', requiredCapability: 'manage_hr_setup', showInSidebar: true },
			{ id: 'people-compliance', label: 'HR & Compliance', href: '/admin/users?view=hr', icon: 'verified_user', requiredCapability: 'view_sensitive_employee_data', showInSidebar: true },
			{ id: 'people-access', label: 'Roles & Access', href: '/admin/users?view=access', icon: 'manage_accounts', requiredCapability: 'manage_permissions', showInSidebar: true }
		]
	},
	{
		id: 'schedule',
		label: 'Scheduling',
		icon: 'calendar_view_week',
		items: [
			{ id: 'schedule-builder', label: 'Schedule Builder', href: '/admin/schedule?tool=builder', icon: 'calendar_view_week', requiredCapability: 'manage_schedule', featureKey: 'scheduling', showInSidebar: true },
			{ id: 'schedule-approvals', label: 'Requests & Availability', href: '/admin/schedule?tool=approvals', icon: 'task_alt', requiredCapability: 'manage_schedule', featureKey: 'scheduling' },
			{ id: 'schedule-open-shifts', label: 'Open Shifts', href: '/admin/schedule?tool=open-shifts', icon: 'event_available', requiredCapability: 'manage_schedule', featureKey: 'scheduling' },
			{ id: 'schedule-labor', label: 'Labor Targets', href: '/admin/schedule?tool=labor', icon: 'monitoring', requiredCapability: 'manage_schedule', featureKey: 'scheduling' },
			{ id: 'schedule-templates', label: 'Templates', href: '/admin/schedule?tool=templates', icon: 'content_copy', requiredCapability: 'manage_schedule', featureKey: 'scheduling' },
			{ id: 'schedule-setup', label: 'Roles & Departments', href: '/admin/schedule?tool=setup', icon: 'account_tree', requiredCapability: 'manage_schedule', featureKey: 'scheduling' }
		]
	},
	{
		id: 'workspace',
		label: 'Content & Operations',
		icon: 'tune',
		items: [
			{ id: 'workspace-branding', label: 'App Editor', href: '/admin/app-editor', icon: 'tune', requiredCapability: 'manage_workspace', showInSidebar: true },
			{ id: 'workspace-creator', label: 'Creator Studio', href: '/admin/creator', icon: 'build_circle', requiredCapability: 'manage_content', showInSidebar: true },
			{ id: 'workspace-vendor-directory', label: 'Vendor Directory', href: '/vendors', icon: 'store', requiredCapability: 'view_vendors', featureKey: 'vendors' },
			{ id: 'workspace-vendors', label: 'Vendor Manager', href: '/admin/vendors', icon: 'local_shipping', requiredCapability: 'manage_vendors', featureKey: 'vendors', showInSidebar: true },
			{ id: 'workspace-todo-log', label: 'ToDo Completion Log', href: '/todo/log', icon: 'history', requiredCapability: 'manage_content', featureKey: 'todo' },
			{ id: 'workspace-reports', label: 'Reports', href: '/reports', icon: 'analytics', requiredCapability: 'view_reports', showInSidebar: true }
		]
	},
	{
		id: 'business',
		label: 'Business & Systems',
		icon: 'business',
		items: [
			{ id: 'business-registry', label: 'Business Registry', href: '/admin/business-registry', icon: 'storefront', requiredCapability: 'manage_workspace', showInSidebar: true },
			{ id: 'business-billing', label: 'Billing', href: '/billing', icon: 'payments', requiredCapability: 'manage_billing', showInSidebar: true },
			{ id: 'business-features', label: 'Feature Matrix', href: '/admin/feature-matrix', icon: 'toggle_on', requiredCapability: 'manage_workspace', showInSidebar: true },
			{ id: 'business-sensors', label: 'Temperature Sensor Setup', href: '/admin/sensors', icon: 'device_thermostat', requiredCapability: 'manage_devices', featureKey: 'temps', showInSidebar: true }
		]
	}
];

export function canViewManagerNavigationItem(
	item: ManagerNavigationItem,
	user: ManagerNavigationUser,
	featureModes: AppFeatureModes = defaultAppFeatureModes
) {
	if (!user) return false;
	if (
		!hasBusinessCapability(
			user.businessRole ?? user.role,
			user.businessPermissionTemplate,
			item.requiredCapability,
			user.businessCapabilities
		)
	) {
		return false;
	}
	return item.featureKey
		? canRoleAccessFeature(
				featureModes[item.featureKey],
				user.businessRole ?? user.role,
				item.featureKey,
				user.businessPermissionTemplate,
				user.businessCapabilities
			)
		: true;
}

export function isManagerNavigationItemActive(
	item: ManagerNavigationItem,
	pathname: string,
	search = ''
) {
	if (item.id === 'people-team' && pathname.startsWith('/admin/users/')) return true;
	const [routePath, routeQuery = ''] = item.href.split('?', 2);
	const pathMatches =
		item.id === 'workspace-reports'
			? pathname === routePath || pathname.startsWith(`${routePath}/`)
			: pathname === routePath;
	if (!pathMatches) return false;
	if (!routeQuery) return true;

	const routeParams = new URLSearchParams(routeQuery);
	const currentParams = new URLSearchParams(search);
	for (const [key, value] of routeParams) {
		const currentValue = currentParams.get(key);
		if (currentValue === value) continue;
		if (!currentValue && item.id === 'people-overview') continue;
		if (!currentValue && item.id === 'people-onboarding') continue;
		if (!currentValue && item.id === 'schedule-builder') continue;
		return false;
	}
	return true;
}

export function isManagerWorkspacePath(pathname: string) {
	return (
		pathname.startsWith('/admin') ||
		pathname.startsWith('/reports') ||
		pathname === '/billing' ||
		pathname === '/vendors' ||
		pathname === '/todo/log'
	);
}
