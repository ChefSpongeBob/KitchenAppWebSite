<script lang="ts">
  export let interactive = false;
</script>

<div class="card {interactive ? 'interactive' : ''}">
  <slot />
</div>

<style>
  .card {
    position: relative;
    background: transparent;
    border: 0;
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
    border-radius: 0;
    padding: var(--space-4) 0;
    box-shadow: none;
    margin-bottom: var(--space-4);
    overflow-wrap: anywhere;
  }

  .card::before {
    content: none;
  }

  .card:last-child {
    margin-bottom: 0;
  }

  .interactive {
    cursor: pointer;
    transition: color 120ms ease, border-color 120ms ease;
  }

  .interactive:hover {
    border-color: color-mix(in srgb, var(--color-text) 44%, var(--color-divider));
    box-shadow: none;
  }

  .interactive:active {
    transform: none;
    box-shadow: none;
  }

  @media (max-width: 760px) {
    .card {
      padding: 0.9rem 0;
      border-radius: 0;
    }

    .card::before {
      border-radius: var(--radius-md) 0 0 var(--radius-md);
    }

  }
</style>

