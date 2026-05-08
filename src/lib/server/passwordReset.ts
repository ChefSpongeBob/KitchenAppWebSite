import { fail } from '@sveltejs/kit';
import { hasColumn } from '$lib/server/dbSchema';

const RESET_TOKEN_TTL_SECONDS = 2 * 60 * 60;
const RESET_RECORD_RETENTION_SECONDS = 30 * 24 * 60 * 60;

export async function ensurePasswordResetSchema(db: App.Platform['env']['DB']) {
  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS password_resets (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        email TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        used_at INTEGER,
        requested_ip TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `
    )
    .run();

  await db
    .prepare(
      `
      CREATE INDEX IF NOT EXISTS idx_password_resets_user_id
      ON password_resets(user_id)
    `
    )
    .run();

  await db
    .prepare(
      `
      CREATE INDEX IF NOT EXISTS idx_password_resets_token_hash
      ON password_resets(token_hash)
    `
    )
    .run();

  await db
    .prepare(
      `
      CREATE INDEX IF NOT EXISTS idx_password_resets_expires_at
      ON password_resets(expires_at)
    `
    )
    .run();
}

export function generatePasswordResetToken() {
  return `${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '')}`;
}

export function getPasswordResetExpiry(now = Math.floor(Date.now() / 1000)) {
  return now + RESET_TOKEN_TTL_SECONDS;
}

export async function hasEmailNormalizedColumn(db: App.Platform['env']['DB']) {
  return hasColumn(db, 'users', 'email_normalized');
}

export async function findUserByEmail(db: App.Platform['env']['DB'], email: string) {
  const hasNormalized = await hasEmailNormalizedColumn(db);

  return hasNormalized
    ? db
        .prepare(
          `
          SELECT id, email, display_name, password_hash, COALESCE(is_active, 1) AS is_active
          FROM users
          WHERE email_normalized = ?
          LIMIT 1
        `
        )
        .bind(email)
        .first<{
          id: string;
          email: string;
          display_name: string | null;
          password_hash: string | null;
          is_active: number;
        }>()
    : db
        .prepare(
          `
          SELECT id, email, display_name, password_hash, COALESCE(is_active, 1) AS is_active
          FROM users
          WHERE lower(email) = ?
          LIMIT 1
        `
        )
        .bind(email)
        .first<{
          id: string;
          email: string;
          display_name: string | null;
          password_hash: string | null;
          is_active: number;
        }>();
}

export async function createPasswordResetRecord({
  db,
  userId,
  email,
  tokenHash,
  requestedIp
}: {
  db: App.Platform['env']['DB'];
  userId: string;
  email: string;
  tokenHash: string;
  requestedIp?: string | null;
}) {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = getPasswordResetExpiry(now);

  await db
    .prepare(`DELETE FROM password_resets WHERE expires_at < ? OR COALESCE(used_at, 0) < ?`)
    .bind(now, now - RESET_RECORD_RETENTION_SECONDS)
    .run();

  await db
    .prepare(`UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL`)
    .bind(now, userId)
    .run();

  await db
    .prepare(
      `
      INSERT INTO password_resets (
        id, user_id, email, token_hash, created_at, expires_at, requested_ip
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `
    )
    .bind(crypto.randomUUID(), userId, email, tokenHash, now, expiresAt, requestedIp ?? null)
    .run();

  const record = await db
    .prepare(
      `
      SELECT id
      FROM password_resets
      WHERE token_hash = ?
      LIMIT 1
    `
    )
    .bind(tokenHash)
    .first<{ id: string }>();

  return { id: record?.id ?? null, now, expiresAt };
}

export async function deletePasswordResetRecordById(
  db: App.Platform['env']['DB'],
  resetId: string | null | undefined
) {
  if (!resetId) return;
  await db.prepare(`DELETE FROM password_resets WHERE id = ?`).bind(resetId).run();
}

export async function findValidPasswordResetByTokenHash(
  db: App.Platform['env']['DB'],
  tokenHash: string
) {
  const now = Math.floor(Date.now() / 1000);

  return db
    .prepare(
      `
      SELECT
        pr.id,
        pr.user_id,
        pr.email,
        pr.expires_at,
        pr.used_at,
        u.display_name,
        u.email AS user_email
      FROM password_resets pr
      JOIN users u ON u.id = pr.user_id
      WHERE pr.token_hash = ?
        AND pr.used_at IS NULL
        AND pr.expires_at >= ?
      LIMIT 1
    `
    )
    .bind(tokenHash, now)
    .first<{
      id: string;
      user_id: string;
      email: string;
      expires_at: number;
      used_at: number | null;
      display_name: string | null;
      user_email: string;
    }>();
}

export function genericResetRequestSuccess() {
  return {
    notice: 'If that email exists in the system, a reset link has been sent.'
  };
}

export function validateNewPassword(password: string, confirmPassword: string) {
  if (!password || !confirmPassword) {
    return fail(400, { error: 'Enter and confirm the new password.' });
  }

  if (password.length < 10) {
    return fail(400, { error: 'Password must be at least 10 characters.' });
  }

  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return fail(400, { error: 'Password must include letters and numbers.' });
  }

  if (password !== confirmPassword) {
    return fail(400, { error: 'Passwords do not match.' });
  }

  return null;
}
