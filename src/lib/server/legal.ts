type D1 = App.Platform['env']['DB'];

export const LIABILITY_AGREEMENT_KEY = 'liability_release';
export const LIABILITY_AGREEMENT_VERSION = '2026-04-25';

export async function ensureLegalAgreementSchema(db: D1) {
	await db
		.prepare(
			`
      CREATE TABLE IF NOT EXISTS legal_agreements (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        agreement_key TEXT NOT NULL,
        agreement_version TEXT NOT NULL,
        accepted_at INTEGER NOT NULL,
        acceptance_source TEXT NOT NULL DEFAULT 'register',
        ip_address TEXT,
        user_agent TEXT,
        created_at INTEGER NOT NULL
      )
    `
		)
		.run();

	await db
		.prepare(
			`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_agreements_unique
      ON legal_agreements (
        business_id,
        user_id,
        agreement_key,
        agreement_version
      )
    `
		)
		.run();
}

export async function recordLegalAgreementAcceptance(
	db: D1,
	args: {
		businessId: string;
		userId: string;
		agreementKey: string;
		agreementVersion: string;
		acceptedAt: number;
		acceptanceSource: string;
		ipAddress?: string | null;
		userAgent?: string | null;
	}
) {
	await ensureLegalAgreementSchema(db);

	await db
		.prepare(
			`
      INSERT OR IGNORE INTO legal_agreements (
        id,
        business_id,
        user_id,
        agreement_key,
        agreement_version,
        accepted_at,
        acceptance_source,
        ip_address,
        user_agent,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
		)
		.bind(
			crypto.randomUUID(),
			args.businessId,
			args.userId,
			args.agreementKey.trim().toLowerCase().slice(0, 80),
			args.agreementVersion.trim().slice(0, 32),
			args.acceptedAt,
			args.acceptanceSource.trim().toLowerCase().slice(0, 48),
			String(args.ipAddress ?? '').trim().slice(0, 128) || null,
			String(args.userAgent ?? '').trim().slice(0, 240) || null,
			args.acceptedAt
		)
		.run();
}
