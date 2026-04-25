type D1 = App.Platform['env']['DB'];

export type StoreBillingPreference = 'google_play' | 'app_store' | 'both';
export type StoreBillingStatus = 'pending_setup' | 'queued' | 'active' | 'disabled';

function normalizePreference(value: string | null | undefined): StoreBillingPreference {
	const normalized = String(value ?? '')
		.trim()
		.toLowerCase();
	if (normalized === 'google_play') return 'google_play';
	if (normalized === 'app_store') return 'app_store';
	return 'both';
}

export async function ensureStoreBillingPlaceholderSchema(db: D1) {
	await db
		.prepare(
			`
      CREATE TABLE IF NOT EXISTS store_billing_placeholders (
        business_id TEXT PRIMARY KEY,
        owner_user_id TEXT NOT NULL,
        preferred_store TEXT NOT NULL DEFAULT 'both',
        plan_tier TEXT NOT NULL,
        addon_temp_monitoring INTEGER NOT NULL DEFAULT 0,
        addon_camera_monitoring INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending_setup',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `
		)
		.run();
}

export async function upsertStoreBillingPlaceholder(
	db: D1,
	args: {
		businessId: string;
		ownerUserId: string;
		preferredStore?: string | null;
		planTier: 'starter' | 'growth' | 'enterprise';
		addOnTempMonitoring: boolean;
		addOnCameraMonitoring: boolean;
		status?: StoreBillingStatus;
		now?: number;
	}
) {
	await ensureStoreBillingPlaceholderSchema(db);
	const now = args.now ?? Math.floor(Date.now() / 1000);
	const preferredStore = normalizePreference(args.preferredStore);
	const status = args.status ?? 'pending_setup';

	await db
		.prepare(
			`
      INSERT INTO store_billing_placeholders (
        business_id,
        owner_user_id,
        preferred_store,
        plan_tier,
        addon_temp_monitoring,
        addon_camera_monitoring,
        status,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(business_id) DO UPDATE SET
        owner_user_id = excluded.owner_user_id,
        preferred_store = excluded.preferred_store,
        plan_tier = excluded.plan_tier,
        addon_temp_monitoring = excluded.addon_temp_monitoring,
        addon_camera_monitoring = excluded.addon_camera_monitoring,
        status = excluded.status,
        updated_at = excluded.updated_at
    `
		)
		.bind(
			args.businessId,
			args.ownerUserId,
			preferredStore,
			args.planTier,
			args.addOnTempMonitoring ? 1 : 0,
			args.addOnCameraMonitoring ? 1 : 0,
			status,
			now,
			now
		)
		.run();
}

export async function readStoreBillingPlaceholder(db: D1, businessId: string) {
	await ensureStoreBillingPlaceholderSchema(db);
	return db
		.prepare(
			`
      SELECT
        business_id,
        owner_user_id,
        preferred_store,
        plan_tier,
        addon_temp_monitoring,
        addon_camera_monitoring,
        status,
        created_at,
        updated_at
      FROM store_billing_placeholders
      WHERE business_id = ?
      LIMIT 1
    `
		)
		.bind(businessId)
		.first<{
			business_id: string;
			owner_user_id: string;
			preferred_store: StoreBillingPreference;
			plan_tier: 'starter' | 'growth' | 'enterprise';
			addon_temp_monitoring: number;
			addon_camera_monitoring: number;
			status: StoreBillingStatus;
			created_at: number;
			updated_at: number;
		}>();
}
