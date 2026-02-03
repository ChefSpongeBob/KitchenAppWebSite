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
    max-width: 720px;
    margin: 0 auto;
  }

  .page.padded {
    padding: var(--space-4);
  }
</style>
