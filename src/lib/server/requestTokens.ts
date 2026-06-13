export function constantTimeTokenEqual(expected: string | null | undefined, supplied: string | null | undefined) {
  const left = String(expected ?? '');
  const right = String(supplied ?? '');
  if (!left || !right) return false;

  const maxLength = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;
  for (let index = 0; index < maxLength; index += 1) {
    diff |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return diff === 0;
}

export function bearerTokenFromRequest(request: Request) {
  return request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ?? '';
}

export function internalTokenFromRequest(request: Request) {
  return bearerTokenFromRequest(request) || request.headers.get('x-smoke-token')?.trim() || '';
}

