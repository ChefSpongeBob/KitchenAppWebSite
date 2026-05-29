<div class="row tap">
  <slot />
</div>

<style>
  .row {
    display: flex;
    align-items: center;

    padding: var(--space-4) 0;
    background: transparent;
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
    border-radius: 0;

    font-size: var(--text-md);
    color: var(--color-text);

    box-shadow: none;
  }
</style>
