<script lang="ts">
  import { page } from '$app/stores';
  import AdminEditorMenu from '$lib/components/ui/AdminEditorMenu.svelte';

  export let title: string;
  export let subtitle: string | null = null;

  $: showAdminEditorMenu = $page.url.pathname.startsWith('/admin');
</script>

<header class="page-header" aria-label={title} data-legacy-subtitle={subtitle ? '1' : '0'}>
  <div class="title-block">
    <span class="header-rule" aria-hidden="true"></span>
    <h1>{title}</h1>
    {#if subtitle}
      <p>{subtitle}</p>
    {/if}
  </div>

  {#if showAdminEditorMenu}
    <div class="admin-editor-slot">
      <AdminEditorMenu />
    </div>
  {/if}

  <span class="page-header-divider" aria-hidden="true"></span>
</header>

<style>
  .page-header {
    margin-bottom: clamp(var(--space-4), 2.2vw, var(--space-6));
    position: relative;
    padding-top: clamp(2.4rem, 4vw, 3.15rem);
  }

  .title-block {
    display: grid;
    gap: 0.35rem;
    max-width: 56rem;
  }

  .header-rule {
    width: clamp(2.5rem, 7vw, 4.5rem);
    height: 1px;
    border-radius: 0;
    background: var(--color-text);
  }

  h1 {
    margin: 0;
    font-size: clamp(1.7rem, 3.2vw, 2.55rem);
    font-weight: var(--weight-semibold);
    line-height: 1.02;
    letter-spacing: -0.045em;
  }

  p {
    margin: 0;
    max-width: 44rem;
    color: var(--color-text-muted);
    font-size: clamp(0.92rem, 1.5vw, 1rem);
  }

  .admin-editor-slot {
    margin-top: 0.9rem;
    width: 100%;
  }

  .page-header-divider {
    display: block;
    width: 100%;
    margin-top: 0.95rem;
    border-bottom: 1px solid color-mix(in srgb, var(--color-text) 16%, transparent);
  }

  @media (max-width: 760px) {
    .page-header {
      margin-bottom: var(--space-4);
      padding-top: 2.45rem;
    }

    .admin-editor-slot {
      margin-top: 0.62rem;
    }

    .page-header-divider {
      margin-top: 0.72rem;
    }

    h1 {
      font-size: 1.55rem;
      line-height: 1.08;
    }
  }
</style>

