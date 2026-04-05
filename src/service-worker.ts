/// <reference lib="webworker" />
import { build, files, version } from '$service-worker';

const CACHE = `cache-${version}`;
const RUNTIME_CACHEABLE_PATHS = ['/menus/', '/files/'];
const PRECACHE_EXCLUSIONS = [/^\/menus\//, /^\/files\//];
const ASSETS = [...build, ...files].filter(
	(path) => !PRECACHE_EXCLUSIONS.some((pattern) => pattern.test(path))
);

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
	const isRuntimeCacheable = isSameOrigin && RUNTIME_CACHEABLE_PATHS.some((prefix) => url.pathname.startsWith(prefix));

	if (!isSameOrigin) return;

	if (isRuntimeCacheable) {
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
						.catch(() => new Response('Offline', { status: 503, statusText: 'Offline' }))
				);
			})
		);
		return;
	}

	// Always fetch fresh HTML/routes first so deployed UI updates are visible immediately.
	if (event.request.mode === 'navigate' || authPath || isSvelteData || isApi || !isStaticAsset) {
		event.respondWith(
			fetch(event.request)
				.then((response) => {
					// Keep an offline fallback for shell navigations only.
					if (event.request.mode === 'navigate' && !authPath) {
						const copy = response.clone();
						caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {});
					}
					return response;
				})
				.catch(async () => {
					const cached = await caches.match(event.request);
					return cached ?? (await caches.match('/')) ?? new Response('Offline', { status: 503, statusText: 'Offline' });
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
