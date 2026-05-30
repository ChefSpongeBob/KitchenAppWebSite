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
            <span class="material-icons vendor-icon" aria-hidden="true">local_shipping</span>
            <span class="vendor-copy">
              <h2>{vendor.name}</h2>
              <small>{vendor.isActive === 1 ? 'Active' : 'Hidden'}</small>
            </span>
          </div>

          <div class="vendor-contact">
            {#if vendor.websiteUrl}
              <a href={vendor.websiteUrl} target="_blank" rel="noreferrer">
                <span class="material-icons" aria-hidden="true">language</span>
                Website
              </a>
            {/if}
            {#if vendor.phone}
              <span>
                <span class="material-icons" aria-hidden="true">call</span>
                {vendor.phone}
              </span>
            {/if}
            {#if vendor.contactName}
              <span>
                <span class="material-icons" aria-hidden="true">person</span>
                {vendor.contactName}
              </span>
            {/if}
          </div>

          {#if vendor.notes}
            <p class="vendor-notes">{vendor.notes}</p>
          {/if}
        </article>
      {/each}
    {/if}

    <a class="manage-link" href="/admin/vendors">
      <span class="material-icons" aria-hidden="true">tune</span>
      + | - Manage vendors
    </a>
  </section>
</Layout>

<style>
  .vendor-list {
    display: grid;
    gap: 1rem;
  }

  .vendor-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.85rem 1.2rem;
    align-items: start;
    padding: 1rem 0;
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
  }

  .vendor-main {
    display: flex;
    align-items: center;
    gap: 0.28rem;
    min-width: 0;
  }

  .vendor-main h2 {
    margin: 0;
    font-size: 0.98rem;
  }

  .vendor-copy {
    display: grid;
    gap: 0.12rem;
    min-width: 0;
  }

  .vendor-copy small,
  .vendor-notes {
    color: var(--color-text-muted);
  }

  .vendor-notes {
    grid-column: 1 / -1;
    margin: 0;
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

  .vendor-icon,
  .vendor-contact .material-icons,
  .manage-link .material-icons {
    color: var(--color-text-muted);
    font-size: 1rem;
    line-height: 1;
  }

  .vendor-icon {
    font-size: 1.25rem;
  }

  .vendor-contact span,
  .vendor-contact a,
  .manage-link {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }

  .vendor-contact a,
  .manage-link {
    color: var(--color-text);
    text-decoration: none;
    border-bottom: 1px solid var(--color-divider);
  }

  .manage-link {
    width: fit-content;
    gap: 0.35rem;
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
