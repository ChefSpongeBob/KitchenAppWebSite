import { fail } from '@sveltejs/kit';
import { hashedAuditValue } from '$lib/server/security';

type D1 = App.Platform['env']['DB'];

export const HR_SENSITIVE_PERMISSION = 'hr_sensitive_access';
export const SENSITIVE_ENCRYPTION_ALGORITHM = 'AES-GCM-256';

type SensitiveEnv = Partial<App.Platform['env']>;

export type SensitivePayloadContext = {
  businessId: string;
  userId: string;
  recordScope: string;
  recordType: string;
};

export type EncryptedSensitivePayload = {
  encryptedPayload: string;
  payloadIv: string;
  payloadTag: string;
  keyVersion: string;
  encryptionAlgorithm: string;
};

const sensitiveFormKeys = new Set(['personal_information', 'emergency_contact', 'payroll_setup']);

function normalizeBase64(value: string) {
  const normalized = value.trim().replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4;
  return padding ? `${normalized}${'='.repeat(4 - padding)}` : normalized;
}

function base64Encode(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64Decode(value: string) {
  const binary = atob(normalizeBase64(value));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function sha256Bytes(input: Uint8Array) {
  const copy = new Uint8Array(input.length);
  copy.set(input);
  const digest = await crypto.subtle.digest('SHA-256', copy.buffer);
  return new Uint8Array(digest);
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function readSensitiveKey(env?: SensitiveEnv) {
  return env?.SENSITIVE_DATA_KEY?.trim() ?? '';
}

export function isSensitiveEncryptionConfigured(env?: SensitiveEnv) {
  return readSensitiveKey(env).length >= 32;
}

export function isSensitiveOnboardingFormKey(formKey: string | null | undefined) {
  return sensitiveFormKeys.has(String(formKey ?? '').trim().toLowerCase());
}

async function importSensitiveKey(env?: SensitiveEnv) {
  const secret = readSensitiveKey(env);
  if (secret.length < 32) {
    throw new Error('SENSITIVE_DATA_KEY must be set before storing sensitive employee records.');
  }

  let sourceBytes: Uint8Array;
  try {
    const decoded = base64Decode(secret);
    sourceBytes = decoded.length >= 32 ? decoded : new TextEncoder().encode(secret);
  } catch {
    sourceBytes = new TextEncoder().encode(secret);
  }

  const keyBytes = await sha256Bytes(sourceBytes);
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  const keyVersion = env?.SENSITIVE_DATA_KEY_VERSION?.trim() || toHex(keyBytes).slice(0, 16);
  return { key, keyVersion };
}

function aadFor(context: SensitivePayloadContext) {
  return new TextEncoder().encode(
    JSON.stringify({
      businessId: context.businessId,
      userId: context.userId,
      recordScope: context.recordScope,
      recordType: context.recordType
    })
  );
}

export async function encryptSensitiveJsonPayload(
  env: SensitiveEnv | undefined,
  payload: Record<string, unknown>,
  context: SensitivePayloadContext
): Promise<EncryptedSensitivePayload> {
  const { key, keyVersion } = await importSensitiveKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: aadFor(context)
    },
    key,
    plaintext
  );

  return {
    encryptedPayload: base64Encode(new Uint8Array(ciphertext)),
    payloadIv: base64Encode(iv),
    payloadTag: '',
    keyVersion,
    encryptionAlgorithm: SENSITIVE_ENCRYPTION_ALGORITHM
  };
}

export async function decryptSensitiveJsonPayload<T extends Record<string, unknown> = Record<string, unknown>>(
  env: SensitiveEnv | undefined,
  encrypted: {
    encrypted_payload: string;
    payload_iv: string;
    key_version: string;
    encryption_algorithm: string;
  },
  context: SensitivePayloadContext
): Promise<T | null> {
  if (!encrypted.encrypted_payload || !encrypted.payload_iv) return null;
  const { key } = await importSensitiveKey(env);
  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: base64Decode(encrypted.payload_iv),
      additionalData: aadFor(context)
    },
    key,
    base64Decode(encrypted.encrypted_payload)
  );
  return JSON.parse(new TextDecoder().decode(decrypted)) as T;
}

export function sensitiveConfigurationFailure() {
  return fail(503, {
    error: 'Sensitive employee record encryption is not configured.'
  });
}

export async function canAccessEmployeeSensitiveData(
  db: D1,
  businessId: string,
  actorUserId: string | null | undefined,
  actorBusinessRole: string | null | undefined,
  targetUserId?: string | null
) {
  if (!actorUserId || !businessId) return false;
  if (targetUserId && actorUserId === targetUserId) return true;

  const normalizedRole = String(actorBusinessRole ?? '').trim().toLowerCase();
  if (normalizedRole === 'owner' || normalizedRole === 'admin') return true;

  const permission = await db
    .prepare(
      `
      SELECT is_enabled
      FROM employee_role_permissions
      WHERE business_id = ?
        AND user_id = ?
        AND permission_key = ?
      LIMIT 1
      `
    )
    .bind(businessId, actorUserId, HR_SENSITIVE_PERMISSION)
    .first<{ is_enabled: number }>();

  return permission?.is_enabled === 1;
}

export async function writeSensitiveRecordAudit(
  db: D1,
  {
    businessId,
    userId,
    vaultRecordId,
    actorUserId,
    action,
    request,
    metadata = {}
  }: {
    businessId: string;
    userId: string;
    vaultRecordId?: string | null;
    actorUserId?: string | null;
    action: string;
    request?: Request;
    metadata?: Record<string, unknown>;
  }
) {
  const now = Math.floor(Date.now() / 1000);
  const ip =
    request?.headers.get('cf-connecting-ip') ??
    request?.headers.get('x-real-ip') ??
    request?.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    null;
  const userAgent = request?.headers.get('user-agent') ?? null;

  await db
    .prepare(
      `
      INSERT INTO employee_sensitive_record_audit (
        id,
        business_id,
        user_id,
        vault_record_id,
        actor_user_id,
        action,
        ip_hash,
        user_agent_hash,
        metadata_json,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .bind(
      crypto.randomUUID(),
      businessId,
      userId,
      vaultRecordId ?? null,
      actorUserId ?? null,
      action,
      await hashedAuditValue(ip),
      await hashedAuditValue(userAgent),
      JSON.stringify(metadata),
      now
    )
    .run();
}
