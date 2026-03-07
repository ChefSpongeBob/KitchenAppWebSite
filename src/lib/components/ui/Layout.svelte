<script lang="ts">
  import { fly } from 'svelte/transition';
  export let padded = true;
</script>

<section
  class="page"
  class:padded
  in:fly={{ y: 24, duration: 550 }}
>
  <slot />
</section>

<style>
  .page {
    width: 100%;
    max-width: 780px;
    margin: 0 auto;
  }

  .page.padded {
    padding: clamp(0.75rem, 2.6vw, var(--space-4));
  }

  @media (max-width: 760px) {
    .page {
      max-width: 100%;
    }
  }
</style>
