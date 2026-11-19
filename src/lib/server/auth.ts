import { scrypt } from 'node:crypto';
import { previousSecretVersions } from '#lib/server/secretVersions.ts';

const PASSWORD_SCHEME = 'scrypt_peppered';
const PREVIOUS_PASSWORD_SCHEME = 'pbkdf2_sha256_peppered';
const LEGACY_PASSWORD_SCHEME = 'pbkdf2_sha256';
const MIN_PBKDF2_ITERATIONS = 100_000;
const MAX_PBKDF2_ITERATIONS = 100_000;
const MAX_LEGACY_PBKDF2_ITERATIONS = 1_200_000;
const PASSWORD_KEY_BYTES = 32;
const PASSWORD_SALT_BYTES = 16;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 5;
const SCRYPT_MAX_MEMORY = 24 * 1024 * 1024;
const LOCAL_DEV_PASSWORD_PEPPER = 'crimini-local-development-password-pepper';

type PasswordEnv = Partial<Pick<App.RuntimeEnv, 'PASSWORD_PEPPER' | 'PASSWORD_PEPPER_VERSION' | 'PASSWORD_PREVIOUS_PEPPERS'>>;

function toHex(bytes: Uint8Array): string {
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

function fromHex(hex: string): Uint8Array {
	if (hex.length % 2 !== 0) throw new Error('Invalid hex input');
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < hex.length; i += 2) {
		bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
	}
	return bytes;
}

function toExactArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	const buffer = new ArrayBuffer(bytes.byteLength);
	new Uint8Array(buffer).set(bytes);
	return buffer;
}

function nodeEnvValue(key: string) {
	const nodeProcess = (
		globalThis as typeof globalThis & {
			process?: { env?: Record<string, string | undefined> };
		}
	).process;
	return nodeProcess?.env?.[key]?.trim() ?? '';
}

function passwordPepper(env?: PasswordEnv) {
	const configured = env?.PASSWORD_PEPPER?.trim() || nodeEnvValue('PASSWORD_PEPPER');
	if (configured) return configured;
	if (nodeEnvValue('NODE_ENV') === 'development') return LOCAL_DEV_PASSWORD_PEPPER;
	throw new Error('PASSWORD_PEPPER is required.');
}

async function passwordSecrets(env?: PasswordEnv) {
	const current = passwordPepper(env);
	const version = env?.PASSWORD_PEPPER_VERSION?.trim() || nodeEnvValue('PASSWORD_PEPPER_VERSION') || (await sha256Hex(current)).slice(0, 16);
	if (!/^[a-zA-Z0-9._-]{1,64}$/.test(version)) throw new Error('Invalid password pepper version.');
	const previous = previousSecretVersions(env?.PASSWORD_PREVIOUS_PEPPERS ?? nodeEnvValue('PASSWORD_PREVIOUS_PEPPERS'));
	if (previous.has(version) && previous.get(version) !== current) throw new Error('Password pepper versions must be unique.');
	return { current, version, previous };
}

async function scryptHex(password: string, saltHex: string, pepper: string): Promise<string> {
	return new Promise((resolve, reject) => {
		scrypt(`${password}\u0000${pepper}`, fromHex(saltHex), PASSWORD_KEY_BYTES,
			{ N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: SCRYPT_MAX_MEMORY },
			(error, key) => error ? reject(error) : resolve(key.toString('hex')));
	});
}

function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) {
		diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return diff === 0;
}

async function pbkdf2Hex(
	password: string,
	saltHex: string,
	iterations: number,
	pepper?: string
): Promise<string> {
	const passwordMaterial = pepper ? `${password}\u0000${pepper}` : password;
	const passwordBytes = new TextEncoder().encode(passwordMaterial);
	const saltBytes = fromHex(saltHex);
	const key = await crypto.subtle.importKey(
		'raw',
		toExactArrayBuffer(passwordBytes),
		'PBKDF2',
		false,
		['deriveBits']
	);
	const bits = await crypto.subtle.deriveBits(
		{
			name: 'PBKDF2',
			hash: 'SHA-256',
			salt: toExactArrayBuffer(saltBytes),
			iterations
		},
		key,
		PASSWORD_KEY_BYTES * 8
	);
	return toHex(new Uint8Array(bits));
}

export async function sha256Hex(input: string): Promise<string> {
	const data = new TextEncoder().encode(input);
	const digest = await crypto.subtle.digest('SHA-256', data);
	return toHex(new Uint8Array(digest));
}

export async function hashPassword(password: string, env?: PasswordEnv): Promise<string> {
	const secrets = await passwordSecrets(env);
	const salt = crypto.getRandomValues(new Uint8Array(PASSWORD_SALT_BYTES));
	const saltHex = toHex(salt);
	const hashHex = await scryptHex(password, saltHex, secrets.current);
	return `${PASSWORD_SCHEME}$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${secrets.version}$${saltHex}$${hashHex}`;
}

async function tryUpgradePasswordHash(
	password: string,
	env?: PasswordEnv
): Promise<string | undefined> {
	try {
		return await hashPassword(password, env);
	} catch {
		return undefined;
	}
}

export async function verifyPassword(password: string, storedHash: string, env?: PasswordEnv): Promise<{
	valid: boolean;
	needsRehash: boolean;
	upgradedHash?: string;
}> {
	const invalid = { valid: false, needsRehash: false };
	try {
		const secrets = await passwordSecrets(env);
		const parts = storedHash.split('$');
		if (parts[0] === PASSWORD_SCHEME) {
			if (parts.length !== 7 || parts[1] !== String(SCRYPT_N) || parts[2] !== String(SCRYPT_R) ||
				parts[3] !== String(SCRYPT_P) || !/^[0-9a-f]{32}$/.test(parts[5]) || !/^[0-9a-f]{64}$/.test(parts[6])) return invalid;
			const pepper = parts[4] === secrets.version ? secrets.current : secrets.previous.get(parts[4]);
			if (!pepper || !timingSafeEqual(await scryptHex(password, parts[5], pepper), parts[6])) return invalid;
			const upgradedHash = parts[4] !== secrets.version ? await tryUpgradePasswordHash(password, env) : undefined;
			return { valid: true, needsRehash: Boolean(upgradedHash), upgradedHash };
		}
		if (parts[0] === PREVIOUS_PASSWORD_SCHEME || parts[0] === LEGACY_PASSWORD_SCHEME) {
			const iterations = Number(parts[1]);
			if (parts.length !== 4 || !Number.isInteger(iterations) || iterations < MIN_PBKDF2_ITERATIONS ||
				iterations > (parts[0] === PREVIOUS_PASSWORD_SCHEME ? MAX_PBKDF2_ITERATIONS : MAX_LEGACY_PBKDF2_ITERATIONS) ||
				!/^[0-9a-f]{32}$/.test(parts[2]) || !/^[0-9a-f]{64}$/.test(parts[3])) return invalid;
			const peppers = parts[0] === PREVIOUS_PASSWORD_SCHEME ? [secrets.current, ...secrets.previous.values()] : [undefined];
			let valid = false;
			for (const pepper of new Set(peppers)) {
				if (timingSafeEqual(await pbkdf2Hex(password, parts[2], iterations, pepper), parts[3])) { valid = true; break; }
			}
			if (!valid) return invalid;
		} else if (!/^[0-9a-f]{64}$/.test(storedHash) || !timingSafeEqual(await sha256Hex(password), storedHash)) {
			return invalid;
		}
		const upgradedHash = await tryUpgradePasswordHash(password, env);
		return { valid: true, needsRehash: Boolean(upgradedHash), upgradedHash };
	} catch { return invalid; }
}

export async function hashSessionToken(token: string): Promise<string> {
	return sha256Hex(token);
}
