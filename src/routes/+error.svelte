<script lang="ts">
  import { page } from '$app/stores';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';

  $: status = $page.status;
  $: message = $page.error?.message ?? 'This page could not be loaded.';
</script>

<main class="error-shell">
  <EmptyState
    tone="error"
    icon="warning"
    title={`${status}`}
    description={message}
    actionLabel="Go Home"
    actionHref="/"
  />
</main>

<style>
  .error-shell {
    min-height: 100dvh;
    display: grid;
    place-items: center;
    padding: clamp(1rem, 5vw, 2.5rem);
  }
</style>
