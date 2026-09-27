import { browser } from '$app/environment';
import { Capacitor } from '@capacitor/core';

const SERVER_ORIGIN = 'https://criminiops.com';

export function nativeServerUrl(value: string | null | undefined) {
	if (!value || !browser || !Capacitor.isNativePlatform()) return value ?? '';

	try {
		const url = new URL(value, window.location.origin);
		if (url.origin !== window.location.origin) return value;

		const isProtectedMedia = url.pathname.startsWith('/api/');
		const isReportExport = /^\/reports\/[^/]+\.csv$/.test(url.pathname);
		if (!isProtectedMedia && !isReportExport) return value;

		return `${SERVER_ORIGIN}${url.pathname}${url.search}${url.hash}`;
	} catch {
		return value;
	}
}
