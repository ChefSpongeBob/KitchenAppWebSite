<script lang="ts">
  export let interactive = false;
</script>

<div class="card {interactive ? 'interactive' : ''}">
  <slot />
</div>

<style>
  .card {
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    padding: var(--space-4);
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.04),
      0 8px 24px rgba(0, 0, 0, 0.35);

    /* 👇 separation */
    margin-bottom: var(--space-4);
  }

  /* Prevent extra space at end of lists if needed */
  .card:last-child {
    margin-bottom: 0;
  }

  .interactive {
    cursor: pointer;
    transition: transform 120ms ease, box-shadow 120ms ease;
  }

  .interactive:active {
    transform: translateY(1px);
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.06),
      0 4px 12px rgba(0, 0, 0, 0.45);
  }
</style>

