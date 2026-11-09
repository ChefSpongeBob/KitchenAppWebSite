import { isNativeAppRequest } from '#lib/server/authCookies.ts';

export const ACTIVE_BUSINESS_COOKIE = 'kitchen_active_business';

export async function restaurantLandingPath(db: App.RuntimeEnv['DB'], userId: string, businessId: string) {
  const packet = await db.prepare(`SELECT id FROM employee_onboarding_packages
    WHERE business_id = ? AND user_id = ? AND status IN ('sent', 'in_progress', 'returned') LIMIT 1`)
    .bind(businessId, userId).first();
  return packet ? '/settings?onboarding=1' : '/app';
}

export function getActiveBusinessCookieOptions(request: Request) {
  const secure = new URL(request.url).protocol === 'https:';
  return {
    path: '/',
    httpOnly: true,
    sameSite: isNativeAppRequest(request) && secure ? 'none' as const : 'lax' as const,
    secure,
    maxAge: 60 * 60 * 24 * 30
  };
}

export function getActiveBusinessCookieDeleteOptions(request: Request) {
  const { path, httpOnly, sameSite, secure } = getActiveBusinessCookieOptions(request);
  return {
    path, httpOnly, sameSite, secure
  };
}
