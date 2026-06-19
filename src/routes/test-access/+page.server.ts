import { fail, redirect } from '@sveltejs/kit';
import {
	createPrivateTestAccessValue,
	isPrivateTestGateEnabled,
	privateTestAccessCookieOptions,
	PRIVATE_TEST_ACCESS_COOKIE
} from '$lib/server/privateTestGate';
import { constantTimeTokenEqual } from '$lib/server/requestTokens';

export const load = async ({ platform, url }) => {
	const enabled = isPrivateTestGateEnabled(platform?.env);
	if (!enabled) {
		throw redirect(303, '/');
	}

	return {
		next: url.searchParams.get('next') || '/'
	};
};

export const actions = {
	default: async ({ request, cookies, platform }) => {
		if (!isPrivateTestGateEnabled(platform?.env)) {
			throw redirect(303, '/');
		}

		const data = await request.formData();
		const accessCode = String(data.get('accessCode') ?? '').trim();
		const next = String(data.get('next') ?? '/') || '/';
		const expected = await createPrivateTestAccessValue(platform?.env.PRIVATE_TEST_ACCESS_CODE ?? '');
		const supplied = accessCode ? await createPrivateTestAccessValue(accessCode) : '';

		if (!constantTimeTokenEqual(expected, supplied)) {
			return fail(400, { error: 'Access code not accepted.', next });
		}

		cookies.set(PRIVATE_TEST_ACCESS_COOKIE, expected, privateTestAccessCookieOptions(request));
		throw redirect(303, next.startsWith('/') && !next.startsWith('//') ? next : '/');
	}
};
