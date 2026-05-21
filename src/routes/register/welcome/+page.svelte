<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	let loginHref = '/login?registered=success';

	$: loginHref =
		$page.url.searchParams.get('purchase') === 'pending'
			? '/login?registered=success&purchase=pending'
			: '/login?registered=success';

	onMount(() => {
		const timer = window.setTimeout(() => {
			void goto(loginHref);
		}, 2600);

		return () => window.clearTimeout(timer);
	});
</script>

<svelte:head>
	<title>Welcome | Crimini</title>
</svelte:head>

<section class="welcome-shell">
	<div class="welcome-mark">
		<img src="/crimini-full-logo.jpg" alt="Crimini by NexusNorthSystems, LLC" />
	</div>
	<h1>Welcome</h1>
	<p>Taking you to sign in.</p>
	<a href={loginHref}>Continue</a>
</section>

<style>
	.welcome-shell {
		min-height: 100dvh;
		display: grid;
		place-content: center;
		justify-items: center;
		gap: 0.9rem;
		padding: clamp(1.4rem, 5vw, 4rem);
		background:
			radial-gradient(circle at 50% 20%, rgba(196, 176, 137, 0.18), transparent 28rem),
			#fbfaf7;
		color: #111214;
		text-align: center;
	}

	.welcome-mark {
		width: min(23rem, 76vw);
		overflow: hidden;
		border-radius: 28px;
	}

	.welcome-mark img {
		display: block;
		width: 100%;
		height: auto;
	}

	h1,
	p {
		margin: 0;
	}

	h1 {
		font-size: clamp(2rem, 5vw, 4.25rem);
		font-weight: 500;
		letter-spacing: -0.06em;
	}

	p {
		color: rgba(17, 18, 20, 0.68);
	}

	a {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 2.85rem;
		margin-top: 0.25rem;
		padding: 0.72rem 1.18rem;
		border: 1px solid rgba(17, 18, 20, 0.18);
		border-radius: 999px;
		background: #111214;
		color: #fbfaf7;
		font-weight: 700;
		text-decoration: none;
	}
</style>
