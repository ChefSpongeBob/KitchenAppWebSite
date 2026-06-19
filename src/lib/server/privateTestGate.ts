import type { Cookies } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { constantTimeTokenEqual } from '$lib/server/requestTokens';

export const PRIVATE_TEST_ACCESS_COOKIE = 'crimini_private_test_access';

const ACCESS_COOKIE_MAX_AGE = 60 * 60 * 12;

type PrivateGateEnv = {
	PRIVATE_TEST_GATE_ENABLED?: string;
	PRIVATE_TEST_ACCESS_CODE?: string;
};

export function isPrivateTestGateEnabled(env: PrivateGateEnv | undefined) {
	return (
		env?.PRIVATE_TEST_GATE_ENABLED?.trim().toLowerCase() === 'true' &&
		Boolean(env?.PRIVATE_TEST_ACCESS_CODE?.trim())
	);
}

export function isPrivateTestGateBypassed(pathname: string) {
	return (
		pathname === '/test-access' ||
		pathname.startsWith('/_app/') ||
		pathname.startsWith('/favicon') ||
		pathname.startsWith('/apple-touch-icon') ||
		pathname.startsWith('/manifest') ||
		pathname.startsWith('/robots') ||
		pathname.startsWith('/api/internal/smoke') ||
		pathname.startsWith('/api/internal/schema-readiness') ||
		pathname.startsWith('/api/internal/operational-events') ||
		pathname.startsWith('/api/internal/temperature-monitoring') ||
		pathname.startsWith('/api/temps') ||
		pathname.startsWith('/api/camera/upload') ||
		pathname.startsWith('/api/camera/activity') ||
		pathname.startsWith('/api/billing/app-store-notifications') ||
		pathname.startsWith('/api/billing/google-play-notifications')
	);
}

async function digestAccessCode(code: string) {
	const encoded = new TextEncoder().encode(`crimini-private-test:${code}`);
	const digest = await crypto.subtle.digest('SHA-256', encoded);
	return Array.from(new Uint8Array(digest))
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');
}

export async function createPrivateTestAccessValue(code: string) {
	return digestAccessCode(code.trim());
}

export async function hasPrivateTestAccess(cookies: Cookies, env: PrivateGateEnv | undefined) {
	if (!isPrivateTestGateEnabled(env)) return true;
	const expected = await createPrivateTestAccessValue(env?.PRIVATE_TEST_ACCESS_CODE ?? '');
	return constantTimeTokenEqual(expected, cookies.get(PRIVATE_TEST_ACCESS_COOKIE));
}

export function privateTestAccessCookieOptions(request: Request) {
	return {
		path: '/',
		httpOnly: true,
		secure: !dev || new URL(request.url).protocol === 'https:',
		sameSite: 'lax' as const,
		maxAge: ACCESS_COOKIE_MAX_AGE
	};
}
