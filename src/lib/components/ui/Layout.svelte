<script lang="ts">
  import { page } from '$app/stores';
  import { fly } from 'svelte/transition';

  export let padded = true;

  $: pathname = $page.url.pathname;
  $: workspace =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/schedule') ||
    pathname.startsWith('/my-schedule') ||
    pathname.startsWith('/lists') ||
    pathname.startsWith('/docs') ||
    pathname.startsWith('/recipes') ||
    pathname.startsWith('/settings');
</script>

<section
  class="page"
  class:padded
  class:workspace
  in:fly={{ y: 24, duration: 550 }}
>
  <slot />
</section>

<style>
  .page {
    width: 100%;
    max-width: 920px;
    margin: 0 auto;
  }

  .page.workspace {
    max-width: min(1180px, 100%);
  }

  .page.padded {
    padding: clamp(0.85rem, 2vw, var(--space-5));
  }

  @media (max-width: 760px) {
    .page {
      max-width: 100%;
    }

    .page.padded {
      padding: clamp(0.7rem, 3.5vw, var(--space-4));
    }
  }
</style>
