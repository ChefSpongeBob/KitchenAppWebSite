<section class="form">
  <slot />
</section>

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  /* Slight extra space before action buttons */
  .form :global(button) {
    margin-top: var(--space-2);
  }
</style>
