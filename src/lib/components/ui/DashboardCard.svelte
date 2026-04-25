<script>
  export let title = "";
  export let description = "";
</script>

<div class="card">
  {#if title}
    <div class="header">
      <h2>{title}</h2>
      {#if description}
        <p>{description}</p>
      {/if}
    </div>
  {/if}

  <div class="content">
    <slot />
  </div>
</div>

<style>
  :global(a) {
    color: inherit;
    text-decoration: none;
  }

  :global(a:hover),
  :global(a:focus) {
    color: inherit;
    text-decoration: none;
  }

  .card {
    position: relative;
    background:
      linear-gradient(160deg, color-mix(in srgb, var(--color-surface) 90%, var(--color-primary) 10%), color-mix(in srgb, var(--color-surface) 96%, black 4%));
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: var(--radius-lg);
    padding: 18px;
    overflow-wrap: anywhere;
    color: var(--color-text);
    box-shadow: 0 16px 34px rgba(4, 5, 7, 0.16);
  }

  .card::before {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: 3px;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    background: linear-gradient(90deg, rgba(132, 146, 166, 0.95), rgba(132, 146, 166, 0.12));
  }

  .header h2 {
    margin: 0;
    font-size: 1.06rem;
    line-height: 1.15;
    letter-spacing: -0.02em;
  }

  .header p {
    margin: 6px 0 12px;
    color: var(--color-text-muted);
    font-size: 0.82rem;
    letter-spacing: 0.02em;
  }

  .content {
    margin-top: 8px;
    color: var(--color-text);
  }

  @media (max-width: 760px) {
    .card {
      padding: 14px;
      border-radius: var(--radius-md);
    }

    .card::before {
      border-radius: var(--radius-md) var(--radius-md) 0 0;
    }

    .header h2 {
      font-size: 1rem;
      line-height: 1.2;
    }
  }
</style>

