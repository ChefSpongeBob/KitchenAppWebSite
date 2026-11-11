import { browser } from '$app/env';
import { Capacitor } from '@capacitor/core';

const SERVER_ORIGIN = 'https://criminiops.com';

export function nativeServerUrl(value: string | null | undefined) {
	if (!value || !browser || !Capacitor.isNativePlatform()) return value ?? '';

	try {
		const local = new URL(window.location.href);
		const url = new URL(value, local);
		if (url.protocol !== local.protocol || url.host !== local.host || url.username || url.password) return value;

		const isProtectedMedia = url.pathname.startsWith('/api/');
		const isReportExport = /^\/reports\/[^/]+\.csv$/.test(url.pathname);
		if (!isProtectedMedia && !isReportExport) return value;

		return `${SERVER_ORIGIN}${url.pathname}${url.search}${url.hash}`;
	} catch {
		return value;
	}
}
