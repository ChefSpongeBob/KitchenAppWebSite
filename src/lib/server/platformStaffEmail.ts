import { error } from '@sveltejs/kit';
import { hashSessionToken, verifyPassword } from '#lib/server/auth.ts';
import { isEmailConfigured, renderCriminiEmail, sendTransactionalEmail } from '#lib/server/email.ts';
import { STAFF_STEP_UP_SECONDS } from '#lib/server/platformStaff.ts';
import { checkRateLimit } from '#lib/server/security.ts';

type DB = App.RuntimeEnv['DB'];
type Purpose = 'sign_in' | 'change_email';
type Identity = { email: string; password_hash: string; revision: number; session_token_hash: string; expires_at: number };
type Challenge = { challenge_id: string; purpose: Purpose; source_email: string; recipient_email: string;
  membership_revision: number; session_token_hash: string; expires_at: number; primary_expires_at: number;
  attempts: number; sent_at: number | null };
const CODE_SECONDS = 10 * 60;

export function staffEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) error(400, 'Enter a valid email address.');
  return email;
}

export function maskStaffEmail(email: string) {
  const [name, domain] = email.split('@');
  return `${name.slice(0, 1)}***@${domain}`;
}

export async function staffEmailIdentity(db: DB, userId: string, sessionId: string, now = Math.floor(Date.now() / 1000)) {
  return db.prepare(`SELECT lower(trim(COALESCE(m.otp_email, u.email))) AS email,
      u.password_hash, m.revision, s.session_token_hash, s.expires_at
    FROM platform_staff_members m JOIN users u ON u.id = m.user_id JOIN sessions s ON s.user_id = u.id
    WHERE m.user_id = ? AND s.id = ? AND m.is_active = 1 AND COALESCE(u.is_active, 1) = 1
      AND s.revoked_at IS NULL AND s.expires_at > ? LIMIT 1`)
    .bind(userId, sessionId, now).first<Identity>();
}

export async function pendingStaffEmailChallenge(db: DB, userId: string, sessionId: string) {
  const row = await db.prepare(`SELECT challenge_id, purpose, recipient_email, expires_at
    FROM platform_staff_email_challenges WHERE user_id = ? AND session_id = ?
      AND sent_at IS NOT NULL AND expires_at > ? AND attempts < 5 LIMIT 1`)
    .bind(userId, sessionId, Math.floor(Date.now() / 1000))
    .first<{ challenge_id: string; purpose: Purpose; recipient_email: string; expires_at: number }>();
  return row ? { id: row.challenge_id, purpose: row.purpose, email: maskStaffEmail(row.recipient_email) } : null;
}

async function codeHash(env: App.RuntimeEnv, userId: string, sessionId: string, challengeId: string, code: string) {
  if (!env.PASSWORD_PEPPER?.trim()) error(503, 'Staff verification is unavailable.');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.PASSWORD_PEPPER),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const result = await crypto.subtle.sign('HMAC', key,
    new TextEncoder().encode(JSON.stringify(['crimini-staff-email-v1', userId, sessionId, challengeId, code])));
  return Array.from(new Uint8Array(result), byte => byte.toString(16).padStart(2, '0')).join('');
}

const LIVE_CHALLENGE_SQL = `EXISTS (SELECT 1 FROM platform_staff_members m JOIN users u ON u.id = m.user_id
  JOIN sessions s ON s.user_id = u.id WHERE m.user_id = platform_staff_email_challenges.user_id
    AND s.id = platform_staff_email_challenges.session_id AND m.is_active = 1 AND COALESCE(u.is_active, 1) = 1
    AND m.revision = platform_staff_email_challenges.membership_revision AND s.revoked_at IS NULL
    AND s.expires_at > ? AND s.session_token_hash = platform_staff_email_challenges.session_token_hash
    AND lower(trim(COALESCE(m.otp_email, u.email))) = platform_staff_email_challenges.source_email)`;

export async function beginStaffEmailChallenge(locals: App.Locals, password: string, purpose: Purpose, newEmail?: string) {
  if (!locals.userId || !locals.sessionId) error(401, 'Sign in again.');
  if (!isEmailConfigured(locals.env)) error(503, 'Verification email is unavailable. Try again shortly.');
  const now = Math.floor(Date.now() / 1000);
  const row = await staffEmailIdentity(locals.DB, locals.userId, locals.sessionId, now);
  if (!row?.password_hash) error(401, 'Sign in again.');
  const limit = await checkRateLimit(locals.DB, { action: 'staff-email-code-send', identifier: locals.userId,
    limit: 5, windowSeconds: 900, blockSeconds: 900 });
  if (!limit.allowed) error(429, 'Please wait before trying staff verification again.');
  // Sign-in already authenticated the primary session; only changing the factor needs another password check.
  if (purpose === 'change_email') {
    if (!password || password.length > 1024) error(400, 'Enter your password.');
    let valid = false;
    try { valid = (await verifyPassword(password, row.password_hash, locals.env)).valid; }
    catch { error(503, 'Staff verification is unavailable. Try again shortly.'); }
    if (!valid) error(400, 'Password could not be confirmed.');
  }
  const sourceEmail = staffEmail(row.email);
  const recipient = purpose === 'change_email' ? staffEmail(newEmail ?? '') : sourceEmail;
  if (purpose === 'change_email' && recipient === sourceEmail) error(400, 'Enter a different email address.');
  const id = crypto.randomUUID();
  // Rejection sampling avoids modulo bias in the six-digit code.
  const random = new Uint32Array(1);
  do { crypto.getRandomValues(random); } while (random[0] >= 4_294_000_000);
  const code = String(random[0] % 1_000_000).padStart(6, '0');
  const digest = await codeHash(locals.env, locals.userId, locals.sessionId, id, code);
  const results = await locals.DB.batch([
    locals.DB.prepare(`DELETE FROM platform_staff_email_challenges WHERE session_id IN
      (SELECT session_id FROM platform_staff_email_challenges WHERE expires_at <= ? ORDER BY expires_at LIMIT 100)`)
      .bind(now),
    locals.DB.prepare(`INSERT INTO platform_staff_email_challenges
      (session_id, user_id, challenge_id, membership_revision, session_token_hash, purpose, source_email,
        recipient_email, code_hash, created_at, expires_at)
      SELECT s.id, u.id, ?, m.revision, s.session_token_hash, ?, ?, ?, ?, ?, ?
      FROM platform_staff_members m JOIN users u ON u.id = m.user_id JOIN sessions s ON s.user_id = u.id
      WHERE m.user_id = ? AND s.id = ? AND m.is_active = 1 AND COALESCE(u.is_active, 1) = 1
        AND m.revision = ? AND u.password_hash = ? AND s.session_token_hash = ? AND s.revoked_at IS NULL
        AND s.expires_at > ? AND lower(trim(COALESCE(m.otp_email, u.email))) = ?
        AND NOT EXISTS (SELECT 1 FROM platform_staff_email_challenges WHERE user_id = m.user_id AND created_at > ?)
        AND (? = 'sign_in' OR EXISTS (SELECT 1 FROM platform_staff_step_up p WHERE p.session_id = s.id
          AND p.user_id = m.user_id AND p.membership_revision = m.revision
          AND p.email_verified_at = p.verified_at AND p.verified_at > ? AND p.verified_at <= ?))
      ON CONFLICT(session_id) DO UPDATE SET challenge_id = excluded.challenge_id,
        membership_revision = excluded.membership_revision, session_token_hash = excluded.session_token_hash,
        purpose = excluded.purpose, source_email = excluded.source_email, recipient_email = excluded.recipient_email,
        code_hash = excluded.code_hash, created_at = excluded.created_at, expires_at = excluded.expires_at,
        sent_at = NULL, attempts = 0`)
      .bind(id, purpose, sourceEmail, recipient, digest, now, now + CODE_SECONDS, locals.userId, locals.sessionId,
        row.revision, row.password_hash, row.session_token_hash, now, sourceEmail, now - 60, purpose, now - STAFF_STEP_UP_SECONDS, now)
  ]);
  if (results[1].meta.changes !== 1) error(429, 'Wait a minute before requesting another code, or verify your staff access again.');
  const body = `Your Crimini staff verification code is ${code}. It expires in 10 minutes. Do not share this code.`;
  const delivery = await sendTransactionalEmail({ env: locals.env, to: recipient, subject: 'Crimini staff verification code',
    html: renderCriminiEmail({ title: 'Your verification code', body }), text: body, idempotencyKey: `staff-code-${id}`, sensitive: true });
  if (!delivery.sent) {
    await locals.DB.prepare('DELETE FROM platform_staff_email_challenges WHERE session_id = ? AND challenge_id = ?')
      .bind(locals.sessionId, id).run();
    error(503, 'The code could not be sent. Try again shortly.');
  }
  const sent = await locals.DB.prepare(`UPDATE platform_staff_email_challenges SET sent_at = ?
    WHERE session_id = ? AND challenge_id = ? AND ${LIVE_CHALLENGE_SQL}`)
    .bind(now, locals.sessionId, id, now).run();
  if (sent.meta.changes !== 1) error(409, 'Your staff access changed. Request a new code.');
}

export async function verifyStaffEmailChallenge(locals: App.Locals, challengeId: string, code: string) {
  if (!locals.userId || !locals.sessionId) error(401, 'Sign in again.');
  if (!/^[0-9]{6}$/.test(code) || !/^[a-f0-9-]{36}$/.test(challengeId)) error(400, 'Enter the six-digit code from your email.');
  const now = Math.floor(Date.now() / 1000);
  const row = await locals.DB.prepare(`SELECT c.challenge_id, c.purpose, c.source_email, c.recipient_email,
      c.membership_revision, c.session_token_hash, c.expires_at, s.expires_at AS primary_expires_at, c.attempts, c.sent_at
    FROM platform_staff_email_challenges c JOIN sessions s ON s.id = c.session_id AND s.user_id = c.user_id
    WHERE c.session_id = ? AND c.user_id = ? AND c.challenge_id = ? LIMIT 1`)
    .bind(locals.sessionId, locals.userId, challengeId).first<Challenge>();
  if (!row) error(400, 'Code is invalid or expired. Request a new code.');
  const digest = await codeHash(locals.env, locals.userId, locals.sessionId, challengeId, code);
  const token = crypto.randomUUID() + crypto.randomUUID();
  const hash = await hashSessionToken(token);
  const results = await locals.DB.batch([
    locals.DB.prepare(`UPDATE platform_staff_email_challenges SET attempts = attempts + 1
      WHERE session_id = ? AND user_id = ? AND challenge_id = ? AND sent_at IS NOT NULL
        AND expires_at > ? AND attempts < 5 AND ${LIVE_CHALLENGE_SQL}`)
      .bind(locals.sessionId, locals.userId, challengeId, now, now),
    locals.DB.prepare(`UPDATE sessions SET session_token_hash = ? WHERE changes() = 1 AND id = ? AND user_id = ?
      AND session_token_hash = ? AND revoked_at IS NULL AND expires_at > ?
      AND EXISTS (SELECT 1 FROM platform_staff_email_challenges c WHERE c.session_id = sessions.id
        AND c.challenge_id = ? AND c.code_hash = ? AND c.sent_at IS NOT NULL AND c.expires_at > ? AND c.attempts <= 5
        AND (c.purpose = 'sign_in' OR EXISTS (SELECT 1 FROM platform_staff_step_up p WHERE p.session_id = c.session_id
          AND p.user_id = c.user_id AND p.membership_revision = c.membership_revision
          AND p.email_verified_at = p.verified_at AND p.verified_at > ? AND p.verified_at <= ?)))`)
      .bind(hash, locals.sessionId, locals.userId, row.session_token_hash, now, challengeId, digest, now, now - STAFF_STEP_UP_SECONDS, now),
    ...(row.purpose === 'change_email' ? [locals.DB.prepare(`UPDATE platform_staff_members
      SET otp_email = ?, revision = revision + 1, updated_at = ? WHERE changes() = 1 AND user_id = ? AND revision = ?`)
      .bind(row.recipient_email, now, locals.userId, row.membership_revision)] : []),
    locals.DB.prepare(`INSERT INTO platform_staff_step_up (session_id, user_id, membership_revision, verified_at, email_verified_at)
      SELECT ?, user_id, revision, ?, ? FROM platform_staff_members WHERE changes() = 1 AND user_id = ?
      ON CONFLICT(session_id) DO UPDATE SET membership_revision = excluded.membership_revision,
        verified_at = excluded.verified_at, email_verified_at = excluded.email_verified_at`)
      .bind(locals.sessionId, now, now, locals.userId),
    locals.DB.prepare(`INSERT INTO platform_staff_audit (id, actor_user_id, target_user_id, action, reason, created_at)
      SELECT ?, ?, ?, ?, ?, ? WHERE changes() = 1`)
      .bind(crypto.randomUUID(), locals.userId, locals.userId,
        row.purpose === 'change_email' ? 'staff_verification_email_changed' : 'staff_email_verified',
        row.purpose === 'change_email' ? 'Verified new staff email address' : 'Session email verification', now),
    locals.DB.prepare('DELETE FROM platform_staff_email_challenges WHERE session_id = ? AND challenge_id = ? AND changes() = 1')
      .bind(locals.sessionId, challengeId)
  ]);
  if (results[1].meta.changes !== 1) error(400, 'Code is invalid or expired. Request a new code if needed.');
  if (row.purpose === 'change_email') {
    const body = 'Your Crimini staff verification email was changed. If you did not make this change, contact your Crimini platform owner immediately.';
    // Notification failure must not undo the already committed factor/session change.
    await sendTransactionalEmail({ env: locals.env, to: row.source_email, subject: 'Crimini staff verification email changed',
      html: renderCriminiEmail({ title: 'Verification email changed', body }), text: body, sensitive: true });
  }
  return { token, expiresAt: row.primary_expires_at, emailChanged: row.purpose === 'change_email' };
}
