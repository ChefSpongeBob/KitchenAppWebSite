import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

function validDownloadUrl(value: string | undefined) {
	const candidate = String(value ?? '').trim();
	if (!candidate) return null;
	try {
		const parsed = new URL(candidate);
		return parsed.protocol === 'https:' ? parsed.toString() : null;
	} catch {
		return null;
	}
}

export const load: PageServerLoad = async ({ locals, platform, url }) => {
	if (!locals.userId || !locals.businessId || !locals.DB) {
		throw redirect(303, '/login?registered=success&onboarding=1');
	}

	const user = await locals.DB.prepare(
		`
		SELECT display_name
		FROM users
		WHERE id = ?
		LIMIT 1
		`
	)
		.bind(locals.userId)
		.first<{ display_name: string | null }>();

	return {
		displayName: String(user?.display_name ?? '').trim(),
		businessName: locals.businessName ?? '',
		onboardingRequired: url.searchParams.get('onboarding') === '1',
		appStoreUrl: validDownloadUrl(platform?.env?.APP_STORE_DOWNLOAD_URL),
		googlePlayUrl: validDownloadUrl(platform?.env?.GOOGLE_PLAY_DOWNLOAD_URL)
	};
};
