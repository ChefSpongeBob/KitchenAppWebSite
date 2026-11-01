import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';
import {
  generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse,
  type AuthenticationResponseJSON, type RegistrationResponseJSON
} from '@simplewebauthn/server';
import { loadStaffStepUp, STAFF_STEP_UP_SECONDS, type PlatformStaff } from './platformStaff';

type DB = App.Platform['env']['DB'];
type KeyRow = { credential_id: string; public_key: string; counter: number; name: string; created_at: number; last_used_at: number | null };

export function staffPasskeyOrigin(url: URL, baseUrl: string | undefined) {
  if (dev && url.hostname === 'localhost' && url.protocol === 'http:') return { origin: url.origin, rpID: 'localhost' };
  let configured: URL;
  try { configured = new URL(baseUrl ?? ''); } catch { error(503, 'Staff passkey domain is not configured.'); }
  if (configured.protocol !== 'https:' || configured.origin !== url.origin) error(400, 'Open staff tools on the configured Crimini domain to use passkeys.');
  return { origin: configured.origin, rpID: configured.hostname };
}

export async function staffPasswordConfirmed(db: DB, userId: string, sessionId: string, now = Math.floor(Date.now() / 1000)) {
  return db.prepare(`SELECT p.membership_revision FROM platform_staff_step_up p
    JOIN platform_staff_members m ON m.user_id = p.user_id AND m.revision = p.membership_revision
    JOIN sessions s ON s.id = p.session_id AND s.user_id = p.user_id JOIN users u ON u.id = p.user_id
    WHERE p.session_id = ? AND p.user_id = ? AND p.verified_at > ? AND p.verified_at <= ?
      AND m.is_active = 1 AND COALESCE(u.is_active, 1) = 1 AND s.revoked_at IS NULL AND s.expires_at > ? LIMIT 1`)
    .bind(sessionId, userId, now - STAFF_STEP_UP_SECONDS, now, now).first<{ membership_revision: number }>();
}

export async function listStaffPasskeys(db: DB, userId: string, rpID: string) {
  const rows = await db.prepare(`SELECT credential_id, name, created_at, last_used_at FROM platform_staff_passkeys
    WHERE user_id = ? AND rp_id = ? ORDER BY created_at, credential_id LIMIT 5`).bind(userId, rpID)
    .all<Pick<KeyRow, 'credential_id' | 'name' | 'created_at' | 'last_used_at'>>();
  return rows.results;
}

export async function beginStaffPasskey(db: DB, staff: PlatformStaff, sessionId: string, relyingParty: { origin: string; rpID: string }, purpose: 'register' | 'authenticate') {
  const now = Math.floor(Date.now() / 1000);
  const proof = await staffPasswordConfirmed(db, staff.userId, sessionId, now);
  if (!proof) error(403, 'Confirm your password first.');
  const keys = await listStaffPasskeys(db, staff.userId, relyingParty.rpID);
  if (purpose === 'register' && keys.length && !await loadStaffStepUp(db, staff.userId, sessionId)) error(403, 'Verify an existing passkey first.');
  if (purpose === 'register' && keys.length >= 5) error(400, 'Remove a passkey before adding another.');
  if (purpose === 'authenticate' && !keys.length) error(400, 'Add your first passkey.');
  const options = purpose === 'register'
    ? await generateRegistrationOptions({ rpName: 'Crimini Staff', rpID: relyingParty.rpID,
      userName: staff.userId, userID: new TextEncoder().encode(staff.userId), attestationType: 'none',
      excludeCredentials: keys.map(key => ({ id: key.credential_id })), supportedAlgorithmIDs: [-7, -257],
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' } })
    : await generateAuthenticationOptions({ rpID: relyingParty.rpID, userVerification: 'required',
      allowCredentials: keys.map(key => ({ id: key.credential_id })) });
  const result = await db.prepare(`INSERT INTO platform_staff_challenges
      (session_id, user_id, membership_revision, purpose, challenge, rp_id, expires_at)
    SELECT ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM platform_staff_step_up p
      JOIN platform_staff_members m ON m.user_id = p.user_id AND m.revision = p.membership_revision
      JOIN sessions s ON s.id = p.session_id AND s.user_id = p.user_id JOIN users u ON u.id = p.user_id
      WHERE p.session_id = ? AND p.user_id = ? AND p.membership_revision = ? AND p.verified_at > ?
        AND m.is_active = 1 AND COALESCE(u.is_active, 1) = 1 AND s.revoked_at IS NULL AND s.expires_at > ?)
    ON CONFLICT(session_id) DO UPDATE SET membership_revision = excluded.membership_revision,
      purpose = excluded.purpose, challenge = excluded.challenge, rp_id = excluded.rp_id, expires_at = excluded.expires_at`)
    .bind(sessionId, staff.userId, proof.membership_revision, purpose, options.challenge, relyingParty.rpID, now + 300,
      sessionId, staff.userId, proof.membership_revision, now - STAFF_STEP_UP_SECONDS, now).run();
  if (result.meta.changes !== 1) error(409, 'Staff access changed. Confirm your password again.');
  return options;
}

function encode(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function decode(value: string) { return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0)); }

export async function finishStaffPasskey(db: DB, staff: PlatformStaff, sessionId: string,
  relyingParty: { origin: string; rpID: string }, purpose: 'register' | 'authenticate',
  response: RegistrationResponseJSON | AuthenticationResponseJSON, name = 'Passkey') {
  const now = Math.floor(Date.now() / 1000);
  const proof = await staffPasswordConfirmed(db, staff.userId, sessionId, now);
  if (!proof) error(403, 'Confirm your password first.');
  const challenge = await db.prepare(`SELECT challenge FROM platform_staff_challenges WHERE session_id = ? AND user_id = ?
      AND membership_revision = ? AND purpose = ? AND rp_id = ? AND expires_at > ? LIMIT 1`)
    .bind(sessionId, staff.userId, proof.membership_revision, purpose, relyingParty.rpID, now).first<{ challenge: string }>();
  if (!challenge) error(400, 'Passkey request expired. Try again.');
  const consume = db.prepare(`DELETE FROM platform_staff_challenges WHERE session_id = ? AND user_id = ?
    AND challenge = ? AND purpose = ? AND rp_id = ? AND expires_at > ? AND membership_revision = ?
    AND EXISTS (SELECT 1 FROM platform_staff_step_up p JOIN platform_staff_members m
      ON m.user_id = p.user_id AND m.revision = p.membership_revision JOIN users u ON u.id = p.user_id
      JOIN sessions s ON s.id = p.session_id AND s.user_id = p.user_id
      WHERE p.session_id = ? AND p.user_id = ? AND p.membership_revision = ? AND p.verified_at > ?
        AND m.is_active = 1 AND COALESCE(u.is_active,1) = 1 AND s.revoked_at IS NULL AND s.expires_at > ?)`)
    .bind(sessionId, staff.userId, challenge.challenge, purpose, relyingParty.rpID, now, proof.membership_revision,
      sessionId, staff.userId, proof.membership_revision, now - STAFF_STEP_UP_SECONDS, now);
  let mutation;
  if (purpose === 'register') {
    const keys = await listStaffPasskeys(db, staff.userId, relyingParty.rpID);
    const verifiedExisting = Boolean(await loadStaffStepUp(db, staff.userId, sessionId));
    if (keys.length && !verifiedExisting) error(403, 'Verify an existing passkey first.');
    const result = await verifyRegistrationResponse({ response: response as RegistrationResponseJSON,
      expectedChallenge: challenge.challenge, expectedOrigin: relyingParty.origin, expectedRPID: relyingParty.rpID,
      requireUserVerification: true, supportedAlgorithmIDs: [-7, -257] });
    if (!result.verified) error(400, 'Passkey could not be verified.');
    const credential = result.registrationInfo.credential;
    mutation = db.prepare(`INSERT INTO platform_staff_passkeys (credential_id,user_id,rp_id,public_key,counter,name,created_at,last_used_at)
      SELECT ?,?,?,?,?,?,?,? WHERE changes() = 1
        AND (SELECT COUNT(*) FROM platform_staff_passkeys WHERE user_id = ? AND rp_id = ?) < 5
        AND (? = 1 OR NOT EXISTS (SELECT 1 FROM platform_staff_passkeys WHERE user_id = ? AND rp_id = ?))`)
      .bind(credential.id, staff.userId, relyingParty.rpID, encode(credential.publicKey), credential.counter,
        String(name).trim().slice(0, 60) || 'Passkey', now, now, staff.userId, relyingParty.rpID,
        verifiedExisting ? 1 : 0, staff.userId, relyingParty.rpID);
  } else {
    const credential = await db.prepare(`SELECT credential_id,public_key,counter FROM platform_staff_passkeys
      WHERE credential_id = ? AND user_id = ? AND rp_id = ? LIMIT 1`).bind(response.id, staff.userId, relyingParty.rpID)
      .first<Pick<KeyRow, 'credential_id' | 'public_key' | 'counter'>>();
    if (!credential) error(400, 'Passkey could not be verified.');
    const result = await verifyAuthenticationResponse({ response: response as AuthenticationResponseJSON,
      expectedChallenge: challenge.challenge, expectedOrigin: relyingParty.origin, expectedRPID: relyingParty.rpID,
      requireUserVerification: true,
      credential: { id: credential.credential_id, publicKey: decode(credential.public_key), counter: credential.counter } });
    if (!result.verified) error(400, 'Passkey could not be verified.');
    mutation = db.prepare(`UPDATE platform_staff_passkeys SET counter = ?, last_used_at = ?
      WHERE credential_id = ? AND user_id = ? AND rp_id = ? AND counter = ? AND changes() = 1`)
      .bind(result.authenticationInfo.newCounter, now, credential.credential_id, staff.userId, relyingParty.rpID, credential.counter);
  }
  const results = await db.batch([
    consume, mutation,
    db.prepare(`UPDATE platform_staff_step_up SET passkey_verified_at = ? WHERE session_id = ? AND user_id = ?
      AND membership_revision = ? AND verified_at > ? AND changes() = 1
      AND EXISTS (SELECT 1 FROM platform_staff_members m JOIN users u ON u.id = m.user_id
        JOIN sessions s ON s.user_id = m.user_id WHERE m.user_id = ? AND m.revision = ? AND m.is_active = 1
          AND COALESCE(u.is_active,1) = 1 AND s.id = ? AND s.revoked_at IS NULL AND s.expires_at > ?)`)
      .bind(now, sessionId, staff.userId, proof.membership_revision, now - STAFF_STEP_UP_SECONDS,
        staff.userId, proof.membership_revision, sessionId, now),
    db.prepare(`INSERT INTO platform_staff_audit (id,actor_user_id,target_user_id,action,reason,created_at)
      SELECT ?,?,?,?,?,? WHERE changes() = 1`).bind(crypto.randomUUID(), staff.userId, staff.userId,
        purpose === 'register' ? 'staff_passkey_added' : 'staff_passkey_verified', 'Staff passkey verification', now)
  ]);
  if (results[2].meta.changes !== 1) error(409, 'Passkey request changed. Confirm your password and try again.');
}

export async function removeStaffPasskey(db: DB, staff: PlatformStaff, sessionId: string, rpID: string, credentialId: string) {
  if (!await loadStaffStepUp(db, staff.userId, sessionId)) error(403, 'Confirm your password and passkey first.');
  const now = Math.floor(Date.now() / 1000);
  const auditId = crypto.randomUUID();
  const results = await db.batch([
    db.prepare(`DELETE FROM platform_staff_passkeys WHERE credential_id = ? AND user_id = ? AND rp_id = ?
      AND (SELECT COUNT(*) FROM platform_staff_passkeys WHERE user_id = ? AND rp_id = ?) > 1
      AND EXISTS (SELECT 1 FROM platform_staff_step_up p JOIN platform_staff_members m
        ON m.user_id = p.user_id AND m.revision = p.membership_revision JOIN users u ON u.id = m.user_id
        JOIN sessions s ON s.id = p.session_id AND s.user_id = p.user_id
        WHERE p.session_id = ? AND p.user_id = ? AND p.verified_at > ? AND p.passkey_verified_at > ?
          AND m.is_active = 1 AND COALESCE(u.is_active,1) = 1 AND s.revoked_at IS NULL AND s.expires_at > ?)`)
      .bind(credentialId, staff.userId, rpID, staff.userId, rpID, sessionId, staff.userId, now - STAFF_STEP_UP_SECONDS, now - STAFF_STEP_UP_SECONDS, now),
    db.prepare(`INSERT INTO platform_staff_audit (id,actor_user_id,target_user_id,action,reason,created_at)
      SELECT ?,?,?,'staff_passkey_removed','Staff passkey removed',? WHERE changes() = 1`).bind(auditId, staff.userId, staff.userId, now),
    db.prepare(`DELETE FROM platform_staff_step_up WHERE user_id = ? AND EXISTS (SELECT 1 FROM platform_staff_audit WHERE id = ?)`)
      .bind(staff.userId, auditId),
    db.prepare(`DELETE FROM platform_staff_challenges WHERE user_id = ? AND EXISTS (SELECT 1 FROM platform_staff_audit WHERE id = ?)`)
      .bind(staff.userId, auditId)
  ]);
  if (results[0].meta.changes !== 1) error(409, 'Keep at least one passkey. Refresh and try again.');
}
