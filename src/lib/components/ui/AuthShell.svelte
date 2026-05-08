<script lang="ts">
  export let eyebrow = 'Secure Access';
  export let title = 'Welcome back';
  export let subtitle = '';
  export let supportText = '';
  export let proofItems: string[] = [];
</script>

<section class="auth-stage">
  <div class="auth-intro" aria-hidden="false">
    {#if eyebrow}
      <span class="auth-eyebrow">{eyebrow}</span>
    {/if}
    <h1>{title}</h1>
    {#if subtitle}
      <p>{subtitle}</p>
    {/if}

    {#if proofItems.length > 0}
      <div class="auth-proof-strip">
        {#each proofItems as item}
          <span>{item}</span>
        {/each}
      </div>
    {/if}

    {#if supportText}
      <p class="auth-support">{supportText}</p>
    {/if}
  </div>

  <div class="auth-panel">
    <slot />
  </div>
</section>

<style>
  .auth-stage {
    width: min(1120px, 100%);
    margin: 0 auto;
    min-height: min(720px, calc(100dvh - 12rem));
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(340px, 430px);
    gap: clamp(1rem, 4vw, 3rem);
    align-items: center;
    padding: clamp(0.35rem, 2vw, 1.25rem) 0 clamp(1rem, 3vw, 2.5rem);
  }

  .auth-intro {
    display: grid;
    gap: 1rem;
    max-width: 38rem;
    position: relative;
  }

  .auth-intro::before {
    content: '';
    position: absolute;
    width: min(360px, 58vw);
    aspect-ratio: 1;
    left: -12%;
    top: -22%;
    border-radius: 999px;
    background:
      radial-gradient(circle at 35% 32%, color-mix(in srgb, var(--color-primary) 28%, transparent), transparent 48%),
      radial-gradient(circle at 70% 70%, rgba(255,255,255,0.08), transparent 46%);
    opacity: 0.55;
    filter: blur(10px);
    pointer-events: none;
    z-index: -1;
  }

  .auth-eyebrow {
    width: fit-content;
    border: 1px solid color-mix(in srgb, var(--color-border) 84%, transparent);
    border-radius: 999px;
    padding: 0.34rem 0.66rem;
    color: var(--color-text-muted);
    font-size: 0.74rem;
    font-weight: var(--weight-semibold);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    background: color-mix(in srgb, var(--color-surface-alt) 76%, transparent);
  }

  h1 {
    margin: 0;
    color: var(--color-text);
    font-size: clamp(2.35rem, 6vw, 5rem);
    line-height: 0.94;
    letter-spacing: -0.075em;
    max-width: 10ch;
  }

  p {
    margin: 0;
  }

  .auth-intro > p:not(.auth-support) {
    max-width: 34rem;
    color: var(--color-text-muted);
    font-size: clamp(1rem, 1.7vw, 1.18rem);
    line-height: 1.55;
  }

  .auth-proof-strip {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.45rem;
    color: var(--color-text);
    font-size: 0.82rem;
    font-weight: var(--weight-semibold);
  }

  .auth-proof-strip span {
    border-left: 2px solid color-mix(in srgb, var(--color-primary) 42%, var(--color-border));
    padding-left: 0.55rem;
  }

  .auth-support {
    color: var(--color-text-muted);
    font-size: 0.9rem;
    line-height: 1.5;
    max-width: 31rem;
  }

  .auth-panel {
    position: relative;
    border: 1px solid color-mix(in srgb, var(--color-border) 88%, transparent);
    border-radius: 28px;
    background:
      linear-gradient(145deg, rgba(255,255,255,0.055), transparent 34%),
      color-mix(in srgb, var(--color-surface) 94%, black 6%);
    box-shadow: var(--shadow-md);
    padding: clamp(1.05rem, 2.4vw, 1.65rem);
    overflow: hidden;
  }

  .auth-panel::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      linear-gradient(90deg, color-mix(in srgb, var(--color-primary) 16%, transparent), transparent 34%, transparent 66%, rgba(255,255,255,0.035)),
      linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
    background-size: auto, 28px 28px, 28px 28px;
    opacity: 0.55;
  }

  .auth-panel :global(> *) {
    position: relative;
    z-index: 1;
  }

  .auth-panel :global(.auth-form) {
    display: grid;
    gap: 0.95rem;
  }

  .auth-panel :global(.auth-form-head) {
    display: grid;
    gap: 0.35rem;
    margin-bottom: 0.2rem;
  }

  .auth-panel :global(.auth-form-head h2) {
    margin: 0;
    color: var(--color-text);
    font-size: clamp(1.35rem, 3vw, 1.85rem);
    letter-spacing: -0.04em;
  }

  .auth-panel :global(.auth-form-head p),
  .auth-panel :global(.auth-copy),
  .auth-panel :global(.auth-footer),
  .auth-panel :global(.auth-subtle) {
    margin: 0;
    color: var(--color-text-muted);
    line-height: 1.5;
    font-size: 0.9rem;
  }

  .auth-panel :global(.auth-field) {
    display: grid;
    gap: 0.38rem;
  }

  .auth-panel :global(.auth-field label) {
    color: var(--color-text);
    font-size: 0.82rem;
    font-weight: var(--weight-semibold);
  }

  .auth-panel :global(.auth-input),
  .auth-panel :global(.password-row input) {
    width: 100%;
    min-height: 2.95rem;
    border: 1px solid color-mix(in srgb, var(--color-border) 88%, transparent);
    border-radius: 14px;
    background: color-mix(in srgb, var(--color-surface-alt) 90%, transparent);
    color: var(--color-text);
    padding: 0.72rem 0.82rem;
    font: inherit;
    outline: none;
    transition: border-color 160ms ease, background 160ms ease, box-shadow 160ms ease;
  }

  .auth-panel :global(.auth-input:focus),
  .auth-panel :global(.password-row input:focus) {
    border-color: color-mix(in srgb, var(--color-primary) 52%, var(--color-border));
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-primary) 16%, transparent);
  }

  .auth-panel :global(.password-row) {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.5rem;
    align-items: center;
  }

  .auth-panel :global(.auth-button),
  .auth-panel :global(.auth-secondary-button),
  .auth-panel :global(.auth-link-button) {
    min-height: 2.75rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    border-radius: 14px;
    border: 1px solid color-mix(in srgb, var(--color-border) 86%, transparent);
    color: var(--color-text);
    background: color-mix(in srgb, var(--color-surface-alt) 90%, transparent);
    font: inherit;
    font-weight: var(--weight-semibold);
    text-decoration: none;
    cursor: pointer;
    transition: transform 160ms ease, border-color 160ms ease, background 160ms ease;
  }

  .auth-panel :global(.auth-button) {
    background:
      linear-gradient(180deg, color-mix(in srgb, var(--color-primary) 28%, transparent), transparent),
      color-mix(in srgb, var(--color-surface-alt) 86%, transparent);
    border-color: color-mix(in srgb, var(--color-primary) 42%, var(--color-border));
  }

  .auth-panel :global(.auth-button:hover),
  .auth-panel :global(.auth-secondary-button:hover),
  .auth-panel :global(.auth-link-button:hover) {
    transform: translateY(-1px);
    border-color: color-mix(in srgb, var(--color-primary) 34%, var(--color-border));
  }

  .auth-panel :global(.auth-secondary-button),
  .auth-panel :global(.auth-link-button) {
    min-height: 2.35rem;
    padding: 0.45rem 0.68rem;
    font-size: 0.82rem;
  }

  .auth-panel :global(.auth-link-button) {
    border-color: transparent;
    background: transparent;
    color: var(--color-text-muted);
  }

  .auth-panel :global(.auth-alert) {
    margin: 0;
    border-radius: 14px;
    border: 1px solid color-mix(in srgb, var(--color-border) 84%, transparent);
    background: color-mix(in srgb, var(--color-surface-alt) 88%, transparent);
    color: var(--color-text);
    padding: 0.72rem 0.82rem;
    line-height: 1.45;
    font-size: 0.9rem;
  }

  .auth-panel :global(.auth-alert.error) {
    border-color: color-mix(in srgb, #ff8d92 42%, var(--color-border));
    color: #ffb3b7;
  }

  .auth-panel :global(.auth-actions-row),
  .auth-panel :global(.auth-footer-row) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.7rem;
    flex-wrap: wrap;
  }

  .auth-panel :global(.auth-divider) {
    height: 1px;
    background: color-mix(in srgb, var(--color-border) 76%, transparent);
    margin: 0.15rem 0;
  }

  @media (max-width: 860px) {
    .auth-stage {
      min-height: auto;
      grid-template-columns: 1fr;
      align-items: start;
      gap: 1.1rem;
      padding-top: 0.35rem;
    }

    .auth-intro {
      gap: 0.7rem;
    }

    h1 {
      max-width: 12ch;
      font-size: clamp(2.2rem, 14vw, 3.6rem);
    }

    .auth-panel {
      border-radius: 22px;
    }

    .auth-panel :global(.password-row) {
      grid-template-columns: 1fr;
    }
  }
</style>
