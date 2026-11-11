type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogArgs = {
	level?: LogLevel;
	event: string;
	request?: Request;
	businessId?: string | null;
	userId?: string | null;
	sessionId?: string | null;
	route?: string | null;
	status?: number | null;
	message?: string | null;
	error?: unknown;
	metadata?: Record<string, unknown>;
};

const SAFE_METADATA_KEYS = new Set([
	'action',
	'attempt',
	'feature',
	'path',
	'phase',
	'reason',
	'route',
	'source',
	'status',
	'table',
	'target',
	'type'
]);

const SENSITIVE_TEXT_PATTERNS: Array<[RegExp, string]> = [
	[/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [redacted]'],
	[/(x-smoke-token["'\s:=]+)[^"',\s)]+/gi, '$1[redacted]'],
	[/(api[_-]?key["'\s:=]+)[^"',\s)]+/gi, '$1[redacted]'],
	[/(password(?:[_-](?:pepper|hash))?["'\s:=]+)[^"',\s)]+/gi, '$1[redacted]'],
	[/(secret["'\s:=]+)[^"',\s)]+/gi, '$1[redacted]'],
	[/(token["'\s:=]+)[^"',\s)]+/gi, '$1[redacted]'],
	[/(SENSITIVE_DATA_KEY["'\s:=]+)[^"',\s)]+/gi, '$1[redacted]'],
	[/(RESEND_API_KEY["'\s:=]+)[^"',\s)]+/gi, '$1[redacted]'],
	[/(BILLING_WEBHOOK_TOKEN["'\s:=]+)[^"',\s)]+/gi, '$1[redacted]']
];

function decodedLogPath(value: string) {
	let result = value;
	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			const decoded = decodeURIComponent(result);
			if (decoded === result) break;
			result = decoded;
		} catch { break; }
	}
	return result;
}

function privatePath(value: string) {
	return value.replace(/(\/reset-password)\/[\s\S]*$/i, '$1/[token]')
		.replace(/(\/api\/documents\/media)\/[\s\S]*$/i, '$1/[...key]');
}

export function safeLogPath(value: string | null | undefined) {
	if (!value) return null;
	let path = decodedLogPath(value);
	if (/^https?:\/\//i.test(path)) {
		try { path = new URL(path).pathname; } catch { return '[invalid-path]'; }
	}
	return privatePath(path.split(/[?#]/, 1)[0]).slice(0, 250);
}

function redactSensitiveText(value: string) {
	// Log copies only: never rewrite a request URL, route, redirect or file key.
	const paths = value.replace(/(?:https?:\/\/|\/)[^\s"'<>]*/gi, candidate => {
		const decoded = decodedLogPath(candidate);
		if (/^https?:\/\//i.test(decoded)) {
			try { const url = new URL(decoded); return url.origin + safeLogPath(url.pathname); }
			catch { return '[invalid-url]'; }
		}
		return safeLogPath(decoded) ?? '';
	});
	return SENSITIVE_TEXT_PATTERNS.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), paths);
}

function requestId(request?: Request) {
	const ray = request?.headers.get('cf-ray') ?? '';
	if (/^[a-f0-9]{16,32}(?:-[a-z]{3})?$/i.test(ray)) return ray;
	const supplied = request?.headers.get('x-request-id') ?? '';
	return /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(supplied) ? supplied : crypto.randomUUID();
}

function sanitizeMetadata(metadata: Record<string, unknown> | undefined) {
	if (!metadata) return {};
	const safe: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(metadata)) {
		if (Object.keys(safe).length >= 32) break;
		const counter = /^[a-z][a-z0-9_]{0,63}_(?:count|total)$/.test(key);
		if (!SAFE_METADATA_KEYS.has(key) && !counter) continue;
		if (counter && (typeof value !== 'number' || !Number.isFinite(value))) continue;
		if (typeof value === 'string') safe[key] = key === 'path' || key === 'route'
			? safeLogPath(value) : redactSensitiveText(value).slice(0, 200);
		else if ((typeof value === 'number' && Number.isFinite(value)) || typeof value === 'boolean' || value === null) safe[key] = value;
	}
	return safe;
}

function errorPayload(error: unknown) {
	if (!error) return null;
	if (error instanceof Error) {
		return {
			name: redactSensitiveText(error.name).slice(0, 80),
			message: redactSensitiveText(error.message).slice(0, 500)
		};
	}
	return {
		message: redactSensitiveText(String(error)).slice(0, 500)
	};
}

export function logOperationalEvent({
	level = 'info',
	event,
	request,
	businessId = null,
	userId = null,
	sessionId = null,
	route = null,
	status = null,
	message = null,
	error = null,
	metadata
}: LogArgs) {
	const payload = {
		ts: new Date().toISOString(),
		level,
		event,
		request_id: requestId(request),
		method: request?.method ?? null,
		path: safeLogPath(request ? new URL(request.url).pathname : route),
		route: safeLogPath(route),
		status,
		business_id: businessId,
		user_id: userId,
		session_id: sessionId,
		message: message ? redactSensitiveText(message).slice(0, 500) : message,
		error: errorPayload(error),
		metadata: sanitizeMetadata(metadata)
	};

	const line = JSON.stringify(payload);
	if (level === 'error') console.error(line);
	else if (level === 'warn') console.warn(line);
	else console.log(line);
}

export function logOperationalError(args: Omit<LogArgs, 'level'>) {
	logOperationalEvent({ ...args, level: 'error' });
}
