<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';

	type PromptOutcome = 'accepted' | 'dismissed';
	type BeforeInstallPromptEvent = Event & {
		prompt: () => Promise<void>;
		userChoice: Promise<{ outcome: PromptOutcome }>;
	};

	export let data: {
		displayName: string;
		businessName: string;
		onboardingRequired: boolean;
		appStoreUrl: string | null;
		googlePlayUrl: string | null;
	};

	let deferredPrompt: BeforeInstallPromptEvent | null = null;
	let installed = false;
	let installMessage = '';
	let canInstall = false;

	async function installWebApp() {
		if (!deferredPrompt) {
			installMessage = 'Use your browser menu and choose Add to Home Screen.';
			return;
		}

		await deferredPrompt.prompt();
		const choice = await deferredPrompt.userChoice;
		if (choice.outcome === 'accepted') {
			installed = true;
			installMessage = 'Crimini is installed.';
		}
		deferredPrompt = null;
		canInstall = false;
	}

	onMount(() => {
		const media = window.matchMedia('(display-mode: standalone)');
		if (media.matches) installed = true;

		const onPrompt = (event: Event) => {
			event.preventDefault();
			deferredPrompt = event as BeforeInstallPromptEvent;
			canInstall = true;
		};
		const onInstalled = () => {
			installed = true;
			deferredPrompt = null;
			canInstall = false;
			installMessage = 'Crimini is installed.';
		};

		window.addEventListener('beforeinstallprompt', onPrompt);
		window.addEventListener('appinstalled', onInstalled);
		return () => {
			window.removeEventListener('beforeinstallprompt', onPrompt);
			window.removeEventListener('appinstalled', onInstalled);
		};
	});
</script>

<svelte:head>
	<title>Welcome | Crimini</title>
</svelte:head>

<section class="welcome-shell">
	<div class="welcome-flow" in:fly={{ y: 24, duration: 420 }}>
		<header>
			<img src="/crimini-full-logo.jpg" alt="Crimini by NNS, LLC" in:fade={{ duration: 420 }} />
			<span>04 / 04</span>
		</header>

		<div class="progress" aria-label="Step 4 of 4"><span></span></div>

		<main>
			<p class="eyebrow">Welcome{data.displayName ? `, ${data.displayName}` : ''}</p>
			<h1>You&rsquo;re ready.</h1>
			{#if data.businessName}
				<p class="workspace">{data.businessName}</p>
			{/if}

			<div class="download-options" aria-label="App download options">
				{#if data.googlePlayUrl}
					<a href={data.googlePlayUrl} target="_blank" rel="noreferrer">
						<img src="/store-badges/google-play-badge.svg" alt="Get it on Google Play" />
					</a>
				{:else}
					<span class="store-pending" aria-label="Google Play release pending">
						<img src="/store-badges/google-play-badge.svg" alt="Google Play" />
					</span>
				{/if}

				{#if data.appStoreUrl}
					<a href={data.appStoreUrl} target="_blank" rel="noreferrer">
						<img src="/store-badges/app-store-badge.svg" alt="Download on the App Store" />
					</a>
				{:else}
					<span class="store-pending" aria-label="App Store release pending">
						<img src="/store-badges/app-store-badge.svg" alt="App Store" />
					</span>
				{/if}
			</div>

			<p class="store-note">
				{data.appStoreUrl || data.googlePlayUrl ? 'Install Crimini for the best notification support.' : 'Store downloads will appear here when released.'}
			</p>

			<div class="actions">
				{#if !installed}
					<button type="button" on:click={installWebApp}>{canInstall ? 'Install web app' : 'Install help'}</button>
				{/if}
				<a href="/settings?onboarding=1">Continue in browser</a>
				<a class="secondary" href="/login?registered=success&onboarding=1">Sign in</a>
			</div>

			{#if installMessage}
				<p class="install-message">{installMessage}</p>
			{/if}

			{#if data.onboardingRequired}
				<p class="onboarding-note">After sign in, complete your company onboarding and check your email.</p>
			{/if}
		</main>
	</div>
</section>

<style>
	:global(body:has(.welcome-shell)) {
		background: #fbfaf7;
	}

	.welcome-shell {
		min-height: 100dvh;
		display: grid;
		place-items: center;
		padding: clamp(2rem, 6vw, 5rem) clamp(1.1rem, 5vw, 4rem);
		background:
			radial-gradient(circle at 82% 16%, rgba(190, 169, 128, 0.13), transparent 26rem),
			linear-gradient(180deg, #ffffff 0%, #fbfaf7 100%);
		color: #111214;
	}

	.welcome-flow {
		width: min(46rem, 100%);
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding-bottom: 1rem;
	}

	header img {
		display: block;
		width: min(16rem, 64vw);
		height: auto;
	}

	header span,
	.eyebrow {
		font-size: 0.72rem;
		font-weight: 750;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.progress {
		height: 1px;
		margin-bottom: clamp(2.5rem, 7vw, 5rem);
		background: rgba(17, 18, 20, 0.12);
	}

	.progress span {
		display: block;
		width: 100%;
		height: 100%;
		background: #111214;
	}

	main {
		display: grid;
		justify-items: center;
		text-align: center;
	}

	.eyebrow,
	.workspace,
	.store-note,
	.install-message,
	.onboarding-note {
		margin: 0;
	}

	.eyebrow,
	.store-note,
	.install-message {
		color: rgba(17, 18, 20, 0.62);
	}

	h1 {
		margin: 0.55rem 0 0;
		font-size: clamp(2.6rem, 8vw, 6.5rem);
		font-weight: 500;
		letter-spacing: -0.075em;
	}

	.workspace {
		margin-top: 0.35rem;
		font-size: 1rem;
		font-weight: 650;
	}

	.download-options {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.8rem;
		flex-wrap: wrap;
		margin-top: 2.2rem;
	}

	.download-options a,
	.store-pending {
		display: inline-flex;
	}

	.download-options img {
		display: block;
		width: 9.6rem;
		height: 3rem;
		object-fit: contain;
	}

	.store-pending {
		opacity: 0.32;
		filter: grayscale(1);
	}

	.store-note {
		margin-top: 0.65rem;
		font-size: 0.78rem;
	}

	.actions {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.8rem 1.4rem;
		flex-wrap: wrap;
		margin-top: 2rem;
	}

	.actions button,
	.actions a {
		padding: 0.48rem 0;
		border: 0;
		border-bottom: 1px solid currentColor;
		border-radius: 0;
		background: transparent;
		color: #111214;
		cursor: pointer;
		font: inherit;
		font-size: 0.78rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-decoration: none;
		text-transform: uppercase;
	}

	.actions .secondary {
		color: rgba(17, 18, 20, 0.6);
	}

	.install-message {
		margin-top: 0.8rem;
		font-size: 0.8rem;
	}

	.onboarding-note {
		width: min(34rem, 100%);
		margin-top: 2rem;
		padding: 0.9rem 0;
		border-top: 1px solid rgba(17, 18, 20, 0.14);
		border-bottom: 1px solid rgba(17, 18, 20, 0.14);
		font-size: 0.88rem;
	}

	@media (max-width: 560px) {
		.welcome-shell {
			place-items: start stretch;
			padding-top: 3rem;
		}

		.welcome-flow {
			margin: auto 0;
		}

		.actions {
			flex-direction: column;
		}
	}
</style>
