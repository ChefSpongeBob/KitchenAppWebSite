<script>
  export let title = "";
  export let description = "";
  export let role = null;        // optional role (like "button") from parent
  export let tabindex = null;    // optional tabindex
  export let ariaExpanded = null; // optional aria-expanded
</script>

<div
  class="card"
  {role}
  {tabindex}
  aria-expanded={ariaExpanded}
>
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
  .link-card a {
    color: var(--color-text) !important;
    text-decoration: none;
  }

  .card {
    background: var(--color-surface, #1e1e1e);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 14px;
    padding: 16px;
    cursor: pointer; /* indicates interactivity if clickable */
    transition: box-shadow 0.2s ease, transform 0.2s ease;
  }

  .card:focus {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  .card:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }

  .header h2 {
    margin: 0;
    font-size: 1.1rem;
  }

  .header p {
    margin: 4px 0 12px;
    opacity: 0.7;
    font-size: 0.9rem;
  }

  .content {
    margin-top: 8px;
  }
</style>
