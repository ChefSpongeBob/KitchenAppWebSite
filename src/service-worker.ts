/// <reference lib="webworker" />
import { build, files, version } from '$service-worker';

const CACHE = `cache-${version}`;
const ASSETS = [...build, ...files];

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

	// Always fetch fresh HTML/routes first so deployed UI updates are visible immediately.
	if (event.request.mode === 'navigate') {
		event.respondWith(
			fetch(event.request)
				.then((response) => {
					const copy = response.clone();
					caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {});
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
