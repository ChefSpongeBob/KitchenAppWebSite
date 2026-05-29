<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';

  type Vendor = {
    id: string;
    name: string;
    websiteUrl: string;
    phone: string;
    contactName: string;
    notes: string;
    isActive: number;
    updatedAt: number;
  };

  export let data: { vendors: Vendor[] };
</script>

<Layout>
  <PageHeader title="Vendors" />

  <section class="vendor-list">
    {#if data.vendors.length === 0}
      <EmptyState title="No vendors yet." compact />
    {:else}
      {#each data.vendors as vendor}
        <article class="vendor-row">
          <div class="vendor-main">
            <h2>{vendor.name}</h2>
            {#if vendor.notes}
              <p>{vendor.notes}</p>
            {/if}
          </div>

          <div class="vendor-contact">
            {#if vendor.websiteUrl}
              <a href={vendor.websiteUrl} target="_blank" rel="noreferrer">Website</a>
            {/if}
            {#if vendor.phone}
              <span>{vendor.phone}</span>
            {/if}
            {#if vendor.contactName}
              <span>{vendor.contactName}</span>
            {/if}
          </div>
        </article>
      {/each}
    {/if}

    <a class="manage-link" href="/admin/vendors">+ | - Manage vendors</a>
  </section>
</Layout>

<style>
  .vendor-list {
    display: grid;
    gap: 0.8rem;
  }

  .vendor-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.85rem;
    align-items: start;
    padding-bottom: 0.85rem;
    border-bottom: 1px solid var(--color-divider);
  }

  .vendor-main {
    display: grid;
    gap: 0.28rem;
    min-width: 0;
  }

  .vendor-main h2 {
    margin: 0;
    font-size: 0.98rem;
  }

  .vendor-main p {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 0.82rem;
    line-height: 1.45;
  }

  .vendor-contact {
    display: flex;
    justify-content: flex-end;
    gap: 0.55rem;
    flex-wrap: wrap;
    color: var(--color-text-muted);
    font-size: 0.78rem;
    max-width: 22rem;
  }

  .vendor-contact a,
  .manage-link {
    color: var(--color-text);
    text-decoration: none;
    border-bottom: 1px solid var(--color-border);
  }

  .manage-link {
    width: fit-content;
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }

  .manage-link:hover,
  .vendor-contact a:hover {
    color: var(--color-text);
    border-bottom-color: var(--color-text);
  }

  @media (max-width: 760px) {
    .vendor-row {
      grid-template-columns: 1fr;
    }

    .vendor-contact {
      justify-content: flex-start;
    }
  }
</style>
