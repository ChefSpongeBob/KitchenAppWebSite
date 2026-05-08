import { dev } from '$app/environment';
import { isRedirect, redirect, type Handle } from '@sveltejs/kit';
import { hashSessionToken } from '$lib/server/auth';
import { canRoleAccessFeature, resolveFeatureKeyForPath } from '$lib/features/appFeatures';
import { loadAppFeatureModes } from '$lib/server/appFeatures';
import { ensureTenantSchema } from '$lib/server/tenant';
import {
	bootstrapBusinessForUser,
	getUserBusinessContext,
	isBusinessOnboardingComplete
} from '$lib/server/business';
import {
	ACTIVE_BUSINESS_COOKIE,
	getActiveBusinessCookieDeleteOptions,
	getActiveBusinessCookieOptions
} from '$lib/server/activeBusiness';
import {
	cancelTrialAndPurgeBusiness,
	getBusinessTrialAccess,
	getRequestIpAddress
} from '$lib/server/trial';
import { loadEmployeeOnboardingAccessStatus } from '$lib/server/admin';
import {
	getSessionCookieDeleteOptions,
	getSessionCookieName,
	getSessionCookieOptions
} from '$lib/server/authCookies';
import { effectiveAppRoleFromBusinessRole } from '$lib/server/permissions';
import { wrapProductionSchemaGuard } from '$lib/server/schemaGuard';
import { logOperationalError, logOperationalEvent } from '$lib/server/observability';

function setSessionCookies(event: Parameters<Handle>[0]['event'], sessionToken: string) {
	const cookieName = getSessionCookieName();
	event.cookies.set(cookieName, sessionToken, getSessionCookieOptions(event.request));
	event.cookies.delete('session_id', { path: '/' });
	event.cookies.delete('session_id_pwa', { path: '/' });
}

function clearSessionCookies(event: Parameters<Handle>[0]['event']) {
	const cookieName = getSessionCookieName();
	const deleteOptions = getSessionCookieDeleteOptions(event.request);
	event.cookies.delete(cookieName, deleteOptions);
	event.cookies.delete('session_id', { path: '/' });
	event.cookies.delete('session_id_pwa', { path: '/' });
	event.cookies.delete(ACTIVE_BUSINESS_COOKIE, getActiveBusinessCookieDeleteOptions(event.request));
}

export const handle: Handle = async ({ event, resolve }) => {
	const rawDb = event.platform?.env?.DB as App.Platform['env']['DB'];
	event.locals.DB = rawDb
		? wrapProductionSchemaGuard(
				rawDb,
				dev || event.platform?.env?.ALLOW_RUNTIME_SCHEMA_MUTATION === 'true'
			)
		: rawDb;
	event.locals.MEDIA_BUCKET = event.platform?.env?.DOC_MEDIA;

	const { pathname } = event.url;
	const isAuthRoute =
		pathname.startsWith('/login') ||
		pathname.startsWith('/register') ||
		pathname.startsWith('/forgot-password') ||
		pathname.startsWith('/reset-password') ||
		pathname.startsWith('/logout');
	const isPublicMarketingRoute =
		pathname === '/' ||
		pathname === '/about' ||
		pathname === '/features' ||
		pathname === '/how-it-works' ||
		pathname === '/pricing';

	const isPublicApiRoute =
		pathname.startsWith('/api/internal/smoke') ||
		pathname.startsWith('/api/internal/schema-readiness') ||
		pathname.startsWith('/api/smoke-session') ||
		pathname.startsWith('/api/temps') ||
		pathname.startsWith('/api/camera/upload') ||
		pathname.startsWith('/api/camera/activity');
	const isBillingRoute = pathname.startsWith('/billing');

	const isPrivateRoute = !isAuthRoute && !isPublicMarketingRoute && !isPublicApiRoute;
	const resolveWithNoStore = async () => {
		const response = await resolve(event);
		response.headers.set('cache-control', 'no-store, no-cache, must-revalidate, max-age=0');
		response.headers.set('pragma', 'no-cache');
		response.headers.set('expires', '0');
		return response;
	};
	const resolvePublicOrAuthRoute = async () => (isAuthRoute ? resolveWithNoStore() : resolve(event));

	const db = event.locals.DB;
	const primaryCookie = getSessionCookieName();
	const sessionToken =
		event.cookies.get(primaryCookie) ??
		event.cookies.get('session_id') ??
		event.cookies.get('session_id_pwa');

	if (!db) {
		if (isPrivateRoute) {
			logOperationalEvent({
				level: 'error',
				event: 'db_unavailable_private_route',
				request: event.request,
				route: pathname,
				status: 503
			});
			clearSessionCookies(event);
			throw redirect(303, '/login');
		}
		return resolvePublicOrAuthRoute();
	}

	if (!sessionToken) {
		if (isPrivateRoute) {
			clearSessionCookies(event);
			throw redirect(303, '/login');
		}
		return resolvePublicOrAuthRoute();
	}
	try {
		const now = Math.floor(Date.now() / 1000);
		const sessionTokenHash = await hashSessionToken(sessionToken);
		const session = await db
			.prepare(
				`
			SELECT
				s.id,
				s.user_id,
				s.device_id,
				s.expires_at,
				s.revoked_at,
				s.session_token_hash,
				s.last_seen_at,
				d.id AS found_device_id,
				d.revoked_at AS device_revoked_at,
				u.id AS found_user_id,
				u.role AS user_role,
				COALESCE(u.is_active, 1) AS user_is_active
			FROM sessions s
			LEFT JOIN devices d ON d.id = s.device_id
			LEFT JOIN users u ON u.id = s.user_id
			WHERE s.session_token_hash = ?
			   OR s.session_token_hash = ?
			   OR s.id = ?
			LIMIT 1
		`
			)
			.bind(sessionTokenHash, sessionToken, sessionToken)
			.first<{
				id: string;
				user_id: string;
				device_id: string | null;
				expires_at: number;
				revoked_at: number | null;
				session_token_hash: string;
				last_seen_at: number;
				found_device_id: string | null;
				device_revoked_at: number | null;
				found_user_id: string | null;
				user_role: string | null;
				user_is_active: number;
			}>();

		if (!session || session.revoked_at !== null || session.expires_at < now) {
			logOperationalEvent({
				level: 'warn',
				event: 'session_rejected',
				request: event.request,
				route: pathname,
				status: 401,
				metadata: { reason: !session ? 'missing' : session.revoked_at !== null ? 'revoked' : 'expired' }
			});
			clearSessionCookies(event);
			if (isPrivateRoute) throw redirect(303, '/login?error=session');
			return resolvePublicOrAuthRoute();
		}

		if (session.device_id && (!session.found_device_id || session.device_revoked_at !== null)) {
			logOperationalEvent({
				level: 'warn',
				event: 'session_device_rejected',
				request: event.request,
				userId: session.found_user_id,
				sessionId: session.id,
				route: pathname,
				status: 401,
				metadata: { reason: !session.found_device_id ? 'missing_device' : 'revoked_device' }
			});
			clearSessionCookies(event);
			if (isPrivateRoute) throw redirect(303, '/login?error=session');
			return resolvePublicOrAuthRoute();
		}
		if (!session.found_user_id) {
			logOperationalEvent({
				level: 'warn',
				event: 'session_user_missing',
				request: event.request,
				sessionId: session.id,
				route: pathname,
				status: 401
			});
			clearSessionCookies(event);
			if (isPrivateRoute) throw redirect(303, '/login?error=session');
			return resolvePublicOrAuthRoute();
		}
		if (session.user_is_active !== 1) {
			logOperationalEvent({
				level: 'warn',
				event: 'session_user_inactive',
				request: event.request,
				userId: session.found_user_id,
				sessionId: session.id,
				route: pathname,
				status: 401
			});
			clearSessionCookies(event);
			if (isPrivateRoute) throw redirect(303, '/login?error=session');
			return resolvePublicOrAuthRoute();
		}

		// Upgrade legacy plaintext token storage to hashed token.
		if (session.session_token_hash === sessionToken) {
			const replacementToken = crypto.randomUUID();
			const replacementHash = await hashSessionToken(replacementToken);
			await db
				.prepare(
					`
				UPDATE sessions
				SET session_token_hash = ?, last_seen_at = ?
				WHERE id = ?
			`
				)
				.bind(replacementHash, now, session.id)
				.run();
			setSessionCookies(event, replacementToken);
		} else {
			// Throttle session touch writes so high page traffic does not write on every request.
			if (now - (session.last_seen_at ?? 0) >= 300) {
				await db
					.prepare(
						`
					UPDATE sessions
					SET last_seen_at = ?
					WHERE id = ?
				`
					)
					.bind(now, session.id)
					.run();
			}

			// Normalize to a single canonical cookie key only when legacy key was used.
			if (!event.cookies.get(primaryCookie)) {
				setSessionCookies(event, sessionToken);
			}
		}

		const requestedBusinessId = event.cookies.get(ACTIVE_BUSINESS_COOKIE) ?? null;
		const businessContext =
			(await getUserBusinessContext(db, session.found_user_id, requestedBusinessId)) ??
			(await bootstrapBusinessForUser(db, session.found_user_id, session.user_role, null));
		await ensureTenantSchema(db);

		if (requestedBusinessId !== businessContext.businessId) {
			event.cookies.set(
				ACTIVE_BUSINESS_COOKIE,
				businessContext.businessId,
				getActiveBusinessCookieOptions(event.request)
			);
		}

		event.locals.userId = session.found_user_id;
		event.locals.userRole = effectiveAppRoleFromBusinessRole(businessContext.businessRole);
		event.locals.businessId = businessContext.businessId;
		event.locals.businessName = businessContext.businessName;
		event.locals.businessLogoUrl = businessContext.businessLogoUrl;
		event.locals.businessSlug = businessContext.businessSlug;
		event.locals.businessPlan = businessContext.businessPlan;
		event.locals.businessRole = businessContext.businessRole;
		event.locals.businessOnboardingComplete = await isBusinessOnboardingComplete(
			db,
			businessContext.businessId
		);
		event.locals.featureModes = await loadAppFeatureModes(db, businessContext.businessId);

		const gatedFeature = resolveFeatureKeyForPath(pathname);
		if (isPrivateRoute && gatedFeature) {
			const featureMode = event.locals.featureModes[gatedFeature];
			if (!canRoleAccessFeature(featureMode, event.locals.userRole)) {
				logOperationalEvent({
					level: 'warn',
					event: 'tenant_access_denied',
					request: event.request,
					businessId: businessContext.businessId,
					userId: session.found_user_id,
					sessionId: session.id,
					route: pathname,
					status: 403,
					metadata: { feature: gatedFeature, reason: 'feature_mode' }
				});
				throw redirect(303, event.locals.userRole === 'admin' ? '/admin' : '/app');
			}
		}

		if (isPrivateRoute) {
			const trialAccess = await getBusinessTrialAccess(db, businessContext.businessId, now);
			if (!trialAccess.allowApp) {
				if (trialAccess.shouldPurge) {
					logOperationalEvent({
						level: 'warn',
						event: 'trial_expired_purge_started',
						request: event.request,
						businessId: businessContext.businessId,
						userId: session.found_user_id,
						sessionId: session.id,
						route: pathname,
						status: 403,
						metadata: { reason: trialAccess.denialReason ?? 'trial_expired' }
					});
					const user = await db
						.prepare(
							`
							SELECT email
							FROM users
							WHERE id = ?
							LIMIT 1
						`
						)
						.bind(session.found_user_id)
						.first<{ email: string }>();

					await cancelTrialAndPurgeBusiness(db, {
						businessId: businessContext.businessId,
						source: 'expired',
						reason: 'trial_expired_without_conversion',
						now,
						identity: {
							emailNormalized: user?.email ?? '',
							businessName: businessContext.businessName,
							ipAddress: getRequestIpAddress(event.request),
							userAgent: event.request.headers.get('user-agent') ?? ''
						}
					});
					clearSessionCookies(event);
					throw redirect(303, '/login?trial=expired');
				}

				if (!isBillingRoute && !pathname.startsWith('/api/')) {
					logOperationalEvent({
						level: 'warn',
						event: 'billing_access_required',
						request: event.request,
						businessId: businessContext.businessId,
						userId: session.found_user_id,
						sessionId: session.id,
						route: pathname,
						status: 402,
						metadata: { status: trialAccess.mode }
					});
					throw redirect(303, '/billing?trial=required');
				}
			}
		}

		if (
			isPrivateRoute &&
			event.locals.userRole !== 'admin' &&
			!pathname.startsWith('/settings') &&
			!pathname.startsWith('/api/') &&
			!pathname.startsWith('/logout')
		) {
			const onboardingAccess = await loadEmployeeOnboardingAccessStatus(
				db,
				businessContext.businessId,
				session.found_user_id
			);
			if (onboardingAccess.required && !onboardingAccess.approved) {
				logOperationalEvent({
					level: 'info',
					event: 'employee_onboarding_gate',
					request: event.request,
					businessId: businessContext.businessId,
					userId: session.found_user_id,
					sessionId: session.id,
					route: pathname,
					status: 302,
					metadata: { reason: 'onboarding_required' }
				});
				throw redirect(303, '/settings?tab=onboarding');
			}
		}

		return resolveWithNoStore();
	} catch (error) {
		if (isRedirect(error)) {
			throw error;
		}
		logOperationalError({
			event: 'request_guard_error',
			request: event.request,
			route: pathname,
			status: 500,
			error
		});
		clearSessionCookies(event);
		if (isPrivateRoute) {
			throw redirect(303, '/login?error=session');
		}
		return resolvePublicOrAuthRoute();
	}
};
