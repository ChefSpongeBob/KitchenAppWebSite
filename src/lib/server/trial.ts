import { dev } from '$app/environment';
import { sha256Hex } from '$lib/server/auth';

type D1 = App.Platform['env']['DB'];

const ONE_MONTH_SECONDS = 60 * 60 * 24 * 30;
const TABLE_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

let trialSchemaEnsured = false;
let trialSchemaPromise: Promise<void> | null = null;

type TrialStatus =
	| 'trialing'
	| 'paid'
	| 'active'
	| 'expired'
	| 'canceled'
	| 'pending_payment'
	| 'past_due'
	| 'suspended';

export type TrialIdentity = {
	emailNormalized?: string | null;
	businessName?: string | null;
	clientFingerprint?: string | null;
	ipAddress?: string | null;
	userAgent?: string | null;
};

export type TrialEligibility = {
	eligible: boolean;
	reason: string | null;
};

export type BusinessTrialAccess = {
	mode:
		| 'grandfathered'
		| 'trialing'
		| 'active'
		| 'expired'
		| 'canceled'
		| 'pending_payment'
		| 'past_due'
		| 'suspended';
	allowApp: boolean;
	shouldPurge: boolean;
	trialEndsAt: number | null;
	secondsRemaining: number | null;
	denialReason: string | null;
};

function normalizeText(value: string | null | undefined, maxLength: number) {
	return String(value ?? '')
		.trim()
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.slice(0, maxLength);
}

function normalizeBusinessName(value: string | null | undefined) {
	return normalizeText(value, 120);
}

function stableJson(value: unknown) {
	return JSON.stringify(value ?? null);
}

async function hashOptional(value: string | null | undefined) {
	const normalized = normalizeText(value, 256);
	if (!normalized) return null;
	return sha256Hex(normalized);
}

async function trialClaimKey(identityType: string, identityHash: string) {
	return sha256Hex(`${identityType}:${identityHash}`);
}

async function collectTrialIdentityClaims(identity: TrialIdentity) {
	const claims: Array<{ type: string; hash: string; key: string }> = [];
	const emailNormalized = normalizeText(identity.emailNormalized, 180);
	const businessNameNormalized = normalizeBusinessName(identity.businessName);
	const fingerprintHash = await hashOptional(identity.clientFingerprint);
	const ipHash = await hashOptional(identity.ipAddress);

	if (emailNormalized) {
		claims.push({
			type: 'email',
			hash: await sha256Hex(emailNormalized),
			key: await trialClaimKey('email', await sha256Hex(emailNormalized))
		});
	}
	if (fingerprintHash) {
		claims.push({
			type: 'device',
			hash: fingerprintHash,
			key: await trialClaimKey('device', fingerprintHash)
		});
	}
	if (businessNameNormalized && ipHash) {
		const hash = await sha256Hex(`${businessNameNormalized}:${ipHash}`);
		claims.push({
			type: 'business_ip',
			hash,
			key: await trialClaimKey('business_ip', hash)
		});
	}

	return claims;
}

function safeTableName(name: string) {
	return TABLE_NAME_PATTERN.test(name);
}

async function listTables(db: D1) {
	const rows = await db
		.prepare(
			`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name NOT LIKE 'sqlite_%'
    `
		)
		.all<{ name: string }>();
	return (rows.results ?? []).map((row) => row.name).filter(safeTableName);
}

async function tableColumns(db: D1, tableName: string) {
	if (!safeTableName(tableName)) return new Set<string>();
	const rows = await db.prepare(`PRAGMA table_info(${tableName})`).all<{ name: string }>();
	return new Set((rows.results ?? []).map((row) => row.name));
}

async function businessUserIds(db: D1, businessId: string) {
	const rows = await db
		.prepare(
			`
      SELECT DISTINCT user_id
      FROM business_users
      WHERE business_id = ?
    `
		)
		.bind(businessId)
		.all<{ user_id: string }>();
	return (rows.results ?? []).map((row) => row.user_id).filter(Boolean);
}

async function deleteByBusinessIdAcrossTables(db: D1, businessId: string) {
	const excluded = new Set([
		'account_audit_logs',
		'business_lifecycle_snapshots',
		'trial_denials',
		'trial_identity_claims'
	]);
	const tables = await listTables(db);
	for (const tableName of tables) {
		if (excluded.has(tableName)) continue;
		const columns = await tableColumns(db, tableName);
		if (!columns.has('business_id')) continue;
		await db.prepare(`DELETE FROM ${tableName} WHERE business_id = ?`).bind(businessId).run();
	}
}

async function deleteUserScopedData(db: D1, userId: string) {
	const excluded = new Set(['users', 'business_users', 'trial_denials']);
	const tables = await listTables(db);
	for (const tableName of tables) {
		if (excluded.has(tableName)) continue;
		const columns = await tableColumns(db, tableName);
		if (!columns.has('user_id')) continue;
		await db.prepare(`DELETE FROM ${tableName} WHERE user_id = ?`).bind(userId).run();
	}
}

async function purgeBusinessWorkspaceData(db: D1, businessId: string) {
	const userIds = await businessUserIds(db, businessId);
	await deleteByBusinessIdAcrossTables(db, businessId);
	await db.prepare(`DELETE FROM businesses WHERE id = ?`).bind(businessId).run();

	for (const userId of userIds) {
		const membership = await db
			.prepare(
				`
          SELECT 1
          FROM business_users
          WHERE user_id = ?
          LIMIT 1
        `
			)
			.bind(userId)
			.first<{ 1: number }>();
		if (membership) continue;

		await deleteUserScopedData(db, userId);
		await db.prepare(`DELETE FROM users WHERE id = ?`).bind(userId).run();
	}
}

export function getRequestIpAddress(request: Request) {
	const cf = request.headers.get('cf-connecting-ip');
	if (cf) return cf.trim().slice(0, 128);
	const forwarded = request.headers.get('x-forwarded-for');
	if (forwarded) {
		const first = forwarded.split(',')[0]?.trim();
		if (first) return first.slice(0, 128);
	}
	return '';
}

export async function ensureTrialSchema(db: D1) {
	if (!dev) {
		trialSchemaEnsured = true;
		return;
	}

	if (trialSchemaEnsured) return;
	if (trialSchemaPromise) {
		await trialSchemaPromise;
		return;
	}

	trialSchemaPromise = (async () => {
	await db
		.prepare(
			`
      CREATE TABLE IF NOT EXISTS business_trials (
        business_id TEXT PRIMARY KEY,
        owner_user_id TEXT,
        status TEXT NOT NULL DEFAULT 'trialing',
        trial_started_at INTEGER NOT NULL,
        trial_ends_at INTEGER NOT NULL,
        converted_at INTEGER,
        canceled_at INTEGER,
        denial_reason TEXT,
        cancellation_reason TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
        FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `
		)
		.run();

	await db
		.prepare(
			`
      CREATE TABLE IF NOT EXISTS trial_denials (
        id TEXT PRIMARY KEY,
        email_normalized TEXT,
        business_name_normalized TEXT,
        client_fingerprint_hash TEXT,
        ip_hash TEXT,
        user_agent_hash TEXT,
        source TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        last_seen_at INTEGER NOT NULL,
        notes TEXT
      )
    `
		)
		.run();

	await db
		.prepare(
			`
      CREATE INDEX IF NOT EXISTS idx_trial_denials_email
      ON trial_denials(email_normalized)
    `
		)
		.run();

	await db
		.prepare(
			`
      CREATE INDEX IF NOT EXISTS idx_trial_denials_business
      ON trial_denials(business_name_normalized)
    `
		)
		.run();

	await db
		.prepare(
			`
      CREATE INDEX IF NOT EXISTS idx_trial_denials_fingerprint
      ON trial_denials(client_fingerprint_hash)
    `
		)
		.run();

	await db
		.prepare(
			`
      CREATE INDEX IF NOT EXISTS idx_trial_denials_ip
      ON trial_denials(ip_hash)
    `
		)
		.run();

	await db
		.prepare(
			`
      CREATE TABLE IF NOT EXISTS trial_identity_claims (
        identity_key TEXT PRIMARY KEY,
        identity_type TEXT NOT NULL,
        identity_hash TEXT NOT NULL,
        business_id TEXT,
        user_id TEXT,
        source TEXT NOT NULL DEFAULT 'trial_granted',
        status TEXT NOT NULL DEFAULT 'active',
        first_seen_at INTEGER NOT NULL,
        last_seen_at INTEGER NOT NULL
      )
    `
		)
		.run();

	await db
		.prepare(
			`
      CREATE INDEX IF NOT EXISTS idx_trial_identity_claims_business
      ON trial_identity_claims(business_id, status, last_seen_at DESC)
    `
		)
		.run();

	await db
		.prepare(
			`
      CREATE INDEX IF NOT EXISTS idx_trial_identity_claims_type_hash
      ON trial_identity_claims(identity_type, identity_hash, status)
    `
		)
		.run();

	await db
		.prepare(
			`
      CREATE TABLE IF NOT EXISTS business_lifecycle_snapshots (
        id TEXT PRIMARY KEY,
        business_id TEXT,
        requested_by_user_id TEXT,
        reason TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'completed',
        table_counts_json TEXT NOT NULL,
        business_json TEXT,
        trial_json TEXT,
        billing_json TEXT,
        created_at INTEGER NOT NULL,
        completed_at INTEGER,
        notes TEXT
      )
    `
		)
		.run();

	await db
		.prepare(
			`
      CREATE INDEX IF NOT EXISTS idx_business_lifecycle_snapshots_business
      ON business_lifecycle_snapshots(business_id, created_at DESC)
    `
		)
		.run();

		trialSchemaEnsured = true;
	})();

	await trialSchemaPromise;
}

export async function evaluateTrialEligibility(db: D1, identity: TrialIdentity): Promise<TrialEligibility> {
	await ensureTrialSchema(db);

	const emailNormalized = normalizeText(identity.emailNormalized, 180);
	const businessNameNormalized = normalizeBusinessName(identity.businessName);
	const fingerprintHash = await hashOptional(identity.clientFingerprint);
	const ipHash = await hashOptional(identity.ipAddress);
	const claims = await collectTrialIdentityClaims(identity);

	for (const claim of claims) {
		const match = await db
			.prepare(
				`
          SELECT identity_type, status
          FROM trial_identity_claims
          WHERE identity_key = ?
            AND status IN ('active', 'used', 'denied', 'canceled', 'expired')
          LIMIT 1
        `
			)
			.bind(claim.key)
			.first<{ identity_type: string; status: string }>();
		if (!match) continue;
		if (match.identity_type === 'email') return { eligible: false, reason: 'email_reuse' };
		if (match.identity_type === 'device') return { eligible: false, reason: 'device_reuse' };
		if (match.identity_type === 'business_ip') {
			return { eligible: false, reason: 'business_ip_reuse' };
		}
	}

	if (emailNormalized) {
		const emailMatch = await db
			.prepare(
				`
          SELECT id
          FROM trial_denials
          WHERE email_normalized = ?
          LIMIT 1
        `
			)
			.bind(emailNormalized)
			.first<{ id: string }>();
		if (emailMatch) return { eligible: false, reason: 'email_reuse' };
	}

	if (fingerprintHash) {
		const fingerprintMatch = await db
			.prepare(
				`
          SELECT id
          FROM trial_denials
          WHERE client_fingerprint_hash = ?
          LIMIT 1
        `
			)
			.bind(fingerprintHash)
			.first<{ id: string }>();
		if (fingerprintMatch) return { eligible: false, reason: 'device_reuse' };
	}

	if (businessNameNormalized && ipHash) {
		const businessIpMatch = await db
			.prepare(
				`
          SELECT id
          FROM trial_denials
          WHERE business_name_normalized = ?
            AND ip_hash = ?
          LIMIT 1
        `
			)
			.bind(businessNameNormalized, ipHash)
			.first<{ id: string }>();
		if (businessIpMatch) return { eligible: false, reason: 'business_ip_reuse' };
	}

	return { eligible: true, reason: null };
}

export async function recordTrialIdentityClaims(
	db: D1,
	identity: TrialIdentity,
	args: {
		businessId?: string | null;
		userId?: string | null;
		source: 'trial_granted' | 'trial_denied' | 'trial_expired' | 'trial_canceled' | 'manual';
		status: 'active' | 'used' | 'denied' | 'expired' | 'canceled';
		now?: number;
	}
) {
	await ensureTrialSchema(db);

	const now = args.now ?? Math.floor(Date.now() / 1000);
	const claims = await collectTrialIdentityClaims(identity);
	for (const claim of claims) {
		await db
			.prepare(
				`
        INSERT INTO trial_identity_claims (
          identity_key,
          identity_type,
          identity_hash,
          business_id,
          user_id,
          source,
          status,
          first_seen_at,
          last_seen_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(identity_key) DO UPDATE SET
          business_id = COALESCE(trial_identity_claims.business_id, excluded.business_id),
          user_id = COALESCE(trial_identity_claims.user_id, excluded.user_id),
          source = CASE
            WHEN trial_identity_claims.status IN ('active', 'used')
              AND excluded.status = 'denied'
            THEN trial_identity_claims.source
            ELSE excluded.source
          END,
          status = CASE
            WHEN trial_identity_claims.status IN ('active', 'used')
              AND excluded.status = 'denied'
            THEN trial_identity_claims.status
            ELSE excluded.status
          END,
          last_seen_at = excluded.last_seen_at
      `
			)
			.bind(
				claim.key,
				claim.type,
				claim.hash,
				args.businessId ?? null,
				args.userId ?? null,
				args.source,
				args.status,
				now,
				now
			)
			.run();
	}
}

export async function createBusinessLifecycleSnapshot(
	db: D1,
	args: {
		businessId: string;
		requestedByUserId?: string | null;
		reason: string;
		notes?: string | null;
		now?: number;
	}
) {
	await ensureTrialSchema(db);

	const now = args.now ?? Math.floor(Date.now() / 1000);
	const snapshotId = crypto.randomUUID();
	const tables = await listTables(db);
	const tableCounts: Record<string, number> = {};

	for (const tableName of tables) {
		const columns = await tableColumns(db, tableName);
		if (!columns.has('business_id')) continue;
		const row = await db
			.prepare(`SELECT COUNT(*) AS total FROM ${tableName} WHERE business_id = ?`)
			.bind(args.businessId)
			.first<{ total: number }>();
		tableCounts[tableName] = Number(row?.total ?? 0);
	}

	const business = await db
		.prepare(
			`
      SELECT *
      FROM businesses
      WHERE id = ?
      LIMIT 1
    `
		)
		.bind(args.businessId)
		.first<Record<string, unknown>>();
	const trial = await db
		.prepare(
			`
      SELECT *
      FROM business_trials
      WHERE business_id = ?
      LIMIT 1
    `
		)
		.bind(args.businessId)
		.first<Record<string, unknown>>();
	const billing = tables.includes('store_billing_placeholders')
		? await db
				.prepare(
					`
      SELECT *
      FROM store_billing_placeholders
      WHERE business_id = ?
      LIMIT 1
    `
				)
				.bind(args.businessId)
				.first<Record<string, unknown>>()
		: null;

	await db
		.prepare(
			`
      INSERT INTO business_lifecycle_snapshots (
        id,
        business_id,
        requested_by_user_id,
        reason,
        status,
        table_counts_json,
        business_json,
        trial_json,
        billing_json,
        created_at,
        completed_at,
        notes
      )
      VALUES (?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?)
    `
		)
		.bind(
			snapshotId,
			args.businessId,
			args.requestedByUserId ?? null,
			args.reason,
			stableJson(tableCounts),
			stableJson(business),
			stableJson(trial),
			stableJson(billing),
			now,
			now,
			args.notes?.trim().slice(0, 240) || null
		)
		.run();

	return snapshotId;
}

export async function createTrialDenialRecord(
	db: D1,
	identity: TrialIdentity,
	source: 'expired' | 'canceled' | 'abuse' | 'manual',
	notes = ''
) {
	await ensureTrialSchema(db);

	const now = Math.floor(Date.now() / 1000);
	const emailNormalized = normalizeText(identity.emailNormalized, 180) || null;
	const businessNameNormalized = normalizeBusinessName(identity.businessName) || null;
	const fingerprintHash = await hashOptional(identity.clientFingerprint);
	const ipHash = await hashOptional(identity.ipAddress);
	const userAgentHash = await hashOptional(identity.userAgent);

	await db
		.prepare(
			`
      INSERT INTO trial_denials (
        id,
        email_normalized,
        business_name_normalized,
        client_fingerprint_hash,
        ip_hash,
        user_agent_hash,
        source,
        created_at,
        last_seen_at,
        notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
		)
		.bind(
			crypto.randomUUID(),
			emailNormalized,
			businessNameNormalized,
			fingerprintHash,
			ipHash,
			userAgentHash,
			source,
			now,
			now,
			notes.trim().slice(0, 240) || null
		)
		.run();

	await recordTrialIdentityClaims(db, identity, {
		source:
			source === 'expired'
				? 'trial_expired'
				: source === 'canceled'
					? 'trial_canceled'
					: source === 'manual'
						? 'manual'
						: 'trial_denied',
		status: source === 'canceled' ? 'canceled' : source === 'expired' ? 'expired' : 'denied',
		now
	});
}

export async function initializeBusinessTrial(
	db: D1,
	args: {
		businessId: string;
		ownerUserId: string;
		eligible: boolean;
		denialReason?: string | null;
		statusOverride?: TrialStatus | null;
		identity?: TrialIdentity | null;
		now?: number;
	}
) {
	await ensureTrialSchema(db);

	const now = args.now ?? Math.floor(Date.now() / 1000);
	const status: TrialStatus =
		args.statusOverride ?? (args.eligible ? 'trialing' : 'expired');
	const trialEndsAt = status === 'trialing' ? now + ONE_MONTH_SECONDS : now;
	const businessStatus =
		status === 'trialing'
			? 'trialing'
			: status === 'pending_payment'
				? 'past_due'
				: status === 'paid' || status === 'active'
					? 'active'
					: status;

	await db
		.prepare(
			`
      INSERT INTO business_trials (
        business_id,
        owner_user_id,
        status,
        trial_started_at,
        trial_ends_at,
        denial_reason,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
		)
		.bind(
			args.businessId,
			args.ownerUserId,
			status,
			now,
			trialEndsAt,
			args.denialReason ?? null,
			now,
			now
		)
		.run();

	await db
		.prepare(
			`
      UPDATE businesses
      SET status = ?,
          updated_at = ?
      WHERE id = ?
    `
		)
		.bind(businessStatus, now, args.businessId)
		.run();

	if (args.identity && status === 'trialing') {
		await recordTrialIdentityClaims(db, args.identity, {
			businessId: args.businessId,
			userId: args.ownerUserId,
			source: 'trial_granted',
			status: 'active',
			now
		});
	}
}

export async function getBusinessTrialAccess(
	db: D1,
	businessId: string,
	now = Math.floor(Date.now() / 1000)
): Promise<BusinessTrialAccess> {
	await ensureTrialSchema(db);

	const trial = await db
		.prepare(
			`
      SELECT status, trial_ends_at, denial_reason
      FROM business_trials
      WHERE business_id = ?
      LIMIT 1
    `
		)
		.bind(businessId)
		.first<{
			status: TrialStatus;
			trial_ends_at: number;
			denial_reason: string | null;
		}>();

	if (!trial) {
		return {
			mode: 'grandfathered',
			allowApp: true,
			shouldPurge: false,
			trialEndsAt: null,
			secondsRemaining: null,
			denialReason: null
		};
	}

	if (trial.status === 'paid' || trial.status === 'active') {
		return {
			mode: 'active',
			allowApp: true,
			shouldPurge: false,
			trialEndsAt: trial.trial_ends_at,
			secondsRemaining: null,
			denialReason: null
		};
	}

	if (trial.status === 'trialing') {
		const remaining = trial.trial_ends_at - now;
		if (remaining > 0) {
			return {
				mode: 'trialing',
				allowApp: true,
				shouldPurge: false,
				trialEndsAt: trial.trial_ends_at,
				secondsRemaining: remaining,
				denialReason: null
			};
		}

		await db
			.prepare(
				`
          UPDATE business_trials
          SET status = 'expired',
              denial_reason = COALESCE(denial_reason, 'trial_expired'),
              updated_at = ?
          WHERE business_id = ?
            AND status = 'trialing'
        `
			)
			.bind(now, businessId)
			.run();
		await db
			.prepare(
				`
          UPDATE businesses
          SET status = 'past_due',
              updated_at = ?
          WHERE id = ?
        `
			)
			.bind(now, businessId)
			.run();

		return {
			mode: 'expired',
			allowApp: false,
			shouldPurge: true,
			trialEndsAt: trial.trial_ends_at,
			secondsRemaining: 0,
			denialReason: trial.denial_reason
		};
	}

	if (trial.status === 'pending_payment') {
		return {
			mode: 'pending_payment',
			allowApp: false,
			shouldPurge: false,
			trialEndsAt: trial.trial_ends_at,
			secondsRemaining: 0,
			denialReason: trial.denial_reason
		};
	}

	if (trial.status === 'past_due') {
		return {
			mode: 'past_due',
			allowApp: false,
			shouldPurge: false,
			trialEndsAt: trial.trial_ends_at,
			secondsRemaining: 0,
			denialReason: trial.denial_reason
		};
	}

	if (trial.status === 'suspended') {
		return {
			mode: 'suspended',
			allowApp: false,
			shouldPurge: false,
			trialEndsAt: trial.trial_ends_at,
			secondsRemaining: 0,
			denialReason: trial.denial_reason
		};
	}

	if (trial.status === 'canceled') {
		return {
			mode: 'canceled',
			allowApp: false,
			shouldPurge: false,
			trialEndsAt: trial.trial_ends_at,
			secondsRemaining: 0,
			denialReason: trial.denial_reason
		};
	}

	if (
		trial.denial_reason === 'email_reuse' ||
		trial.denial_reason === 'device_reuse' ||
		trial.denial_reason === 'business_ip_reuse'
	) {
		return {
			mode: 'expired',
			allowApp: false,
			shouldPurge: false,
			trialEndsAt: trial.trial_ends_at,
			secondsRemaining: 0,
			denialReason: trial.denial_reason
		};
	}

	return {
		mode: 'expired',
		allowApp: false,
		shouldPurge: true,
		trialEndsAt: trial.trial_ends_at,
		secondsRemaining: 0,
		denialReason: trial.denial_reason
	};
}

export async function convertBusinessToPaid(
	db: D1,
	args: {
		businessId: string;
		ownerUserId?: string | null;
		planTier: 'starter' | 'growth' | 'enterprise';
		addOnTempMonitoring: boolean;
		addOnCameraMonitoring: boolean;
		now?: number;
	}
) {
	await ensureTrialSchema(db);
	const now = args.now ?? Math.floor(Date.now() / 1000);

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
			args.planTier,
			args.addOnTempMonitoring ? 1 : 0,
			args.addOnCameraMonitoring ? 1 : 0,
			now,
			args.businessId
		)
		.run();

	const existing = await db
		.prepare(
			`
      SELECT business_id
      FROM business_trials
      WHERE business_id = ?
      LIMIT 1
    `
		)
		.bind(args.businessId)
		.first<{ business_id: string }>();

	if (existing) {
		await db
			.prepare(
				`
          UPDATE business_trials
          SET status = 'active',
              converted_at = ?,
              canceled_at = NULL,
              cancellation_reason = NULL,
              denial_reason = NULL,
              updated_at = ?
          WHERE business_id = ?
        `
			)
			.bind(now, now, args.businessId)
			.run();
		return;
	}

	await db
		.prepare(
			`
      INSERT INTO business_trials (
        business_id,
        owner_user_id,
        status,
        trial_started_at,
        trial_ends_at,
        converted_at,
        created_at,
        updated_at
      )
      VALUES (?, ?, 'active', ?, ?, ?, ?, ?)
    `
		)
		.bind(args.businessId, args.ownerUserId ?? null, now, now, now, now, now)
		.run();
}

export async function cancelTrialAndPurgeBusiness(
	db: D1,
	args: {
		businessId: string;
		identity: TrialIdentity;
		source: 'expired' | 'canceled' | 'abuse' | 'manual';
		reason?: string;
		requestedByUserId?: string | null;
		now?: number;
	}
) {
	await ensureTrialSchema(db);
	const now = args.now ?? Math.floor(Date.now() / 1000);

	await createBusinessLifecycleSnapshot(db, {
		businessId: args.businessId,
		requestedByUserId: args.requestedByUserId ?? null,
		reason: args.reason || args.source,
		notes: 'pre_purge',
		now
	});
	await createTrialDenialRecord(db, args.identity, args.source, args.reason ?? '');

	await db
		.prepare(
			`
      UPDATE business_trials
      SET status = 'canceled',
          canceled_at = ?,
          cancellation_reason = ?,
          updated_at = ?
      WHERE business_id = ?
    `
		)
		.bind(now, (args.reason ?? '').slice(0, 240) || null, now, args.businessId)
		.run();
	await db
		.prepare(
			`
      UPDATE businesses
      SET status = 'canceled',
          updated_at = ?
      WHERE id = ?
    `
		)
		.bind(now, args.businessId)
		.run();

	await purgeBusinessWorkspaceData(db, args.businessId);
}
