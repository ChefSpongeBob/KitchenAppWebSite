<script lang="ts">
	import { onMount } from 'svelte';
	import { mountLoginTurnstile } from '#lib/client/turnstile.ts';
	import { mountHostedLoginTurnstile } from '#lib/client/hostedTurnstile.ts';

	export let siteKey = '';
	let container: HTMLDivElement;
	let unavailable = false;
	let widget: ReturnType<typeof mountLoginTurnstile> | undefined;
	export function reset() { widget?.reset(); }

	onMount(() => {
		if (!siteKey) return;
		const native = (window as typeof window & { __CRIMINI_NATIVE__?: boolean }).__CRIMINI_NATIVE__ === true;
		widget = native
			? mountHostedLoginTurnstile(container, failed => { unavailable = failed; })
			: mountLoginTurnstile(container, siteKey, failed => { unavailable = failed; });
		return () => widget?.destroy();
	});
</script>

{#if siteKey}
	<div class="turnstile-wrap">
		<div bind:this={container}></div>
	</div>
	{#if unavailable}
		<p role="status">Security check unavailable. <button type="button" class="auth-link-button" on:click={reset}>Retry</button></p>
	{/if}
{/if}

<style>
	.turnstile-wrap {
		display: flex;
		justify-content: center;
		width: 100%;
		min-height: 4.1rem;
	}
</style>
