<script lang="ts">
	import { onMount } from 'svelte';
	import { mountLoginTurnstile } from '#lib/client/turnstile.ts';

	export let siteKey = '';
	let container: HTMLDivElement;
	let unavailable = false;
	let widget: ReturnType<typeof mountLoginTurnstile> | undefined;
	export function reset() { widget?.reset(); }

	onMount(() => {
		if (!siteKey) return;
		widget = mountLoginTurnstile(container, siteKey, failed => { unavailable = failed; });
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
		min-height: 4.1rem;
	}
</style>
