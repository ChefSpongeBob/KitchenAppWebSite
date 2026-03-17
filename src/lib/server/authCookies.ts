import { dev } from '$app/environment';

const NATIVE_APP_MARKERS = ['KitchenNative/', 'Capacitor'];

export function isNativeAppRequest(request: Request) {
  const userAgent = request.headers.get('user-agent') ?? '';
  return NATIVE_APP_MARKERS.some((marker) => userAgent.includes(marker));
}

export function getSessionCookieName() {
  return dev ? 'kitchen_session' : '__Host-kitchen_session';
}

export function getSessionCookieOptions(request: Request) {
  const secure = !dev;
  const nativeApp = isNativeAppRequest(request);

  return {
    path: '/',
    httpOnly: true,
    sameSite: nativeApp && secure ? ('none' as const) : ('lax' as const),
    secure,
    maxAge: 60 * 60 * 24 * 30
  };
}

export function getSessionCookieDeleteOptions(request: Request) {
  const { path, httpOnly, sameSite, secure } = getSessionCookieOptions(request);

  return {
    path,
    httpOnly,
    sameSite,
    secure
  };
}
