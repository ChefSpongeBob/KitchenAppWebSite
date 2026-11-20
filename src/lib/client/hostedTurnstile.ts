import { LOGIN_CHALLENGE_MESSAGE, LOGIN_CHALLENGE_ORIGIN, LOGIN_CHALLENGE_PATH } from '#lib/security/loginChallenge.ts';

export function mountHostedLoginTurnstile(element: HTMLElement, unavailable: (failed: boolean) => void) {
	let disposed = false;
	let frame: HTMLIFrameElement | undefined;
	let channel = '';
	let timeout: ReturnType<typeof setTimeout> | undefined;
	const input = document.createElement('input');
	input.type = 'hidden';
	input.name = 'cf-turnstile-response';
	element.appendChild(input);
	const clear = () => {
		input.value = '';
		clearTimeout(timeout);
	};
	const fail = () => {
		if (disposed) return;
		clear();
		unavailable(true);
	};
	const receive = (event: MessageEvent) => {
		if (disposed || !frame || event.origin !== LOGIN_CHALLENGE_ORIGIN || event.source !== frame.contentWindow) return;
		const message = event.data;
		if (!message || typeof message !== 'object' || message.type !== LOGIN_CHALLENGE_MESSAGE || message.channel !== channel) return;
		if (message.status === 'size' && (message.height === 65 || message.height === 140)) {
			frame.style.height = `${message.height}px`;
		} else if (message.status === 'ready') {
			clearTimeout(timeout);
			unavailable(false);
		} else if (message.status === 'complete' && typeof message.token === 'string' && message.token.length > 0 && message.token.length <= 2048) {
			clearTimeout(timeout);
			input.value = message.token;
			unavailable(false);
		} else if (message.status === 'expired' || message.status === 'error') fail();
	};
	const start = () => {
		if (disposed) return;
		clear();
		if (frame) {
			frame.onload = null;
			frame.onerror = null;
			frame.remove();
		}
		channel = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
		const current = document.createElement('iframe');
		frame = current;
		current.title = 'Security check';
		current.referrerPolicy = 'no-referrer';
		current.style.cssText = 'display:block;border:0;width:100%;height:65px;';
		current.onload = () => {
			if (!disposed && frame === current) {
				input.value = '';
				current.contentWindow?.postMessage({ type: LOGIN_CHALLENGE_MESSAGE, channel, command: 'start' }, LOGIN_CHALLENGE_ORIGIN);
			}
		};
		current.onerror = fail;
		current.src = `${LOGIN_CHALLENGE_ORIGIN}${LOGIN_CHALLENGE_PATH}#${channel}`;
		unavailable(false);
		timeout = setTimeout(fail, 20_000);
		element.appendChild(current);
	};
	window.addEventListener('message', receive);
	start();
	return {
		reset: start,
		destroy() {
			disposed = true;
			clear();
			window.removeEventListener('message', receive);
			if (frame) { frame.onload = null; frame.onerror = null; frame.remove(); }
			input.remove();
		}
	};
}
