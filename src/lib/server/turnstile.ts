import { isNativeAppRequest } from '#lib/server/authCookies.ts';

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TURNSTILE_TIMEOUT_MS = 4500;

export function getTurnstileSiteKey(env?: Partial<App.RuntimeEnv> | null) {
	return String(env?.TURNSTILE_SITE_KEY ?? '').trim();
}

export function isTurnstileConfigured(env?: Partial<App.RuntimeEnv> | null) {
	return Boolean(getTurnstileSiteKey(env) && String(env?.TURNSTILE_SECRET_KEY ?? '').trim());
}

export async function validateTurnstileSubmission(args: {
	env?: Partial<App.RuntimeEnv> | null;
	formData: FormData;
	request: Request;
}) {
	const secret = String(args.env?.TURNSTILE_SECRET_KEY ?? '').trim();
	const siteKey = getTurnstileSiteKey(args.env);
	if (!secret && !siteKey) return { ok: true, required: false, reason: 'not_configured' };
	if (!secret || !siteKey) return { ok: false, required: true, reason: 'incomplete_configuration' };

	const submittedToken = args.formData.get('cf-turnstile-response');
	const token = typeof submittedToken === 'string' ? submittedToken.trim() : '';
	if (!token || token.length > 2048) {
		return { ok: false, required: true, reason: 'missing_token' };
	}

	const remoteIp =
		args.request.headers.get('cf-connecting-ip') ??
		args.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
		'';
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), TURNSTILE_TIMEOUT_MS);

	try {
		const body = new URLSearchParams();
		body.set('secret', secret);
		body.set('response', token);
		if (remoteIp) body.set('remoteip', remoteIp);
		body.set('idempotency_key', crypto.randomUUID());

		const response = await fetch(TURNSTILE_VERIFY_URL, {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body,
			signal: controller.signal
		});
		const result = (await response.json().catch(() => null)) as
			{ success?: boolean; hostname?: string; action?: string } | null;
		if (!response.ok) return { ok: false, required: true, reason: 'verify_http_error' };
		if (result?.success !== true) return { ok: false, required: true, reason: 'failed' };
		if (result.action !== 'login') return { ok: false, required: true, reason: 'action_mismatch' };
		const hostname = new URL(args.request.url).hostname;
		// Local native assets may solve on localhost; a native marker never skips verification.
		if (result.hostname !== hostname && !(isNativeAppRequest(args.request) && result.hostname === 'localhost')) {
			return { ok: false, required: true, reason: 'hostname_mismatch' };
		}
		return { ok: true, required: true, reason: 'verified' };
	} catch {
		return { ok: false, required: true, reason: 'verify_unavailable' };
	} finally {
		clearTimeout(timeout);
	}
}
