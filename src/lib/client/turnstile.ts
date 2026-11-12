type TurnstileApi = {
	render: (element: HTMLElement, options: Record<string, unknown>) => string | undefined;
	reset: (id: string) => void;
	remove: (id: string) => void;
};

declare global {
	interface Window { turnstile?: TurnstileApi; }
}

let pendingApi: Promise<TurnstileApi> | undefined;

function loadApi() {
	if (window.turnstile) return Promise.resolve(window.turnstile);
	if (pendingApi) return pendingApi;
	pendingApi = new Promise<TurnstileApi>((resolve, reject) => {
		const existing = document.querySelector<HTMLScriptElement>('script[data-crimini-turnstile]');
		const script = existing ?? document.createElement('script');
		const finish = (failed = false) => {
			clearTimeout(timeout);
			script.removeEventListener('load', loaded);
			script.removeEventListener('error', failedLoad);
			if (!failed && window.turnstile) resolve(window.turnstile);
			else { script.remove(); reject(new Error('Security check unavailable')); }
		};
		const loaded = () => finish();
		const failedLoad = () => finish(true);
		const timeout = setTimeout(failedLoad, 15_000);
		script.addEventListener('load', loaded, { once: true });
		script.addEventListener('error', failedLoad, { once: true });
		if (!existing) {
			script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
			script.async = true;
			script.dataset.criminiTurnstile = '1';
			document.head.appendChild(script);
		}
	}).catch(error => { pendingApi = undefined; throw error; });
	return pendingApi;
}

export function mountLoginTurnstile(element: HTMLElement, siteKey: string, unavailable: (failed: boolean) => void) {
	let disposed = false;
	let starting = false;
	let api: TurnstileApi | undefined;
	let id: string | undefined;
	const start = async () => {
		if (disposed || starting || !siteKey) return;
		starting = true;
		unavailable(false);
		try {
			api = await loadApi();
			if (disposed) return;
			id = api.render(element, { sitekey: siteKey, action: 'login', theme: 'light',
				callback: () => { if (!disposed) unavailable(false); },
				'error-callback': () => { if (!disposed) unavailable(true); return true; } });
			if (id === undefined) unavailable(true);
		} catch { if (!disposed) unavailable(true); }
		finally { starting = false; }
	};
	void start();
	return {
		reset() {
			if (disposed) return;
			if (api && id !== undefined) {
				try { api.reset(id); unavailable(false); } catch { unavailable(true); }
			} else void start();
		},
		destroy() {
			disposed = true;
			if (api && id !== undefined) api.remove(id);
		}
	};
}
