const PASSWORD_SCHEME = 'pbkdf2_sha256';
const MIN_PBKDF2_ITERATIONS = 100_000;
const PASSWORD_ITERATIONS = 600_000;
const MAX_PBKDF2_ITERATIONS = 1_200_000;
const PASSWORD_KEY_BYTES = 32;
const PASSWORD_SALT_BYTES = 16;

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
	iterations: number
): Promise<string> {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(password),
		'PBKDF2',
		false,
		['deriveBits']
	);
	const bits = await crypto.subtle.deriveBits(
		{
			name: 'PBKDF2',
			hash: 'SHA-256',
			salt: fromHex(saltHex) as unknown as BufferSource,
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

export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(PASSWORD_SALT_BYTES));
	const saltHex = toHex(salt);
	const hashHex = await pbkdf2Hex(password, saltHex, PASSWORD_ITERATIONS);
	return `${PASSWORD_SCHEME}$${PASSWORD_ITERATIONS}$${saltHex}$${hashHex}`;
}

async function tryUpgradePasswordHash(password: string): Promise<string | undefined> {
	try {
		return await hashPassword(password);
	} catch {
		return undefined;
	}
}

export async function verifyPassword(password: string, storedHash: string): Promise<{
	valid: boolean;
	needsRehash: boolean;
	upgradedHash?: string;
}> {
	if (storedHash.startsWith(`${PASSWORD_SCHEME}$`)) {
		const parts = storedHash.split('$');
		if (parts.length !== 4) return { valid: false, needsRehash: false };
		const iterations = Number(parts[1]);
		const saltHex = parts[2];
		const expected = parts[3];
		if (!Number.isFinite(iterations) || iterations < MIN_PBKDF2_ITERATIONS || iterations > MAX_PBKDF2_ITERATIONS) {
			return { valid: false, needsRehash: false };
		}
		try {
			const actual = await pbkdf2Hex(password, saltHex, iterations);
			const valid = timingSafeEqual(actual, expected);
			if (!valid) return { valid: false, needsRehash: false };
			const needsRehash = iterations < PASSWORD_ITERATIONS;
			const upgradedHash = needsRehash ? await tryUpgradePasswordHash(password) : undefined;
			return {
				valid: true,
				needsRehash: Boolean(upgradedHash),
				upgradedHash
			};
		} catch {
			return { valid: false, needsRehash: false };
		}
	}

	const legacy = await sha256Hex(password);
	const valid = timingSafeEqual(legacy, storedHash);
	if (!valid) return { valid: false, needsRehash: false };

	return {
		valid: true,
		needsRehash: true,
		upgradedHash: await tryUpgradePasswordHash(password)
	};
}

export async function hashSessionToken(token: string): Promise<string> {
	return sha256Hex(token);
}
