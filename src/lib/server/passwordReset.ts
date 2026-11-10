import { dev } from '$app/env';
import { fail } from '@sveltejs/kit';
import { hasColumn } from '#lib/server/dbSchema.ts';
import { ACCOUNT_WRITE_RECEIPT, commitAccountMutation } from '#lib/server/authLifecycle.ts';

const RESET_TOKEN_TTL_SECONDS = 2 * 60 * 60;
const RESET_RECORD_RETENTION_SECONDS = 30 * 24 * 60 * 60;
let passwordResetSchemaEnsured = false;

export async function ensurePasswordResetSchema(db: App.RuntimeEnv['DB']) {
  if (!dev) {
    passwordResetSchemaEnsured = true;
    return;
  }
  if (passwordResetSchemaEnsured) return;

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

  passwordResetSchemaEnsured = true;
}

export function generatePasswordResetToken() {
  return `${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '')}`;
}

export function getPasswordResetExpiry(now = Math.floor(Date.now() / 1000)) {
  return now + RESET_TOKEN_TTL_SECONDS;
}

export async function hasEmailNormalizedColumn(db: App.RuntimeEnv['DB']) {
  return hasColumn(db, 'users', 'email_normalized');
}

export async function findUserByEmail(db: App.RuntimeEnv['DB'], email: string) {
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
  db: App.RuntimeEnv['DB'];
  userId: string;
  email: string;
  tokenHash: string;
  requestedIp?: string | null;
}) {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = getPasswordResetExpiry(now);

  const id = crypto.randomUUID();
  const identity = `EXISTS (SELECT 1 FROM users WHERE id = ? AND COALESCE(is_active, 1) = 1
    AND lower(trim(email)) = lower(trim(?)))`;
  const results = await db.batch([
    db.prepare(`DELETE FROM password_resets WHERE id IN (SELECT id FROM password_resets
      WHERE expires_at <= ? OR (used_at IS NOT NULL AND used_at < ?) ORDER BY expires_at LIMIT 100)`)
      .bind(now, now - RESET_RECORD_RETENTION_SECONDS),
    db.prepare(`UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL AND ${identity}`)
      .bind(now, userId, userId, email),
    db.prepare(`
      INSERT INTO password_resets (
        id, user_id, email, token_hash, created_at, expires_at, requested_ip
      )
      SELECT ?, ?, ?, ?, ?, ?, ? WHERE ${identity}`)
      .bind(id, userId, email, tokenHash, now, expiresAt, requestedIp ?? null, userId, email)
  ]);
  if (results[2].meta.changes !== 1) throw new Error('Reset identity changed.');
  return { id, now, expiresAt };
}

export async function deletePasswordResetRecordById(
  db: App.RuntimeEnv['DB'],
  resetId: string | null | undefined
) {
  if (!resetId) return;
  await db.prepare(`DELETE FROM password_resets WHERE id = ?`).bind(resetId).run();
}

export async function findValidPasswordResetByTokenHash(
  db: App.RuntimeEnv['DB'],
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
        u.email AS user_email,
        u.password_hash
      FROM password_resets pr
      JOIN users u ON u.id = pr.user_id
      WHERE pr.token_hash = ?
        AND pr.used_at IS NULL
        AND pr.expires_at > ?
        AND COALESCE(u.is_active, 1) = 1
        AND lower(trim(pr.email)) = lower(trim(u.email))
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
      password_hash: string;
    }>();
}

export async function completePasswordReset(options: {
  db: App.RuntimeEnv['DB'];
  reset: NonNullable<Awaited<ReturnType<typeof findValidPasswordResetByTokenHash>>>;
  tokenHash: string;
  passwordHash: string;
  request: Request;
  getClientAddress?: () => string;
}) {
  const { db, reset } = options;
  const now = Math.floor(Date.now() / 1000);
  return commitAccountMutation(db, {
    action: 'password_reset_completed', userId: reset.user_id, email: reset.user_email,
    request: options.request, getClientAddress: options.getClientAddress, now,
    condition: `EXISTS (SELECT 1 FROM password_resets pr JOIN users u ON u.id = pr.user_id
      WHERE pr.id = ? AND pr.token_hash = ? AND pr.user_id = ? AND pr.used_at IS NULL AND pr.expires_at > ?
        AND COALESCE(u.is_active, 1) = 1 AND u.password_hash = ?
        AND lower(trim(pr.email)) = lower(trim(u.email)) AND u.email = ?)`,
    values: [reset.id, options.tokenHash, reset.user_id, now, reset.password_hash, reset.user_email],
    writes: id => [
      db.prepare(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ? AND ${ACCOUNT_WRITE_RECEIPT}`)
        .bind(options.passwordHash, now, reset.user_id, id),
      db.prepare(`UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL AND ${ACCOUNT_WRITE_RECEIPT}`)
        .bind(now, reset.user_id, id),
      db.prepare(`UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL AND ${ACCOUNT_WRITE_RECEIPT}`)
        .bind(now, reset.user_id, id),
      db.prepare(`UPDATE devices SET revoked_at = ?, updated_at = ? WHERE user_id = ? AND revoked_at IS NULL AND ${ACCOUNT_WRITE_RECEIPT}`)
        .bind(now, now, reset.user_id, id)
    ]
  });
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
