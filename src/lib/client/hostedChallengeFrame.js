// Included verbatim in the isolated view so bundler runtime helpers cannot leak into it.
(() => {
	const ownScript = /** @type {HTMLScriptElement | null} */ (document.currentScript);
	const siteKey = ownScript?.dataset.siteKey ?? '';
	const messageType = ownScript?.dataset.messageType ?? '';
	const channel = window.location.hash.slice(1);
	if (!siteKey || !messageType || window.parent === window || !/^[a-f0-9]{32}$/.test(channel)) return;
	const nonce = ownScript?.nonce ?? '';
	let started = false;
	let parentOrigin = '';
	let finished = false;
	/** @type {ReturnType<typeof setTimeout>} */
	let timer;
	/** @param {string} status @param {Record<string, unknown>} [extra] */
	const send = (status, extra = {}) => {
		// WKWebView's custom origin may serialize as null. Only its already-verified parent receives the response.
		const target = parentOrigin === 'https://localhost' ? parentOrigin : '*';
		window.parent.postMessage({ type: messageType, channel, status, ...extra }, target);
	};
	/** @param {MessageEvent} event */
	const begin = (event) => {
		if (started || event.source !== window.parent || !['https://localhost', 'capacitor://localhost', 'null'].includes(event.origin)) return;
		const message = event.data;
		if (!message || typeof message !== 'object' || message.type !== messageType || message.channel !== channel || message.command !== 'start') return;
		started = true;
		parentOrigin = event.origin;
		window.removeEventListener('message', begin);
		const script = document.createElement('script');
		script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
		script.async = true;
		script.nonce = nonce;
		const fail = () => {
			if (finished) return;
			finished = true;
			clearTimeout(timer);
			send('error');
		};
		script.onerror = fail;
		script.onload = () => {
			if (finished) return;
			clearTimeout(timer);
			const api = window.turnstile;
			const container = document.getElementById('security-check');
			if (!api || !container) { fail(); return; }
			try {
				const compact = window.innerWidth < 300;
				send('size', { height: compact ? 140 : 65 });
				const id = api.render(container, {
					sitekey: siteKey, action: 'login', theme: 'light', size: compact ? 'compact' : 'normal', 'response-field': false,
					/** @param {string} token */
					callback: (token) => {
						if (typeof token === 'string' && token.length > 0 && token.length <= 2048) send('complete', { token });
					},
					'expired-callback': () => send('expired'),
					'timeout-callback': () => send('expired'),
					'error-callback': () => { send('error'); return true; }
				});
				if (id === undefined) fail();
				else send('ready');
			} catch { fail(); }
		};
		timer = setTimeout(fail, 15_000);
		document.head.appendChild(script);
	};
	window.addEventListener('message', begin);
})();
