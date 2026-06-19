const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TURNSTILE_TIMEOUT_MS = 4500;

export function getTurnstileSiteKey(env?: Partial<App.Platform['env']> | null) {
	return String(env?.TURNSTILE_SITE_KEY ?? '').trim();
}

export function isTurnstileConfigured(env?: Partial<App.Platform['env']> | null) {
	return Boolean(getTurnstileSiteKey(env) && String(env?.TURNSTILE_SECRET_KEY ?? '').trim());
}

export async function validateTurnstileSubmission(args: {
	env?: Partial<App.Platform['env']> | null;
	formData: FormData;
	request: Request;
}) {
	const secret = String(args.env?.TURNSTILE_SECRET_KEY ?? '').trim();
	const siteKey = getTurnstileSiteKey(args.env);
	if (!secret || !siteKey) return { ok: true, required: false, reason: 'not_configured' };

	const token = String(args.formData.get('cf-turnstile-response') ?? '').trim();
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
		const result = (await response.json().catch(() => null)) as { success?: boolean } | null;

		return {
			ok: response.ok && result?.success === true,
			required: true,
			reason: response.ok ? (result?.success ? 'verified' : 'failed') : 'verify_http_error'
		};
	} catch {
		return { ok: false, required: true, reason: 'verify_unavailable' };
	} finally {
		clearTimeout(timeout);
	}
}
