export const ACTIVE_BUSINESS_COOKIE = 'kitchen_active_business';

export function getActiveBusinessCookieOptions(request: Request) {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: new URL(request.url).protocol === 'https:',
    maxAge: 60 * 60 * 24 * 30
  };
}

export function getActiveBusinessCookieDeleteOptions(request: Request) {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: new URL(request.url).protocol === 'https:'
  };
}
