import { existsSync, readFileSync } from 'node:fs';

const hooksPath = 'src/hooks.server.ts';
const source = existsSync(hooksPath) ? readFileSync(hooksPath, 'utf8') : '';
const staticHeadersPath = '_headers';
const staticHeaders = existsSync(staticHeadersPath) ? readFileSync(staticHeadersPath, 'utf8') : '';

const checks = [
	['security header helper exists', source.includes('function applySecurityHeaders')],
	['nosniff is set globally', source.includes("x-content-type-options', 'nosniff")],
	['framing is denied globally', source.includes("x-frame-options', 'DENY")],
	['content security policy is set globally', source.includes('content-security-policy')],
	['CSP blocks plugin/object content', source.includes("object-src 'none'")],
	['CSP restricts form posts to this app', source.includes("form-action 'self'")],
	['CSP denies embedded framing', source.includes("frame-ancestors 'none'")],
	['CSP allows only Cloudflare Turnstile challenge resources externally', source.includes("script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com") && source.includes("connect-src 'self' https://challenges.cloudflare.com") && source.includes("frame-src https://challenges.cloudflare.com")],
	['referrer policy is set globally', source.includes("referrer-policy', 'strict-origin-when-cross-origin")],
	['permissions policy is set globally', source.includes('permissions-policy')],
	['origin agent cluster is isolated', source.includes("origin-agent-cluster', '?1")],
	['cross-domain policy files are disabled', source.includes("x-permitted-cross-domain-policies', 'none")],
	['legacy download opening is disabled', source.includes("x-download-options', 'noopen")],
	['HSTS is enabled outside dev', source.includes('strict-transport-security') && source.includes('!dev')],
	['private no-store responses keep security headers', source.includes('return applySecurityHeaders(response);')],
	[
		'public routes receive security headers',
		source.includes('applySecurityHeaders(await resolve(event))')
	],
	['Cloudflare Pages static header file exists', staticHeaders.length > 0],
	['static responses get nosniff', staticHeaders.includes('X-Content-Type-Options: nosniff')],
	['static responses deny framing', staticHeaders.includes('X-Frame-Options: DENY')],
	['static responses set referrer policy', staticHeaders.includes('Referrer-Policy: strict-origin-when-cross-origin')],
	['static responses set permissions policy', staticHeaders.includes('Permissions-Policy: camera=(self), geolocation=(), microphone=(), payment=(self)')],
	['static responses isolate opener', staticHeaders.includes('Cross-Origin-Opener-Policy: same-origin')],
	['static responses disable legacy cross-domain policy files', staticHeaders.includes('X-Permitted-Cross-Domain-Policies: none')],
	['static responses disable legacy download opening', staticHeaders.includes('X-Download-Options: noopen')],
	['static responses set HSTS', staticHeaders.includes('Strict-Transport-Security: max-age=31536000; includeSubDomains; preload')]
];

const failed = checks.filter(([, ok]) => !ok);

for (const [label, ok] of checks) {
	console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
}

if (failed.length) process.exit(1);
