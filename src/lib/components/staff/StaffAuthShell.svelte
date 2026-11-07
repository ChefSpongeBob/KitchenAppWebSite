<script lang="ts">
  export let title = 'Staff Sign In';
</script>

<section class="staff-auth" aria-labelledby="staff-auth-title">
  <div class="staff-auth-panel">
    <div class="staff-auth-brand">
      <img src="/crimini-mushrooms.svg" alt="" aria-hidden="true" />
      <span>Crimini <strong>Staff</strong></span>
    </div>
    <h1 id="staff-auth-title">{title}</h1>
    <slot />
  </div>
</section>

<style>
  .staff-auth { min-height: calc(100dvh - 3rem); display: grid; place-items: center; padding: 2rem 0; }
  .staff-auth-panel { width: min(100%, 25rem); min-width: 0; padding: 1.75rem clamp(0.75rem, 3vw, 1.5rem); border-block: 1px solid var(--color-divider); background: linear-gradient(135deg, color-mix(in srgb, var(--color-surface) 65%, transparent), transparent); }
  .staff-auth-brand { display: flex; align-items: center; gap: 0.65rem; color: var(--color-text-muted); font-size: 0.85rem; }
  .staff-auth-brand img { width: 35px; height: 30px; object-fit: contain; filter: invert(1); }
  .staff-auth-brand strong { font-weight: 500; color: var(--color-text); }
  h1 { margin: 1.5rem 0; font-size: 1.85rem; letter-spacing: -0.045em; }
  .staff-auth-panel :global(form), .staff-auth-panel :global(.auth-stack) { display: grid; gap: 1.15rem; }
  .staff-auth-panel :global(label), .staff-auth-panel :global(.auth-field) { display: grid; gap: 0.4rem; font-size: 0.8rem; }
  .staff-auth-panel :global(input:not([type="hidden"])) { width: 100%; min-width: 0; border: 0; border-bottom: 1px solid var(--color-border); border-radius: 0; background: transparent; padding: 0.7rem 0; color: var(--color-text); }
  .staff-auth-panel :global(.password-row) { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0.6rem; align-items: center; }
  .staff-auth-panel :global(button), .staff-auth-panel :global(a) { border: 0; border-bottom: 1px solid var(--color-divider); border-radius: 0; background: transparent; color: var(--color-text); min-height: 2.75rem; font-size: 0.85rem; text-decoration: none; }
  .staff-auth-panel :global(button[type="submit"]) { font-weight: 600; border-bottom-color: var(--color-text-muted); }
  .staff-auth-panel :global(.auth-label-row) { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; }
  .staff-auth-panel :global(.auth-label-row a) { min-height: auto; font-size: 0.75rem; color: var(--color-text-muted); }
  .staff-auth-panel :global(.auth-form-head) { display: none; }
  .staff-auth-panel :global(p) { margin: 0; font-size: 0.85rem; line-height: 1.55; color: var(--color-text-muted); }
  .staff-auth-panel :global(.auth-alert.error), .staff-auth-panel :global(.staff-feedback.error) { color: var(--color-error); }
  .staff-auth-panel :global(.staff-auth-exit) { margin-top: 1.25rem; }
  .staff-auth-panel :global(.staff-auth-exit button) { font-weight: 400; font-size: 0.75rem; color: var(--color-text-muted); justify-self: start; }
</style>
