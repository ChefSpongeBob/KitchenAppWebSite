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

function requestId(request?: Request) {
	return (
		request?.headers.get('cf-ray') ??
		request?.headers.get('x-request-id') ??
		crypto.randomUUID()
	).slice(0, 128);
}

function sanitizeMetadata(metadata: Record<string, unknown> | undefined) {
	if (!metadata) return {};
	const safe: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(metadata)) {
		if (SAFE_METADATA_KEYS.has(key) || key.endsWith('_count') || key.endsWith('_total')) {
			safe[key] = value;
		}
	}
	return safe;
}

function errorPayload(error: unknown) {
	if (!error) return null;
	if (error instanceof Error) {
		return {
			name: error.name,
			message: error.message.slice(0, 500)
		};
	}
	return {
		message: String(error).slice(0, 500)
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
		path: request ? new URL(request.url).pathname : route,
		route,
		status,
		business_id: businessId,
		user_id: userId,
		session_id: sessionId,
		message,
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
