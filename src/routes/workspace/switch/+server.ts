import { error, json, redirect, type RequestHandler } from '@sveltejs/kit';
import {
	ACTIVE_BUSINESS_COOKIE,
	getActiveBusinessCookieOptions,
	restaurantLandingPath
} from '#lib/server/activeBusiness.ts';
import { getUserBusinessContext } from '#lib/server/business.ts';

export const POST: RequestHandler = async ({ locals, request, cookies }) => {
	const db = locals.DB;
	if (!db || !locals.userId) throw redirect(303, '/login');

	const formData = await request.formData();
	const businessId = String(formData.get('business_id') ?? '').trim();
	if (!businessId) throw error(400, 'Business required.');

	const context = await getUserBusinessContext(db, locals.userId, businessId);
	if (!context || context.businessId !== businessId) throw error(403, 'Workspace unavailable.');

	cookies.set(ACTIVE_BUSINESS_COOKIE, businessId, getActiveBusinessCookieOptions(request));
	const target = formData.get('entry') === 'login' ? await restaurantLandingPath(db, locals.userId, businessId) : '/app';
	if (request.headers.get('accept') === 'application/json') return json({ location: target });
	throw redirect(303, target);
};
