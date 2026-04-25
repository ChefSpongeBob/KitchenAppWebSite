<script lang="ts">
  export let interactive = false;
</script>

<div class="card {interactive ? 'interactive' : ''}">
  <slot />
</div>

<style>
  .card {
    position: relative;
    background:
      linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.008) 42%, rgba(255,255,255,0)),
      color-mix(in srgb, var(--color-surface) 95%, transparent);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--space-5);
    box-shadow: var(--shadow-sm);
    margin-bottom: var(--space-4);
    overflow-wrap: anywhere;
    backdrop-filter: blur(14px);
  }

  .card::before {
    content: '';
    position: absolute;
    inset: 0 auto 0 0;
    width: 4px;
    border-radius: var(--radius-lg) 0 0 var(--radius-lg);
    background: linear-gradient(180deg, rgba(132, 146, 166, 0.78), rgba(132, 146, 166, 0.18));
    opacity: 0.9;
  }

  .card:last-child {
    margin-bottom: 0;
  }

  .interactive {
    cursor: pointer;
    transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease;
  }

  .interactive:hover {
    border-color: color-mix(in srgb, var(--color-primary) 35%, var(--color-border));
    box-shadow: var(--shadow-md);
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

