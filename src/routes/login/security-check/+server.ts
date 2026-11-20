import type { RequestHandler } from './$types';
import frameSource from '#lib/client/hostedChallengeFrame.js?raw';
import { LOGIN_CHALLENGE_MESSAGE } from '#lib/security/loginChallenge.ts';
import { getTurnstileSiteKey, isTurnstileConfigured } from '#lib/server/turnstile.ts';

export const GET: RequestHandler = ({ locals }) => {
	const siteKey = getTurnstileSiteKey(locals.env);
	if (!isTurnstileConfigured(locals.env) || !/^[a-zA-Z0-9_-]{1,100}$/.test(siteKey)) {
		return new Response('Security check unavailable.', { status: 503, headers: { 'cache-control': 'no-store' } });
	}
	const nonce = crypto.randomUUID().replaceAll('-', '');
	const policy = [
		"default-src 'none'", "base-uri 'none'", "object-src 'none'", "form-action 'none'",
		'frame-ancestors https://localhost capacitor://localhost',
		`script-src 'nonce-${nonce}' https://challenges.cloudflare.com`,
		`style-src 'nonce-${nonce}'`, 'frame-src https://challenges.cloudflare.com',
		'connect-src https://challenges.cloudflare.com'
	].join('; ');
	const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Security check</title><style nonce="${nonce}">html,body{margin:0;background:transparent}body{display:flex;justify-content:center}</style></head><body><div id="security-check"></div><script nonce="${nonce}" data-site-key="${siteKey}" data-message-type="${LOGIN_CHALLENGE_MESSAGE}">${frameSource}</script></body></html>`;
	return new Response(html, { headers: {
		'content-type': 'text/html; charset=utf-8', 'content-security-policy': policy,
		'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
		'pragma': 'no-cache', 'expires': '0', 'x-robots-tag': 'noindex, nofollow', 'referrer-policy': 'no-referrer'
	} });
};
