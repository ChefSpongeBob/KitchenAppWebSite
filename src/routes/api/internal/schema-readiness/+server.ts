import { json, type RequestHandler } from '@sveltejs/kit';
import { verifyTenantSchema } from '$lib/server/tenant';
import { logOperationalEvent } from '$lib/server/observability';

const REQUIRED_CORE_TABLES = [
	'users',
	'devices',
	'sessions',
	'businesses',
	'business_users',
	'business_invites',
	'user_preferences',
	'password_resets',
	'security_rate_limits',
	'account_audit_logs',
	'trial_identity_claims',
	'business_lifecycle_snapshots',
	'account_deletion_requests',
	'store_products',
	'store_webhook_events',
	'employee_employment_records',
	'employee_compliance_requirements',
	'employee_compliance_documents',
	'employee_document_access_audit',
	'employee_onboarding_invite_requirements',
	'employee_role_permissions',
	'employee_pos_permissions',
	'employee_certifications',
	'employee_sensitive_record_vault',
	'employee_sensitive_record_audit',
	'employee_verification_checks'
];

const REQUIRED_CORE_INDEXES = [
	'idx_business_users_business_active_role',
	'idx_schedule_shifts_business_week_date',
	'idx_schedule_open_shifts_business_week',
	'idx_schedule_departments_business_active_order',
	'idx_schedule_role_definitions_business_active_department',
	'idx_user_schedule_departments_business_user',
	'idx_schedule_open_shift_requests_business_open_user',
	'idx_documents_business_slug_active',
	'idx_recipes_business_category_title',
	'idx_temps_business_sensor_ts',
	'idx_camera_events_business_created',
	'idx_store_purchase_events_business_status_created',
	'idx_employee_employment_records_business_status',
	'idx_employee_compliance_requirements_business_active',
	'idx_employee_compliance_documents_business_user',
	'idx_employee_document_access_audit_business_created',
	'idx_employee_onboarding_invite_requirements_invite',
	'idx_employee_role_permissions_business_permission',
	'idx_employee_pos_permissions_business_pos',
	'idx_employee_certifications_business_user',
	'idx_business_invites_business_context',
	'idx_employee_sensitive_record_vault_business_scope',
	'idx_employee_sensitive_record_audit_business_created',
	'idx_employee_verification_checks_business_user',
	'idx_employee_compliance_documents_onboarding_item'
];

function isAuthorized(request: Request, env: App.Platform['env'] | undefined) {
	const token = env?.SMOKE_INTERNAL_TOKEN?.trim();
	if (!token) return false;
	const headerToken = request.headers.get('x-smoke-token')?.trim();
	const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
	return headerToken === token || bearer === token;
}

async function missingCoreTables(db: App.Platform['env']['DB']) {
	const missing: string[] = [];
	for (const table of REQUIRED_CORE_TABLES) {
		const row = await db
			.prepare(
				`
				SELECT name
				FROM sqlite_master
				WHERE type = 'table' AND name = ?
				LIMIT 1
				`
			)
			.bind(table)
			.first<{ name: string }>();
		if (!row?.name) missing.push(table);
	}
	return missing;
}

async function missingCoreIndexes(db: App.Platform['env']['DB']) {
	const missing: string[] = [];
	for (const indexName of REQUIRED_CORE_INDEXES) {
		const row = await db
			.prepare(
				`
				SELECT name
				FROM sqlite_master
				WHERE type = 'index' AND name = ?
				LIMIT 1
				`
			)
			.bind(indexName)
			.first<{ name: string }>();
		if (!row?.name) missing.push(indexName);
	}
	return missing;
}

export const GET: RequestHandler = async ({ request, platform, locals }) => {
	if (!isAuthorized(request, platform?.env)) {
		return json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
	}

	const db = locals.DB ?? platform?.env?.DB;
	if (!db) {
		logOperationalEvent({
			level: 'error',
			event: 'schema_readiness_db_unavailable',
			request,
			status: 503
		});
		return json({ ok: false, error: 'Database not configured.' }, { status: 503 });
	}

	const [coreTables, coreIndexes, tenantIssues] = await Promise.all([
		missingCoreTables(db),
		missingCoreIndexes(db),
		verifyTenantSchema(db)
	]);
	const ok = coreTables.length === 0 && coreIndexes.length === 0 && tenantIssues.length === 0;
	if (!ok) {
		logOperationalEvent({
			level: 'error',
			event: 'schema_readiness_failed',
			request,
			status: 500,
			metadata: {
				table_count: coreTables.length,
				index_count: coreIndexes.length,
				issue_count: tenantIssues.length,
				phase: 'pre_traffic'
			}
		});
	}

	return json(
		{
			ok,
			missingCoreTables: coreTables,
			missingCoreIndexes: coreIndexes,
			tenantIssues
		},
		{
			status: ok ? 200 : 500,
			headers: {
				'cache-control': 'no-store'
			}
		}
	);
};
