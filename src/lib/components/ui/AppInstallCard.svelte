<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	type PromptOutcome = 'accepted' | 'dismissed';
	type BeforeInstallPromptEvent = Event & {
		prompt: () => Promise<void>;
		userChoice: Promise<{ outcome: PromptOutcome }>;
	};

	export let compact = false;

	let deferredPrompt: BeforeInstallPromptEvent | null = null;
	let installed = false;
	let message = '';
	let canInstall = false;

	async function installApp() {
		if (!deferredPrompt) {
			message = 'Use your browser menu and choose "Add to Home Screen".';
			return;
		}

		await deferredPrompt.prompt();
		const choice = await deferredPrompt.userChoice;
		if (choice.outcome === 'accepted') {
			installed = true;
			message = 'App installed.';
		}
		deferredPrompt = null;
		canInstall = false;
	}

	onMount(() => {
		if (!browser) return;
		const media = window.matchMedia('(display-mode: standalone)');
		if (media.matches) {
			installed = true;
			return;
		}

		const onPrompt = (event: Event) => {
			event.preventDefault();
			deferredPrompt = event as BeforeInstallPromptEvent;
			canInstall = true;
		};

		const onInstalled = () => {
			installed = true;
			deferredPrompt = null;
			canInstall = false;
			message = 'App installed.';
		};

		window.addEventListener('beforeinstallprompt', onPrompt);
		window.addEventListener('appinstalled', onInstalled);
		return () => {
			window.removeEventListener('beforeinstallprompt', onPrompt);
			window.removeEventListener('appinstalled', onInstalled);
		};
	});
</script>

<section class:compact class="install-card">
	<div class="left">
		<img src="/favicon-32x32.png" alt="Kitchen app" width="32" height="32" />
		<div>
			<h3>Download App</h3>
			<p>Install on your phone for quick access.</p>
		</div>
	</div>
	{#if installed}
		<span class="status">Installed</span>
	{:else}
		<button type="button" on:click={installApp}>
			{canInstall ? 'Download App' : 'Install Help'}
		</button>
	{/if}
</section>
{#if message}
	<p class="hint">{message}</p>
{/if}

<style>
	.install-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.8rem;
		margin-top: 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: 12px;
		background: var(--color-surface);
	}

	.left {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	h3 {
		margin: 0;
		font-size: 0.95rem;
	}

	p {
		margin: 0;
		font-size: 0.8rem;
		color: var(--color-text-muted);
	}

	button,
	.status {
		border: 1px solid var(--color-border);
		border-radius: 8px;
		padding: 0.35rem 0.6rem;
		background: var(--color-surface-alt);
		color: var(--color-text);
		font-size: 0.8rem;
	}

	button {
		cursor: pointer;
	}

	.compact {
		margin-top: 0.5rem;
	}

	.hint {
		margin: 0.4rem 0 0;
		font-size: 0.78rem;
		color: var(--color-text-muted);
	}
</style>
