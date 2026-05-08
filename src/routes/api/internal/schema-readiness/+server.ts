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
	'business_lifecycle_snapshots'
];

function isAuthorized(request: Request, env: App.Platform['env'] | undefined) {
	const token = env?.SMOKE_INTERNAL_TOKEN;
	if (!token) return false;
	const headerToken = request.headers.get('x-smoke-token');
	const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
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

	const [coreTables, tenantIssues] = await Promise.all([missingCoreTables(db), verifyTenantSchema(db)]);
	const ok = coreTables.length === 0 && tenantIssues.length === 0;
	if (!ok) {
		logOperationalEvent({
			level: 'error',
			event: 'schema_readiness_failed',
			request,
			status: 500,
			metadata: {
				table_count: coreTables.length,
				issue_count: tenantIssues.length,
				phase: 'pre_traffic'
			}
		});
	}

	return json(
		{
			ok,
			missingCoreTables: coreTables,
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
