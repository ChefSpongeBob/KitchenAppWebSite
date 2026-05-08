import { error, redirect, type RequestHandler } from '@sveltejs/kit';
import {
	ACTIVE_BUSINESS_COOKIE,
	getActiveBusinessCookieOptions
} from '$lib/server/activeBusiness';
import { getUserBusinessContext } from '$lib/server/business';

function getSafeRedirectTarget(request: Request) {
	const fallback = '/app';
	const referer = request.headers.get('referer');
	if (!referer) return fallback;

	try {
		const refererUrl = new URL(referer);
		const requestUrl = new URL(request.url);
		if (refererUrl.origin !== requestUrl.origin) return fallback;
		return `${refererUrl.pathname}${refererUrl.search}${refererUrl.hash}`;
	} catch {
		return fallback;
	}
}

export const POST: RequestHandler = async ({ locals, request, cookies }) => {
	const db = locals.DB;
	if (!db || !locals.userId) throw redirect(303, '/login');

	const formData = await request.formData();
	const businessId = String(formData.get('business_id') ?? '').trim();
	if (!businessId) throw error(400, 'Business required.');

	const context = await getUserBusinessContext(db, locals.userId, businessId);
	if (!context || context.businessId !== businessId) throw error(403, 'Workspace unavailable.');

	cookies.set(ACTIVE_BUSINESS_COOKIE, businessId, getActiveBusinessCookieOptions(request));
	throw redirect(303, getSafeRedirectTarget(request));
};
