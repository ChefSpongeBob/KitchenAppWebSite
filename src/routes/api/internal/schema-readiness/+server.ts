import { json, type RequestHandler } from '@sveltejs/kit';
import { verifyTenantSchema } from '#lib/server/tenant.ts';
import { logOperationalEvent } from '#lib/server/observability.ts';
import { isSensitiveEncryptionConfigured } from '#lib/server/sensitive.ts';
import { bearerTokenFromRequest, constantTimeTokenEqual } from '#lib/server/requestTokens.ts';

const REQUIRED_CORE_TABLES = [
	'platform_staff_members',
	'platform_staff_step_up',
	'platform_staff_email_challenges',
	'platform_staff_audit',
	'platform_diagnostic_issues',
	'platform_request_metrics',
	'platform_support_requests',
	'platform_support_messages',
	'iot_device_reservations',
	'users',
	'devices',
	'sessions',
	'businesses',
	'business_users',
	'business_invites',
	'business_positions',
	'business_position_permissions',
	'user_preferences',
	'communication_consent_events',
	'announcement_history',
	'password_resets',
	'security_rate_limits',
	'account_audit_logs',
	'trial_identity_claims',
	'business_lifecycle_snapshots',
	'account_deletion_requests',
	'store_products',
	'store_webhook_events',
	'employee_employment_records',
	'business_hr_settings',
	'employee_i9_verifications',
	'employee_i9_document_copies',
	'employee_compliance_requirements',
	'employee_compliance_documents',
	'employee_document_access_audit',
	'employee_onboarding_packages',
	'employee_onboarding_items',
	'employee_onboarding_sensitive_snapshots',
	'employee_onboarding_template_items',
	'employee_onboarding_invite_requirements',
	'employee_role_permissions',
	'employee_pos_permissions',
	'employee_certifications',
	'employee_sensitive_record_vault',
	'employee_sensitive_record_audit',
	'employee_verification_checks',
	'operational_events',
	'operational_event_delivery_attempts',
	'push_notification_devices',
	'user_schedule_availability_requests',
	'user_schedule_role_settings',
	'user_schedule_roles',
	'schedule_draft_shifts',
	'schedule_draft_week_team',
	'schedule_draft_open_shifts',
	'iot_device_inventory',
	'temperature_sensor_nodes',
	'temperature_sensor_settings',
	'temperature_alert_events',
	'waste_logs'
  ,'checklist_completed_runs', 'checklist_completed_run_items'
];

const REQUIRED_CORE_INDEXES = [
  'idx_checklist_runs_business_submitted', 'idx_checklist_runs_expiry', 'idx_checklist_activity_expiry',
  'idx_list_submission_batches_business_time',
  'idx_schedule_availability_requests_business_updated',
  'idx_events_platform_staff_recent',
  'idx_support_recent',
  'idx_support_active_recent',
  'idx_support_status_recent',
  'idx_support_business_recent',
  'idx_support_requester_recent',
  'idx_support_messages_recent',
  'idx_support_messages_customer',
  'idx_checklist_sections_business_slug',
  'idx_list_sections_business_domain_slug',
  'idx_documents_business_slug_active',
  'idx_operational_events_staff_queue',
  'idx_operational_attempts_staff_recent',
	'idx_platform_staff_audit_created',
	'idx_platform_issues_recent',
	'idx_platform_issues_business_recent',
	'idx_platform_issues_kind_recent',
	'idx_platform_issues_area_recent',
	'idx_platform_metrics_expiry',
	'idx_platform_metrics_business',
	'idx_staff_audit_business_recent',
	'idx_account_audit_staff_recent',
	'idx_announcement_staff_recent',
	'idx_gateway_staff_contact',
	'idx_platform_staff_step_up_user',
	'idx_staff_email_challenges_user_created',
	'idx_staff_email_challenges_expiry',
	'idx_iot_reservations_business',
	'idx_businesses_staff_name',
	'idx_business_users_business_active_role',
	'idx_business_positions_business_active',
	'idx_business_position_permissions_business_position',
	'idx_business_users_business_position',
	'idx_business_invites_business_position',
	'idx_schedule_shifts_business_week_date',
	'idx_schedule_open_shifts_business_week',
	'idx_schedule_draft_shifts_business_week_date',
	'idx_schedule_draft_shifts_business_user_date',
	'idx_schedule_draft_week_team_week_sort',
	'idx_schedule_draft_open_shifts_business_week_date',
	'idx_schedule_departments_business_active_order',
	'idx_schedule_role_definitions_business_active_department',
	'idx_user_schedule_departments_business_user',
	'idx_user_schedule_roles_user',
	'idx_user_schedule_roles_role',
	'idx_schedule_open_shift_requests_business_open_user',
	'idx_documents_business_slug_active',
	'idx_recipes_business_category_title',
	'idx_temps_business_sensor_ts',
	'idx_temps_business_sensor_sequence',
	'idx_temps_business_sensor_nonce',
	'idx_store_purchase_events_business_status_created',
	'idx_employee_employment_records_business_status',
	'idx_employee_compliance_requirements_business_active',
	'idx_employee_compliance_documents_business_user',
	'idx_employee_document_access_audit_business_created',
	'idx_employee_onboarding_packages_user',
	'idx_employee_onboarding_packages_review',
	'idx_employee_onboarding_items_package',
	'idx_employee_onboarding_sensitive_snapshot_item',
	'idx_employee_onboarding_sensitive_snapshot_package',
	'idx_employee_onboarding_template_business',
	'idx_employee_onboarding_invite_requirements_invite',
	'idx_employee_i9_verifications_package',
	'idx_employee_i9_verifications_user',
	'idx_employee_i9_document_copies_verification',
	'idx_employee_role_permissions_business_permission',
	'idx_employee_pos_permissions_business_pos',
	'idx_employee_certifications_business_user',
	'idx_communication_consent_user_channel',
	'idx_announcement_history_business_created',
	'idx_schedule_availability_requests_business_status',
	'idx_schedule_availability_requests_business_user',
	'idx_schedule_availability_requests_one_pending',
	'idx_business_invites_business_context',
	'idx_employee_sensitive_record_vault_business_scope',
	'idx_employee_sensitive_record_audit_business_created',
	'idx_employee_verification_checks_business_user',
	'idx_employee_compliance_documents_onboarding_item',
	'idx_operational_events_business_status_next',
	'idx_operational_events_business_type_created',
	'idx_operational_event_attempts_business_status',
	'idx_push_devices_business_user_token',
	'idx_push_devices_business_active_user',
	'idx_push_devices_user_active',
	'idx_iot_inventory_type_status',
	'idx_iot_inventory_claimed_business',
	'idx_temp_sensor_nodes_business_active',
	'idx_temp_sensor_nodes_gateway_active',
	'idx_temp_sensor_nodes_business_sensor',
	'idx_temp_alert_events_business_status',
	'idx_temp_alert_events_business_sensor_status',
	'idx_temp_settings_business_sensor',
	'idx_waste_logs_business_created'
];

const REQUIRED_CORE_COLUMNS: Record<string, string[]> = {
  checklist_sections: ['last_completed_run_id'],
  checklist_items: ['completed_by', 'completed_at'],
  list_items: ['completed_by', 'completed_at'],
  list_submission_batches: ['submitted_by_name_snapshot'],
  list_submission_items: ['completed_by_name_snapshot', 'completed_at'],
  checklist_completed_runs: ['id', 'business_id', 'section_id', 'section_title_snapshot', 'submitted_by_name_snapshot', 'submitted_at'],
  checklist_completed_run_items: ['run_id', 'business_id', 'item_id', 'item_name_snapshot', 'completed_by_name_snapshot', 'completed_at'],
  businesses: ['time_zone'],
  platform_support_requests: ['id', 'business_id', 'requester_user_id', 'created_by', 'submission_id', 'source', 'subject', 'category', 'priority', 'status', 'revision', 'created_at', 'updated_at'],
  platform_support_messages: ['id', 'business_id', 'request_id', 'author_user_id', 'author_type', 'visibility', 'body', 'created_at'],
	platform_diagnostic_issues: ['id', 'business_id', 'area', 'route_id', 'operation', 'kind', 'status', 'occurrences',
		'first_seen_at', 'last_seen_at', 'max_duration_ms', 'last_request_id'],
	platform_request_metrics: ['scope_key', 'business_id', 'bucket', 'success_samples', 'sample_duration_ms',
		'sample_max_ms', 'server_errors', 'access_denials', 'slow_requests'],
	platform_staff_members: ['user_id', 'staff_role', 'is_active', 'granted_by', 'created_at', 'updated_at', 'revision', 'otp_email'],
	platform_staff_step_up: ['session_id', 'user_id', 'membership_revision', 'verified_at', 'email_verified_at'],
	platform_staff_email_challenges: ['session_id', 'user_id', 'challenge_id', 'membership_revision', 'session_token_hash',
		'purpose', 'source_email', 'recipient_email', 'code_hash', 'created_at', 'expires_at', 'sent_at', 'attempts'],
	platform_staff_audit: ['id', 'actor_user_id', 'target_user_id', 'action', 'business_id', 'device_serial', 'reason', 'created_at'],
	iot_device_reservations: ['serial', 'business_id', 'reserved_by', 'created_at'],
	schedule_weeks: [
		'draft_initialized',
		'draft_version',
		'published_version',
		'has_unpublished_changes',
		'draft_updated_at',
		'draft_updated_by',
		'draft_write_token'
	]
};

function missingRequiredSecrets(env: App.RuntimeEnv | undefined) {
	const missing: string[] = [];
	if (!isSensitiveEncryptionConfigured(env)) missing.push('SENSITIVE_DATA_KEY');
	return missing;
}

function isAuthorized(request: Request, env: App.RuntimeEnv | undefined) {
	const token = env?.SMOKE_INTERNAL_TOKEN?.trim();
	if (!token) return false;
	const headerToken = request.headers.get('x-smoke-token')?.trim();
	const bearer = bearerTokenFromRequest(request);
	return constantTimeTokenEqual(token, headerToken) || constantTimeTokenEqual(token, bearer);
}

async function missingCoreTables(db: App.RuntimeEnv['DB']) {
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

async function missingCoreIndexes(db: App.RuntimeEnv['DB']) {
	const namespaceDefinitions: Record<string, RegExp> = {
		idx_checklist_sections_business_slug: /CREATE\s+UNIQUE\s+INDEX[\s\S]*ON\s+checklist_sections\s*\(\s*business_id\s*,\s*slug\s*\)/i,
		idx_list_sections_business_domain_slug: /CREATE\s+UNIQUE\s+INDEX[\s\S]*ON\s+list_sections\s*\(\s*business_id\s*,\s*domain\s*,\s*slug\s*\)/i,
		idx_documents_business_slug_active: /CREATE\s+UNIQUE\s+INDEX[\s\S]*ON\s+documents\s*\(\s*business_id\s*,\s*slug\s*\)/i
	};
	const missing: string[] = [];
	for (const indexName of REQUIRED_CORE_INDEXES) {
		const row = await db
			.prepare(
				`
				SELECT name, sql
				FROM sqlite_master
				WHERE type = 'index' AND name = ?
				LIMIT 1
				`
			)
			.bind(indexName)
			.first<{ name: string; sql: string | null }>();
		if (!row?.name || (namespaceDefinitions[indexName] && !namespaceDefinitions[indexName].test(row.sql ?? ''))) missing.push(indexName);
	}
	return missing;
}

async function missingCoreColumns(db: App.RuntimeEnv['DB']) {
	const missing: Array<{ table: string; column: string }> = [];
	for (const [table, requiredColumns] of Object.entries(REQUIRED_CORE_COLUMNS)) {
		const rows = await db
			.prepare('SELECT name FROM pragma_table_info(?)')
			.bind(table)
			.all<{ name: string }>();
		const present = new Set((rows.results ?? []).map((row) => row.name));
		for (const column of requiredColumns) {
			if (!present.has(column)) missing.push({ table, column });
		}
	}
	return missing;
}

export const GET: RequestHandler = async ({ request, locals }) => {
	if (!isAuthorized(request, locals.env)) {
		return json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
	}

	const db = locals.DB ?? locals.env.DB;
	if (!db) {
		logOperationalEvent({
			level: 'error',
			event: 'schema_readiness_db_unavailable',
			request,
			status: 503
		});
		return json({ ok: false, error: 'Database not configured.' }, { status: 503 });
	}

	const [coreTables, coreIndexes, coreColumns, tenantIssues] = await Promise.all([
		missingCoreTables(db),
		missingCoreIndexes(db),
		missingCoreColumns(db),
		verifyTenantSchema(db)
	]);
	const secrets = missingRequiredSecrets(locals.env);
	const ok =
		coreTables.length === 0 &&
		coreIndexes.length === 0 &&
		coreColumns.length === 0 &&
		tenantIssues.length === 0 &&
		secrets.length === 0;
	if (!ok) {
		logOperationalEvent({
			level: 'error',
			event: 'schema_readiness_failed',
			request,
			status: 500,
			metadata: {
				table_count: coreTables.length,
				index_count: coreIndexes.length,
				column_count: coreColumns.length,
				issue_count: tenantIssues.length,
				secret_count: secrets.length,
				phase: 'pre_traffic'
			}
		});
	}

	return json(
		{
			ok,
			missingCoreTables: coreTables,
			missingCoreIndexes: coreIndexes,
			missingCoreColumns: coreColumns,
			tenantIssues,
			missingRequiredSecrets: secrets
		},
		{
			status: ok ? 200 : 500,
			headers: {
				'cache-control': 'no-store'
			}
		}
	);
};
