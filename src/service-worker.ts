/// <reference lib="webworker" />
import { build, files, version } from '$service-worker';

const CACHE = `cache-${version}`;
const PUBLIC_NAVIGATION_PATHS = new Set([
	'/',
	'/about',
	'/features',
	'/how-it-works',
	'/pricing',
	'/privacy',
	'/account-deletion'
]);
const ASSETS = [...build, ...files];

function isPublicNavigationPath(pathname: string) {
	return PUBLIC_NAVIGATION_PATHS.has(pathname);
}

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE).then((cache) => {
			return cache.addAll(ASSETS);
		})
	);
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then(async (keys) => {
			for (const key of keys) {
				if (key !== CACHE) await caches.delete(key);
			}

			const cache = await caches.open(CACHE);
			const requests = await cache.keys();
			await Promise.all(
				requests.map(async (request) => {
					const url = new URL(request.url);
					const keepCached =
						ASSETS.includes(url.pathname) ||
						isPublicNavigationPath(url.pathname);
					if (!keepCached) await cache.delete(request);
				})
			);
		})
	);
	event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;
	const url = new URL(event.request.url);
	const isSameOrigin = url.origin === self.location.origin;
	const authPath =
		url.pathname.startsWith('/login') ||
		url.pathname.startsWith('/register') ||
		url.pathname.startsWith('/logout');
	const isSvelteData = url.pathname.includes('/__data.json');
	const isApi = url.pathname.startsWith('/api/');
	const isStaticAsset = isSameOrigin && ASSETS.includes(url.pathname);
	const isPublicNavigation = event.request.mode === 'navigate' && isPublicNavigationPath(url.pathname);

	if (!isSameOrigin) return;

	// Always fetch fresh HTML/routes first so deployed UI updates are visible immediately.
	if (event.request.mode === 'navigate' || authPath || isSvelteData || isApi || !isStaticAsset) {
		event.respondWith(
			fetch(event.request)
				.then((response) => {
					// Only public marketing pages get navigation cache. Private app/admin
					// routes must always reflect the current server session.
					if (isPublicNavigation) {
						const copy = response.clone();
						caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {});
					}
					return response;
				})
				.catch(async () => {
					if (isPublicNavigation) {
						const cached = await caches.match(event.request);
						return cached ?? (await caches.match('/')) ?? new Response('Offline', { status: 503, statusText: 'Offline' });
					}
					return new Response('Offline', { status: 503, statusText: 'Offline' });
				})
		);
		return;
	}

	event.respondWith(
		caches.match(event.request).then((response) => {
			return (
				response ||
				fetch(event.request)
					.then((networkResponse) => {
						const copy = networkResponse.clone();
						caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {});
						return networkResponse;
					})
					.catch(() => {
					if (event.request.mode === 'navigate') {
						return caches.match('/');
					}
					return new Response('Offline', { status: 503, statusText: 'Offline' });
					})
			);
		})
	);
});
