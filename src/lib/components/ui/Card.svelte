<script lang="ts">
  export let interactive = false;
</script>

<div class="card {interactive ? 'interactive' : ''}">
  <slot />
</div>

<style>
  .card {
    position: relative;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--space-5);
    box-shadow: var(--shadow-xs);
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
    transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease;
  }

  .interactive:hover {
    border-color: var(--color-text);
    box-shadow: var(--shadow-xs);
  }

  .interactive:active {
    transform: translateY(1px);
    box-shadow: var(--shadow-sm);
  }

  @media (max-width: 760px) {
    .card {
      padding: 0.95rem;
      border-radius: var(--radius-md);
    }

    .card::before {
      border-radius: var(--radius-md) 0 0 var(--radius-md);
    }

  }
</style>

