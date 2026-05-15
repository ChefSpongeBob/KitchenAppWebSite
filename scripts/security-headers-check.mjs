import { existsSync, readFileSync } from 'node:fs';

const hooksPath = 'src/hooks.server.ts';
const source = existsSync(hooksPath) ? readFileSync(hooksPath, 'utf8') : '';

const checks = [
	['security header helper exists', source.includes('function applySecurityHeaders')],
	['nosniff is set globally', source.includes("x-content-type-options', 'nosniff")],
	['framing is denied globally', source.includes("x-frame-options', 'DENY")],
	['referrer policy is set globally', source.includes("referrer-policy', 'strict-origin-when-cross-origin")],
	['permissions policy is set globally', source.includes('permissions-policy')],
	['HSTS is enabled outside dev', source.includes('strict-transport-security') && source.includes('!dev')],
	['private no-store responses keep security headers', source.includes('return applySecurityHeaders(response);')],
	[
		'public routes receive security headers',
		source.includes('applySecurityHeaders(await resolve(event))')
	]
];

const failed = checks.filter(([, ok]) => !ok);

for (const [label, ok] of checks) {
	console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
}

if (failed.length) process.exit(1);
