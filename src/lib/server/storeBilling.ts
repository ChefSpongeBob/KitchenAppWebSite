import { dev } from '$app/environment';

type D1 = App.Platform['env']['DB'];

export type StoreBillingPreference = 'google_play' | 'app_store' | 'both';
export type StoreBillingStatus = 'pending_setup' | 'queued' | 'active' | 'disabled';
export type BillingStore = 'google_play' | 'app_store';
export type StoreEntitlementStatus =
	| 'pending_verification'
	| 'active'
	| 'expired'
	| 'canceled'
	| 'refunded'
	| 'grace_period'
	| 'past_due';

export type StoreProduct = {
	id: string;
	store: BillingStore;
	product_id: string;
	display_name: string;
	entitlement_key: string;
	plan_tier: 'starter' | 'growth' | 'enterprise' | null;
	billing_period: string;
	price_cents: number;
	currency: string;
	addon_temp_monitoring: number;
	addon_camera_monitoring: number;
	active: number;
};

let storeBillingPlaceholderSchemaEnsured = false;

function normalizePreference(value: string | null | undefined): StoreBillingPreference {
	const normalized = String(value ?? '')
		.trim()
		.toLowerCase();
	if (normalized === 'google_play') return 'google_play';
	if (normalized === 'app_store') return 'app_store';
	return 'both';
}

export function normalizeStore(value: string | null | undefined): BillingStore | null {
	const normalized = String(value ?? '')
		.trim()
		.toLowerCase();
	if (normalized === 'google_play') return 'google_play';
	if (normalized === 'app_store') return 'app_store';
	return null;
}

function safeJson(value: unknown) {
	try {
		return JSON.stringify(value ?? {});
	} catch {
		return '{}';
	}
}

export async function sha256Hex(value: string) {
	const bytes = new TextEncoder().encode(value);
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function ensureStoreBillingPlaceholderSchema(db: D1) {
	if (!dev) {
		storeBillingPlaceholderSchemaEnsured = true;
		return;
	}
	if (storeBillingPlaceholderSchemaEnsured) return;

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

export async function readStoreProducts(db: D1, store?: BillingStore | null) {
	const query = store
		? `
      SELECT *
      FROM store_products
      WHERE active = 1 AND store = ?
      ORDER BY
        CASE entitlement_key
          WHEN 'plan_small' THEN 1
          WHEN 'plan_medium' THEN 2
          WHEN 'plan_large' THEN 3
          WHEN 'addon_temp_monitoring' THEN 4
          WHEN 'addon_camera_monitoring' THEN 5
          ELSE 99
        END
    `
		: `
      SELECT *
      FROM store_products
      WHERE active = 1
      ORDER BY store, price_cents, product_id
    `;
	const statement = db.prepare(query);
	const rows = store
		? await statement.bind(store).all<StoreProduct>()
		: await statement.all<StoreProduct>();
	return rows.results ?? [];
}

export async function readStoreProduct(db: D1, store: BillingStore, productId: string) {
	return db
		.prepare(
			`
      SELECT *
      FROM store_products
      WHERE store = ? AND product_id = ? AND active = 1
      LIMIT 1
    `
		)
		.bind(store, productId)
		.first<StoreProduct>();
}

export async function readBusinessEntitlements(db: D1, businessId: string) {
	const rows = await db
		.prepare(
			`
      SELECT
        id,
        business_id,
        owner_user_id,
        store,
        product_id,
        entitlement_key,
        plan_tier,
        addon_temp_monitoring,
        addon_camera_monitoring,
        status,
        current_period_start,
        current_period_end,
        auto_renewing,
        verified_at,
        expires_at,
        created_at,
        updated_at
      FROM business_store_entitlements
      WHERE business_id = ?
      ORDER BY updated_at DESC
    `
		)
		.bind(businessId)
		.all<{
			id: string;
			business_id: string;
			owner_user_id: string;
			store: BillingStore;
			product_id: string;
			entitlement_key: string;
			plan_tier: 'starter' | 'growth' | 'enterprise' | null;
			addon_temp_monitoring: number;
			addon_camera_monitoring: number;
			status: StoreEntitlementStatus;
			current_period_start: number | null;
			current_period_end: number | null;
			auto_renewing: number;
			verified_at: number | null;
			expires_at: number | null;
			created_at: number;
			updated_at: number;
		}>();
	return rows.results ?? [];
}

export async function recordStorePurchaseEvent(
	db: D1,
	args: {
		businessId: string;
		userId: string;
		store: BillingStore;
		productId: string;
		purchaseTokenHash?: string | null;
		originalTransactionId?: string | null;
		transactionId?: string | null;
		eventType: string;
		verificationStatus: string;
		rawPayload?: unknown;
		now?: number;
	}
) {
	const now = args.now ?? Math.floor(Date.now() / 1000);
	const id = crypto.randomUUID();
	await db
		.prepare(
			`
      INSERT INTO store_purchase_events (
        id,
        business_id,
        user_id,
        store,
        product_id,
        purchase_token_hash,
        original_transaction_id,
        transaction_id,
        event_type,
        verification_status,
        raw_payload_json,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
		)
		.bind(
			id,
			args.businessId,
			args.userId,
			args.store,
			args.productId,
			args.purchaseTokenHash ?? null,
			args.originalTransactionId ?? null,
			args.transactionId ?? null,
			args.eventType,
			args.verificationStatus,
			safeJson(args.rawPayload),
			now
		)
		.run();
	return id;
}

export async function upsertPendingStoreEntitlement(
	db: D1,
	args: {
		businessId: string;
		ownerUserId: string;
		product: StoreProduct;
		purchaseTokenHash?: string | null;
		originalTransactionId?: string | null;
		transactionId?: string | null;
		rawPayload?: unknown;
		now?: number;
	}
) {
	const now = args.now ?? Math.floor(Date.now() / 1000);
	const id = crypto.randomUUID();
	await db
		.prepare(
			`
      INSERT INTO business_store_entitlements (
        id,
        business_id,
        owner_user_id,
        store,
        product_id,
        entitlement_key,
        plan_tier,
        addon_temp_monitoring,
        addon_camera_monitoring,
        purchase_token_hash,
        original_transaction_id,
        latest_transaction_id,
        status,
        raw_payload_json,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_verification', ?, ?, ?)
      ON CONFLICT(business_id, store, product_id) DO UPDATE SET
        owner_user_id = excluded.owner_user_id,
        entitlement_key = excluded.entitlement_key,
        plan_tier = excluded.plan_tier,
        addon_temp_monitoring = excluded.addon_temp_monitoring,
        addon_camera_monitoring = excluded.addon_camera_monitoring,
        purchase_token_hash = excluded.purchase_token_hash,
        original_transaction_id = excluded.original_transaction_id,
        latest_transaction_id = excluded.latest_transaction_id,
        status = 'pending_verification',
        raw_payload_json = excluded.raw_payload_json,
        updated_at = excluded.updated_at
    `
		)
		.bind(
			id,
			args.businessId,
			args.ownerUserId,
			args.product.store,
			args.product.product_id,
			args.product.entitlement_key,
			args.product.plan_tier,
			args.product.addon_temp_monitoring,
			args.product.addon_camera_monitoring,
			args.purchaseTokenHash ?? null,
			args.originalTransactionId ?? null,
			args.transactionId ?? null,
			safeJson(args.rawPayload),
			now,
			now
		)
		.run();
	storeBillingPlaceholderSchemaEnsured = true;
}

export async function activateVerifiedStoreEntitlement(
	db: D1,
	args: {
		businessId: string;
		store: BillingStore;
		productId: string;
		currentPeriodStart?: number | null;
		currentPeriodEnd?: number | null;
		expiresAt?: number | null;
		autoRenewing?: boolean;
		rawPayload?: unknown;
		now?: number;
	}
) {
	const now = args.now ?? Math.floor(Date.now() / 1000);
	await db
		.prepare(
			`
      UPDATE business_store_entitlements
      SET status = 'active',
          current_period_start = ?,
          current_period_end = ?,
          expires_at = ?,
          auto_renewing = ?,
          verified_at = ?,
          raw_payload_json = COALESCE(?, raw_payload_json),
          updated_at = ?
      WHERE business_id = ? AND store = ? AND product_id = ?
    `
		)
		.bind(
			args.currentPeriodStart ?? null,
			args.currentPeriodEnd ?? null,
			args.expiresAt ?? args.currentPeriodEnd ?? null,
			args.autoRenewing ? 1 : 0,
			now,
			args.rawPayload ? safeJson(args.rawPayload) : null,
			now,
			args.businessId,
			args.store,
			args.productId
		)
		.run();
}

export async function applyVerifiedEntitlementsToBusiness(db: D1, businessId: string) {
	const entitlements = await readBusinessEntitlements(db, businessId);
	const active = entitlements.filter((entitlement) => entitlement.status === 'active');
	const planPriority: Record<string, number> = { starter: 1, growth: 2, enterprise: 3 };
	const activePlan = active
		.filter((entitlement) => entitlement.plan_tier)
		.sort((a, b) => planPriority[b.plan_tier ?? ''] - planPriority[a.plan_tier ?? ''])[0];

	if (!activePlan) return { applied: false };

	const addOnTempMonitoring =
		activePlan.addon_temp_monitoring === 1 ||
		active.some((entitlement) => entitlement.addon_temp_monitoring === 1);
	const addOnCameraMonitoring =
		activePlan.addon_camera_monitoring === 1 ||
		active.some((entitlement) => entitlement.addon_camera_monitoring === 1);
	const now = Math.floor(Date.now() / 1000);

	await db
		.prepare(
			`
      UPDATE businesses
      SET plan_tier = ?,
          status = 'active',
          addon_temp_monitoring = ?,
          addon_camera_monitoring = ?,
          updated_at = ?
      WHERE id = ?
    `
		)
		.bind(
			activePlan.plan_tier,
			addOnTempMonitoring ? 1 : 0,
			addOnCameraMonitoring ? 1 : 0,
			now,
			businessId
		)
		.run();

	await db
		.prepare(
			`
      UPDATE business_trials
      SET status = 'active',
          converted_at = COALESCE(converted_at, ?),
          denial_reason = NULL,
          updated_at = ?
      WHERE business_id = ?
    `
		)
		.bind(now, now, businessId)
		.run();

	return { applied: true, planTier: activePlan.plan_tier };
}
