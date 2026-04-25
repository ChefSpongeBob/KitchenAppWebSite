<script lang="ts">
  import { page } from '$app/stores';
  import AdminEditorMenu from '$lib/components/ui/AdminEditorMenu.svelte';

  export let title: string;
  export let subtitle: string | null = null;

  $: showAdminEditorMenu = $page.url.pathname.startsWith('/admin');
</script>

<header class="page-header" aria-label={title} data-legacy-subtitle={subtitle ? '1' : '0'}>
  <h1>{title}</h1>

  <img class="divider-blade" src="/knife-divider.svg" alt="" aria-hidden="true" />

  {#if showAdminEditorMenu}
    <div class="admin-editor-slot">
      <AdminEditorMenu />
    </div>
  {/if}
</header>

<style>
  .page-header {
    margin-bottom: var(--space-6);
    position: relative;
    padding-left: 1rem;
  }

  h1 {
    margin: 0;
    font-size: clamp(1.65rem, 3.4vw, 2.35rem);
    font-weight: var(--weight-semibold);
    line-height: var(--line-tight);
  }

  header {
    padding-top: 3.25rem;
  }

  .divider-blade {
    display: block;
    width: 112px;
    height: auto;
    margin-top: -6px;
    margin-left: 1.35rem;
    transform: rotate(45deg);
    transform-origin: left center;
    filter:
      brightness(0) saturate(100%) invert(95%) sepia(12%) saturate(308%) hue-rotate(296deg) brightness(111%) contrast(94%)
      drop-shadow(0 2px 8px rgba(132, 146, 166, 0.18));
    opacity: 0.98;
  }

  .admin-editor-slot {
    margin-top: 0.72rem;
    width: 100%;
  }

  .page-header::before {
    content: '';
    position: absolute;
    left: 0;
    top: 3.25rem;
    width: 4px;
    height: 44px;
    border-radius: 999px;
    background: linear-gradient(180deg, var(--color-primary), rgba(132, 146, 166, 0.12));
    box-shadow: 0 0 0 1px rgba(132, 146, 166, 0.08);
  }

  @media (max-width: 760px) {
    .page-header {
      margin-bottom: var(--space-4);
      padding-left: 0.85rem;
    }

    header {
      padding-top: 2.7rem;
    }

    .page-header::before {
      top: 2.7rem;
      height: 36px;
    }

    .divider-blade {
      width: 92px;
      margin-top: -5px;
      margin-left: 1rem;
    }

    .admin-editor-slot {
      margin-top: 0.62rem;
    }

    h1 {
      font-size: 1.48rem;
      line-height: 1.2;
    }
  }
</style>

