<script lang="ts">
  import PdfPageStack from '$lib/components/ui/PdfPageStack.svelte';

  export let src = '';
  export let title = 'Onboarding form';
  export let fileName = '';
  export let label = 'Active form';

  let open = false;

  $: isPdf = /\.pdf(?:$|[?#])/i.test(src);
  $: displayName = fileName || title || 'View form';
</script>

{#if src}
  <section class="form-preview">
    <div class="form-preview__head">
      <span>{label}</span>
      <a href={src} target="_blank" rel="noreferrer">{displayName}</a>
      <button type="button" on:click={() => (open = !open)}>
        {open ? 'Hide' : 'Preview'}
      </button>
    </div>

    {#if open}
      <div class="form-preview__stage">
        {#if isPdf}
          <PdfPageStack {src} {title} />
        {:else}
          <img src={src} alt={title} loading="lazy" />
        {/if}
      </div>
    {/if}
  </section>
{/if}

<style>
  .form-preview {
    display: grid;
    gap: 0.6rem;
    padding: 0.7rem 0;
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
  }

  .form-preview__head {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 0.7rem;
    align-items: center;
  }

  .form-preview__head span {
    color: var(--color-text-muted);
    font-size: 0.72rem;
    font-weight: var(--weight-semibold);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .form-preview__head a,
  .form-preview__head button {
    width: fit-content;
    min-width: 0;
    border: 0;
    border-bottom: 1px solid var(--color-border);
    border-radius: 0;
    background: transparent;
    color: var(--color-text-soft);
    padding: 0.28rem 0.18rem;
    font: inherit;
    font-size: 0.8rem;
    font-weight: var(--weight-medium);
    text-decoration: none;
    cursor: pointer;
  }

  .form-preview__head a {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .form-preview__head button {
    justify-self: end;
  }

  .form-preview__stage {
    display: grid;
    max-height: 34rem;
    overflow: auto;
    border-top: 1px solid var(--color-divider);
    padding-top: 0.7rem;
  }

  .form-preview__stage img {
    width: 100%;
    max-height: 32rem;
    object-fit: contain;
  }

  @media (max-width: 700px) {
    .form-preview__head {
      grid-template-columns: 1fr;
      gap: 0.35rem;
    }

    .form-preview__head button {
      justify-self: start;
    }
  }
</style>
