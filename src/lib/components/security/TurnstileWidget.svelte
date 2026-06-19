<script lang="ts">
	import { onMount } from 'svelte';

	export let siteKey = '';

	onMount(() => {
		if (!siteKey || document.querySelector('script[data-crimini-turnstile]')) return;
		const script = document.createElement('script');
		script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
		script.async = true;
		script.defer = true;
		script.dataset.criminiTurnstile = '1';
		document.head.appendChild(script);
	});
</script>

{#if siteKey}
	<div class="turnstile-wrap">
		<div class="cf-turnstile" data-sitekey={siteKey} data-theme="light"></div>
	</div>
{/if}

<style>
	.turnstile-wrap {
		display: flex;
		justify-content: center;
		min-height: 4.1rem;
	}
</style>
