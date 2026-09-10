import { randomUUID } from 'node:crypto';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const args = new Map();
const flags = new Set();

for (const arg of process.argv.slice(2)) {
	if (arg.startsWith('--') && arg.includes('=')) {
		const [key, ...rest] = arg.slice(2).split('=');
		args.set(key, rest.join('='));
	} else if (arg.startsWith('--')) {
		flags.add(arg.slice(2));
	}
}

function usage(exitCode = 1) {
	console.log([
		'Usage:',
		'  npm run ops:activate-test-tenant -- --remote --email=owner@example.com --plan=medium --confirm=activate-test-tenant',
		'',
		'Options:',
		'  --remote | --local                 Required target D1 environment.',
		'  --email=<owner email>             Required. Must match exactly one active owner membership.',
		'  --plan=small|medium|large         Optional. Defaults to medium.',
		'  --business-id=<business id>        Optional disambiguation if the owner email owns more than one tenant.',
		'  --confirm=activate-test-tenant    Required safety confirmation.'
	].join('\n'));
	process.exit(exitCode);
}

if (flags.has('help') || flags.has('h')) usage(0);

const email = String(args.get('email') ?? '').trim().toLowerCase();
const planInput = String(args.get('plan') ?? 'medium').trim().toLowerCase();
const businessId = String(args.get('business-id') ?? '').trim();
const confirm = String(args.get('confirm') ?? '').trim();
const useRemote = flags.has('remote');
const useLocal = flags.has('local');

const planMap = new Map([
	['small', 'starter'],
	['starter', 'starter'],
	['medium', 'growth'],
	['growth', 'growth'],
	['large', 'enterprise'],
	['enterprise', 'enterprise']
]);

const planTier = planMap.get(planInput);

if (!email || !email.includes('@')) usage();
if (!planTier) usage();
if (confirm !== 'activate-test-tenant') usage();
if (useRemote === useLocal) usage();

function sqlString(value) {
	return `'${String(value).replaceAll("'", "''")}'`;
}

const addonTempMonitoring = planTier === 'growth' || planTier === 'enterprise' ? 1 : 0;
const businessFilter = businessId ? `AND b.id = ${sqlString(businessId)}` : '';

const sql = `
BEGIN TRANSACTION;

CREATE TEMP TABLE _selected_test_tenant AS
SELECT
	b.id AS business_id,
	u.id AS owner_user_id,
	b.name AS business_name,
	b.status AS business_status,
	COALESCE(bt.status, 'missing') AS trial_status
FROM users u
JOIN business_users bu ON bu.user_id = u.id
JOIN businesses b ON b.id = bu.business_id
LEFT JOIN business_trials bt ON bt.business_id = b.id
WHERE lower(u.email) = lower(${sqlString(email)})
	AND bu.role = 'owner'
	AND COALESCE(bu.is_active, 1) = 1
	${businessFilter};

CREATE TEMP TABLE _activation_guard (
	value INTEGER NOT NULL CHECK(value = 1)
);

INSERT INTO _activation_guard(value)
SELECT CASE WHEN COUNT(*) = 1 THEN 1 ELSE NULL END
FROM _selected_test_tenant;

SELECT
	'before' AS phase,
	business_id,
	business_name,
	business_status,
	trial_status
FROM _selected_test_tenant;

UPDATE businesses
SET
	status = 'active',
	plan_tier = ${sqlString(planTier)},
	addon_temp_monitoring = ${addonTempMonitoring},
	addon_camera_monitoring = 0,
	updated_at = strftime('%s','now')
WHERE id IN (SELECT business_id FROM _selected_test_tenant);

INSERT INTO business_trials (
	business_id,
	owner_user_id,
	status,
	trial_started_at,
	trial_ends_at,
	converted_at,
	canceled_at,
	denial_reason,
	cancellation_reason,
	created_at,
	updated_at
)
SELECT
	business_id,
	owner_user_id,
	'active',
	strftime('%s','now'),
	strftime('%s','now'),
	strftime('%s','now'),
	NULL,
	NULL,
	NULL,
	strftime('%s','now'),
	strftime('%s','now')
FROM _selected_test_tenant
ON CONFLICT(business_id) DO UPDATE SET
	owner_user_id = excluded.owner_user_id,
	status = 'active',
	converted_at = strftime('%s','now'),
	canceled_at = NULL,
	denial_reason = NULL,
	cancellation_reason = NULL,
	updated_at = strftime('%s','now');

UPDATE store_billing_placeholders
SET
	plan_tier = ${sqlString(planTier)},
	addon_temp_monitoring = ${addonTempMonitoring},
	addon_camera_monitoring = 0,
	status = 'active',
	updated_at = strftime('%s','now')
WHERE business_id IN (SELECT business_id FROM _selected_test_tenant);

SELECT
	'after' AS phase,
	b.id AS business_id,
	b.name AS business_name,
	b.status AS business_status,
	b.plan_tier,
	b.addon_temp_monitoring,
	b.addon_camera_monitoring,
	bt.status AS trial_status,
	sbp.status AS billing_placeholder_status
FROM _selected_test_tenant selected
JOIN businesses b ON b.id = selected.business_id
LEFT JOIN business_trials bt ON bt.business_id = b.id
LEFT JOIN store_billing_placeholders sbp ON sbp.business_id = b.id;

DROP TABLE _activation_guard;
DROP TABLE _selected_test_tenant;

COMMIT;
`;

const file = join(tmpdir(), `crimini-activate-test-tenant-${randomUUID()}.sql`);
writeFileSync(file, sql);

const wrangler = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const wranglerArgs = [
	'wrangler',
	'd1',
	'execute',
	'crimini-production',
	useRemote ? '--remote' : '--local',
	`--file=${file}`
];

console.log(`Activating one ${useRemote ? 'remote' : 'local'} test tenant for ${email} as ${planTier}.`);
const result = spawnSync(wrangler, wranglerArgs, { stdio: 'inherit', shell: false });

try {
	unlinkSync(file);
} catch {
	// Best effort cleanup for temporary SQL.
}

if (result.status !== 0) {
	console.error('Test tenant activation failed. Confirm the email owns exactly one active tenant, or pass --business-id.');
	process.exit(result.status ?? 1);
}
