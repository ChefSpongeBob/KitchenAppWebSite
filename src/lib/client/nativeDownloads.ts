import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { WORKSPACE_HEADER } from '#lib/workspaceIntent.ts';

const SERVER_ORIGIN = 'https://criminiops.com';
const EXPORT_DIRECTORY = 'crimini-exports';
const MAX_FILE_BYTES = 16 * 1024 * 1024;
const CACHE_LIFETIME_MS = 10 * 60 * 1000;
const FILE_ERROR = 'Unable to open this file. Check your connection and access, then try again.';
const FILE_TYPES: Record<string, string> = {
	'application/pdf': 'pdf',
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp',
	'image/gif': 'gif',
	'text/csv': 'csv'
};

export function nativeDownloadUrl(value: string, localAddress: string) {
	try {
		const local = new URL(localAddress);
		const url = new URL(value, local);
		const isLocal = url.protocol === local.protocol && url.host === local.host;
		if (!isLocal && url.origin !== SERVER_ORIGIN) return null;
		if (url.username || url.password) return null;
		if (!url.pathname.startsWith('/api/documents/media/') &&
			!/^\/reports\/(lists|schedule|requests|onboarding|waste|temperature)\.csv$/.test(url.pathname)) return null;
		url.hash = '';
		return new URL(url.pathname + url.search, SERVER_ORIGIN);
	} catch {
		return null;
	}
}

function fileName(url: URL, response: Response, extension: string) {
	const disposition = response.headers.get('content-disposition') ?? '';
	const match = disposition.match(/filename="([^"]+)"/i);
	let base = match?.[1] ?? url.pathname.split('/').at(-1) ?? 'Crimini';
	try { base = decodeURIComponent(base); } catch { base = 'Crimini'; }
	base = base.replace(/\.[^.]*$/, '').replace(/[^a-zA-Z0-9 _-]/g, '').trim().slice(0, 90);
	return `${base || 'Crimini'}.${extension}`;
}

async function responseData(response: Response, signal: AbortSignal) {
	const size = Number(response.headers.get('content-length'));
	if (size > MAX_FILE_BYTES) throw new Error(FILE_ERROR);
	// Bound streamed responses as well as those with a Content-Length header.
	const reader = response.body?.getReader();
	if (!reader) throw new Error(FILE_ERROR);
	const chunks: Uint8Array[] = [];
	let length = 0;
	try {
		for (;;) {
			if (signal.aborted) throw new Error(FILE_ERROR);
			const { done, value } = await reader.read();
			if (done) break;
			length += value.byteLength;
			if (length > MAX_FILE_BYTES) throw new Error(FILE_ERROR);
			chunks.push(value);
		}
	} finally {
		await reader.cancel().catch(() => {});
		reader.releaseLock();
	}
	if (!length || signal.aborted) throw new Error(FILE_ERROR);
	let binary = '';
	for (const chunk of chunks) {
		for (let offset = 0; offset < chunk.length; offset += 8192) {
			binary += String.fromCharCode(...chunk.subarray(offset, offset + 8192));
		}
	}
	return btoa(binary);
}

export function installNativeDownloads(
	getBusinessId: () => string | null | undefined,
	onError: (message: string) => void
) {
	if (!Capacitor.isNativePlatform()) return () => {};
	let disposed = false;
	let busy = false;
	let activeRequest: AbortController | undefined;
	let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
	let cleanup = Promise.resolve(true);
	const removeCache = () => cleanup = cleanup.then(async () => {
		try {
			await Filesystem.rmdir({ path: EXPORT_DIRECTORY, directory: Directory.Cache, recursive: true });
			return true;
		} catch (error) {
			return (error as { code?: string })?.code === 'OS-PLUG-FILE-0008';
		}
	});
	// A killed process cannot run its timer; remove any previous export on launch.
	const startupCleanup = removeCache();
	const handleClick = (event: MouseEvent) => {
		if (event.defaultPrevented || event.button !== 0) return;
		const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
		if (!(anchor instanceof HTMLAnchorElement)) return;
		const url = nativeDownloadUrl(anchor.href, window.location.href);
		if (!url) return;
		event.preventDefault();
		// Do not let client routing or WebView external navigation race the share sheet.
		event.stopImmediatePropagation();
		if (busy) return;
		busy = true;
		const businessId = getBusinessId();
		const controller = new AbortController();
		activeRequest = controller;
		const unchanged = () => !disposed && !controller.signal.aborted &&
			Boolean(businessId) && getBusinessId() === businessId;
		void (async () => {
			const timeout = setTimeout(() => controller.abort(), 60000);
			let path: string | undefined;
			try {
				if (!unchanged()) throw new Error(FILE_ERROR);
				await startupCleanup;
				clearTimeout(cleanupTimer);
				if (!await removeCache()) throw new Error(FILE_ERROR);
				const response = await fetch(url.href, {
					credentials: 'include', cache: 'no-store', signal: controller.signal,
					headers: { [WORKSPACE_HEADER]: businessId!, 'x-crimini-native': '1' }
				});
				const extension = FILE_TYPES[(response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()];
				if (!response.ok || response.redirected || !extension || !unchanged()) throw new Error(FILE_ERROR);
				if (response.url && response.url !== url.href) throw new Error(FILE_ERROR);
				const data = await responseData(response, controller.signal);
				if (!unchanged()) throw new Error(FILE_ERROR);
				path = `${EXPORT_DIRECTORY}/${fileName(url, response, extension)}`;
				const file = await Filesystem.writeFile({ path, directory: Directory.Cache, data, recursive: true });
				if (!unchanged()) throw new Error(FILE_ERROR);
				clearTimeout(timeout);
				// Keep the private file briefly so the chosen app can finish reading it.
				cleanupTimer = setTimeout(() => { void removeCache(); }, CACHE_LIFETIME_MS);
				await Share.share({ files: [file.uri], dialogTitle: 'Save or share file' });
			} catch (error) {
				if (path) await Filesystem.deleteFile({ path, directory: Directory.Cache }).catch(() => {});
				const cancelled = error instanceof Error && /^Share cancel(?:led|ed)(?: by user)?$/i.test(error.message);
				if (!disposed && !cancelled) onError(FILE_ERROR);
			} finally {
				clearTimeout(timeout);
				busy = false;
				activeRequest = undefined;
			}
		})();
	};
	const handleLogout = (event: Event) => {
		const form = event.target;
		if (form instanceof HTMLFormElement && new URL(form.action, window.location.href).pathname === '/logout') {
			activeRequest?.abort();
			void removeCache();
		}
	};
	document.addEventListener('click', handleClick, true);
	document.addEventListener('submit', handleLogout, true);
	return () => {
		disposed = true;
		activeRequest?.abort();
		clearTimeout(cleanupTimer);
		document.removeEventListener('click', handleClick, true);
		document.removeEventListener('submit', handleLogout, true);
		void removeCache();
	};
}
