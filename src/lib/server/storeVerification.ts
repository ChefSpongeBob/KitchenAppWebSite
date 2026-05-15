import type { BillingStore } from '$lib/server/storeBilling';

export type StoreVerificationResult = {
	configured: boolean;
	verified: boolean;
	status: 'active' | 'pending' | 'expired' | 'canceled' | 'grace_period' | 'past_due';
	productId?: string;
	currentPeriodStart?: number | null;
	currentPeriodEnd?: number | null;
	autoRenewing?: boolean;
	rawPayload?: unknown;
	error?: string;
};

type Env = App.Platform['env'];

function base64UrlEncode(input: string | ArrayBuffer) {
	const bytes =
		typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecodeJson<T>(input: string): T {
	const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
	const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
	return JSON.parse(atob(padded)) as T;
}

function pemToArrayBuffer(pem: string) {
	const body = pem
		.replace(/-----BEGIN [^-]+-----/g, '')
		.replace(/-----END [^-]+-----/g, '')
		.replace(/\s+/g, '');
	const binary = atob(body);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
	return bytes.buffer;
}

async function signJwt(
	header: Record<string, unknown>,
	payload: Record<string, unknown>,
	keyData: ArrayBuffer,
	algorithm: 'ES256' | 'RS256'
) {
	const encodedHeader = base64UrlEncode(JSON.stringify(header));
	const encodedPayload = base64UrlEncode(JSON.stringify(payload));
	const signingInput = `${encodedHeader}.${encodedPayload}`;
	const key =
		algorithm === 'ES256'
			? await crypto.subtle.importKey(
					'pkcs8',
					keyData,
					{ name: 'ECDSA', namedCurve: 'P-256' },
					false,
					['sign']
				)
			: await crypto.subtle.importKey(
					'pkcs8',
					keyData,
					{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
					false,
					['sign']
				);
	const signature = await crypto.subtle.sign(
		algorithm === 'ES256' ? { name: 'ECDSA', hash: 'SHA-256' } : 'RSASSA-PKCS1-v1_5',
		key,
		new TextEncoder().encode(signingInput)
	);
	return `${signingInput}.${base64UrlEncode(signature)}`;
}

function hasAppleConfig(env: Env) {
	return Boolean(
		env.APP_STORE_BUNDLE_ID?.trim() &&
			env.APP_STORE_ISSUER_ID?.trim() &&
			env.APP_STORE_KEY_ID?.trim() &&
			env.APP_STORE_PRIVATE_KEY?.trim()
	);
}

function hasGoogleConfig(env: Env) {
	return Boolean(env.GOOGLE_PLAY_PACKAGE_NAME?.trim() && env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON?.trim());
}

export function isStoreVerificationConfigured(env: Env, store: BillingStore) {
	return store === 'app_store' ? hasAppleConfig(env) : hasGoogleConfig(env);
}

async function appleToken(env: Env) {
	const now = Math.floor(Date.now() / 1000);
	return signJwt(
		{
			alg: 'ES256',
			kid: env.APP_STORE_KEY_ID,
			typ: 'JWT'
		},
		{
			iss: env.APP_STORE_ISSUER_ID,
			iat: now,
			exp: now + 900,
			aud: 'appstoreconnect-v1',
			bid: env.APP_STORE_BUNDLE_ID
		},
		pemToArrayBuffer(env.APP_STORE_PRIVATE_KEY ?? ''),
		'ES256'
	);
}

async function verifyApplePurchase(
	env: Env,
	args: { productId: string; originalTransactionId?: string | null; transactionId?: string | null }
): Promise<StoreVerificationResult> {
	if (!hasAppleConfig(env)) return { configured: false, verified: false, status: 'pending' };
	const transactionId = args.transactionId || args.originalTransactionId;
	if (!transactionId) {
		return { configured: true, verified: false, status: 'pending', error: 'Missing transaction id.' };
	}

	const baseUrl =
		String(env.APP_STORE_ENVIRONMENT ?? '').toLowerCase() === 'sandbox'
			? 'https://api.storekit-sandbox.itunes.apple.com'
			: 'https://api.storekit.itunes.apple.com';
	const response = await fetch(`${baseUrl}/inApps/v1/transactions/${encodeURIComponent(transactionId)}`, {
		headers: { authorization: `Bearer ${await appleToken(env)}` }
	});
	const payload = (await response.json().catch(() => ({}))) as {
		signedTransactionInfo?: string;
		errorCode?: number;
		errorMessage?: string;
	};

	if (!response.ok || !payload.signedTransactionInfo) {
		return {
			configured: true,
			verified: false,
			status: 'pending',
			rawPayload: payload,
			error: payload.errorMessage ?? 'Apple verification failed.'
		};
	}

	const transaction = base64UrlDecodeJson<{
		productId?: string;
		expiresDate?: number;
		purchaseDate?: number;
		transactionId?: string;
		originalTransactionId?: string;
		revocationDate?: number;
	}>(payload.signedTransactionInfo.split('.')[1]);
	const expiresAt = transaction.expiresDate ? Math.floor(Number(transaction.expiresDate) / 1000) : null;
	const now = Math.floor(Date.now() / 1000);
	const active = !transaction.revocationDate && (!expiresAt || expiresAt > now);

	return {
		configured: true,
		verified: transaction.productId === args.productId && active,
		status: transaction.revocationDate ? 'canceled' : active ? 'active' : 'expired',
		productId: transaction.productId,
		currentPeriodStart: transaction.purchaseDate ? Math.floor(Number(transaction.purchaseDate) / 1000) : null,
		currentPeriodEnd: expiresAt,
		autoRenewing: true,
		rawPayload: { apple: payload, transaction }
	};
}

async function googleAccessToken(env: Env) {
	const serviceAccount = JSON.parse(env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON ?? '{}') as {
		client_email?: string;
		private_key?: string;
		token_uri?: string;
	};
	const now = Math.floor(Date.now() / 1000);
	const jwt = await signJwt(
		{ alg: 'RS256', typ: 'JWT' },
		{
			iss: serviceAccount.client_email,
			scope: 'https://www.googleapis.com/auth/androidpublisher',
			aud: serviceAccount.token_uri ?? 'https://oauth2.googleapis.com/token',
			iat: now,
			exp: now + 3600
		},
		pemToArrayBuffer(serviceAccount.private_key ?? ''),
		'RS256'
	);

	const response = await fetch(serviceAccount.token_uri ?? 'https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
			assertion: jwt
		})
	});
	const payload = (await response.json()) as { access_token?: string; error_description?: string };
	if (!response.ok || !payload.access_token) {
		throw new Error(payload.error_description ?? 'Google auth failed.');
	}
	return payload.access_token;
}

async function acknowledgeGoogleSubscription(
	env: Env,
	accessToken: string,
	productId: string,
	purchaseToken: string
) {
	const packageName = encodeURIComponent(env.GOOGLE_PLAY_PACKAGE_NAME ?? '');
	const subscriptionId = encodeURIComponent(productId);
	const token = encodeURIComponent(purchaseToken);
	await fetch(
		`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${subscriptionId}/tokens/${token}:acknowledge`,
		{
			method: 'POST',
			headers: {
				authorization: `Bearer ${accessToken}`,
				'content-type': 'application/json'
			},
			body: JSON.stringify({})
		}
	).catch(() => undefined);
}

async function verifyGooglePurchase(
	env: Env,
	args: { productId: string; purchaseToken?: string | null }
): Promise<StoreVerificationResult> {
	if (!hasGoogleConfig(env)) return { configured: false, verified: false, status: 'pending' };
	if (!args.purchaseToken) {
		return { configured: true, verified: false, status: 'pending', error: 'Missing purchase token.' };
	}

	const accessToken = await googleAccessToken(env);
	const packageName = encodeURIComponent(env.GOOGLE_PLAY_PACKAGE_NAME ?? '');
	const token = encodeURIComponent(args.purchaseToken);
	const response = await fetch(
		`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptionsv2/tokens/${token}`,
		{ headers: { authorization: `Bearer ${accessToken}` } }
	);
	const payload = (await response.json().catch(() => ({}))) as {
		subscriptionState?: string;
		lineItems?: Array<{ productId?: string; expiryTime?: string; startTime?: string; autoRenewingPlan?: unknown }>;
		error?: { message?: string };
	};

	if (!response.ok) {
		return {
			configured: true,
			verified: false,
			status: 'pending',
			rawPayload: payload,
			error: payload.error?.message ?? 'Google verification failed.'
		};
	}

	const lineItem = payload.lineItems?.find((item) => item.productId === args.productId) ?? payload.lineItems?.[0];
	const state = payload.subscriptionState ?? '';
	const active = state === 'SUBSCRIPTION_STATE_ACTIVE';
	const grace = state === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD';
	const hold = state === 'SUBSCRIPTION_STATE_ON_HOLD';
	const expiresAt = lineItem?.expiryTime ? Math.floor(new Date(lineItem.expiryTime).getTime() / 1000) : null;

	if (active || grace) {
		await acknowledgeGoogleSubscription(env, accessToken, args.productId, args.purchaseToken);
	}

	return {
		configured: true,
		verified: lineItem?.productId === args.productId && (active || grace),
		status: active ? 'active' : grace ? 'grace_period' : hold ? 'past_due' : 'expired',
		productId: lineItem?.productId,
		currentPeriodStart: lineItem?.startTime ? Math.floor(new Date(lineItem.startTime).getTime() / 1000) : null,
		currentPeriodEnd: expiresAt,
		autoRenewing: Boolean(lineItem?.autoRenewingPlan),
		rawPayload: payload
	};
}

export async function verifyStorePurchase(
	env: Env,
	args: {
		store: BillingStore;
		productId: string;
		purchaseToken?: string | null;
		originalTransactionId?: string | null;
		transactionId?: string | null;
	}
) {
	if (args.store === 'app_store') return verifyApplePurchase(env, args);
	return verifyGooglePurchase(env, args);
}
