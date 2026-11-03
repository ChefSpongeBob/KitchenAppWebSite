<script lang="ts">
  import { applyAction, enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import type { SubmitFunction } from '$app/forms';
  import Layout from '#lib/components/ui/Layout.svelte';
  import PageHeader from '#lib/components/ui/PageHeader.svelte';
  import ManagerSectionNav from '#lib/components/ui/ManagerSectionNav.svelte';
  import EmptyState from '#lib/components/ui/EmptyState.svelte';
  import { pushToast } from '#lib/client/toasts.ts';

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

  let message = '';
  let addOpen = false;
  let searchTerm = '';

  $: filteredVendors = data.vendors.filter((vendor) => {
    const query = searchTerm.trim().toLowerCase();
    const searchMatches =
      !query ||
      [vendor.name, vendor.contactName, vendor.phone, vendor.websiteUrl]
        .join(' ')
        .toLowerCase()
        .includes(query);
    return searchMatches;
  });

  const withFeedback: SubmitFunction = ({ formElement }) => {
    message = '';
    return async ({ result }) => {
      await applyAction(result);
      if (result.type === 'success') {
        if (formElement.dataset.resetOnSuccess === 'true') {
          formElement.reset();
          addOpen = false;
        }
        await invalidateAll();
      }

      message =
        result.type === 'success'
          ? result.data?.message ?? 'Vendor saved.'
          : result.type === 'failure'
            ? result.data?.error ?? 'Vendor could not be saved.'
            : '';

      if (message) pushToast(message, result.type === 'success' ? 'success' : 'error');
    };
  };
</script>

<Layout>
  <PageHeader title="Vendor Manager" />
  <ManagerSectionNav groupId="workspace" />

  <div class="vendor-page">
    <section class="vendor-summary">
      <header>
        <h2>Vendors</h2>
      </header>
      <div class="summary-grid">
        <div><span>Total</span><strong>{data.vendors.length}</strong></div>
        <div><span>Active</span><strong>{data.vendors.length}</strong></div>
      </div>
      <div class="summary-action">
        <button type="button" on:click={() => (addOpen = !addOpen)}>{addOpen ? 'Close' : 'Add Vendor'}</button>
      </div>
    </section>

    {#if addOpen}
      <section class="add-panel">
        <form
          method="POST"
          action="?/create_vendor"
          use:enhance={withFeedback}
          data-reset-on-success="true"
          class="vendor-form"
        >
          <label><span>Name</span><input name="name" maxlength="90" required /></label>
          <label><span>Website</span><input name="website_url" maxlength="180" placeholder="https://" /></label>
          <label><span>Phone</span><input name="phone" maxlength="48" /></label>
          <label><span>Contact</span><input name="contact_name" maxlength="90" /></label>
          <label class="span-two"><span>Notes</span><textarea name="notes" rows="3" maxlength="280"></textarea></label>
          <div class="form-actions"><button type="submit">Save Vendor</button></div>
        </form>
      </section>
    {/if}

    {#if message}
      <p class="feedback">{message}</p>
    {/if}

    <section class="vendor-directory">
      <div class="directory-tools">
        <label class="search-field">
          <span class="material-icons" aria-hidden="true">search</span>
          <input bind:value={searchTerm} aria-label="Search vendors" placeholder="Search vendors" />
        </label>
      </div>

      {#if data.vendors.length === 0}
        <EmptyState title="No vendors yet." compact />
      {:else if filteredVendors.length === 0}
        <p class="empty-line">No matching vendors.</p>
      {:else}
        <div class="vendor-list">
          {#each filteredVendors as vendor}
            <details class="vendor-row">
              <summary>
                <span class="vendor-name">
                  <span class="material-icons" aria-hidden="true">local_shipping</span>
                  <strong>{vendor.name}</strong>
                </span>
                <span class="vendor-contact">{vendor.contactName || vendor.phone || 'No contact set'}</span>
                <span class="material-icons expand-icon" aria-hidden="true">expand_more</span>
              </summary>

              <div class="vendor-details">
                <div class="detail-grid">
                  <div><span>Contact</span><strong>{vendor.contactName || 'Not set'}</strong></div>
                  <div><span>Phone</span><strong>{vendor.phone || 'Not set'}</strong></div>
                  <div>
                    <span>Website</span>
                    {#if vendor.websiteUrl}
                      <a href={vendor.websiteUrl} target="_blank" rel="noreferrer">Open Website</a>
                    {:else}
                      <strong>Not set</strong>
                    {/if}
                  </div>
                </div>

                {#if vendor.notes}<p class="vendor-notes">{vendor.notes}</p>{/if}

                <details class="edit-vendor">
                  <summary><span>Edit Vendor</span><span class="material-icons" aria-hidden="true">expand_more</span></summary>
                  <form method="POST" action="?/update_vendor" use:enhance={withFeedback} class="vendor-form compact">
                    <input type="hidden" name="id" value={vendor.id} />
                    <label><span>Name</span><input name="name" value={vendor.name} maxlength="90" required /></label>
                    <label><span>Website</span><input name="website_url" value={vendor.websiteUrl} maxlength="180" /></label>
                    <label><span>Phone</span><input name="phone" value={vendor.phone} maxlength="48" /></label>
                    <label><span>Contact</span><input name="contact_name" value={vendor.contactName} maxlength="90" /></label>
                    <label class="span-two"><span>Notes</span><textarea name="notes" rows="3" maxlength="280">{vendor.notes}</textarea></label>
                    <div class="form-actions"><button type="submit">Save Changes</button></div>
                  </form>
                </details>

                <form method="POST" action="?/delete_vendor" use:enhance={withFeedback} class="delete-form">
                  <input type="hidden" name="id" value={vendor.id} />
                  <button type="submit" class="danger">Delete Vendor</button>
                </form>
              </div>
            </details>
          {/each}
        </div>
      {/if}
    </section>
  </div>
</Layout>

<style>
  :global(.main-content:has(.vendor-page)) {
    max-width: 1100px;
  }

  .vendor-page {
    display: grid;
    gap: 1rem;
    padding-bottom: 2rem;
  }

  .vendor-summary,
  .add-panel,
  .vendor-directory {
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
    background: transparent;
  }

  .vendor-summary > header,
  .directory-tools {
    min-height: 3.4rem;
    padding: 0.72rem 1rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    border-bottom: 1px solid var(--color-divider);
  }

  .vendor-summary h2 {
    margin: 0;
    font-size: 1rem;
  }

  .summary-grid,
  .detail-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .summary-grid > div,
  .detail-grid > div {
    min-width: 0;
    padding: 0.72rem 0.9rem;
    display: grid;
    gap: 0.15rem;
    border-right: 1px solid var(--color-divider);
  }

  .summary-grid > div:last-child,
  .detail-grid > div:last-child {
    border-right: 0;
  }

  .summary-action {
    padding: 0.65rem 1rem;
    display: flex;
    justify-content: flex-end;
    border-top: 1px solid var(--color-divider);
  }

  .summary-grid span,
  .detail-grid span,
  .vendor-form label > span {
    color: var(--color-text-muted);
    font-size: 0.64rem;
    font-weight: var(--weight-semibold);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .summary-grid strong {
    font-size: 1.1rem;
  }

  .vendor-form {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.7rem;
    padding: 1rem;
  }

  .vendor-form label {
    display: grid;
    gap: 0.28rem;
  }

  .span-two {
    grid-column: 1 / -1;
  }

  input,
  textarea {
    width: 100%;
    border: 0;
    border-bottom: 1px solid var(--color-divider);
    border-radius: 0;
    padding: 0.5rem 0;
    background: transparent;
    color: var(--color-text);
    font: inherit;
    font-size: 0.82rem;
  }

  textarea {
    resize: vertical;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    align-items: end;
  }

  button,
  .detail-grid a {
    width: fit-content;
    border: 0;
    border-bottom: 1px solid var(--color-divider);
    border-radius: 0;
    background: transparent;
    color: var(--color-text);
    padding: 0.4rem 0.6rem;
    cursor: pointer;
    font-size: 0.76rem;
    font-weight: var(--weight-semibold);
    text-decoration: none;
  }

  .feedback,
  .empty-line {
    margin: 0;
    padding: 0 1rem;
    color: var(--color-text-muted);
    font-size: 0.78rem;
  }

  .directory-tools {
    justify-content: flex-start;
  }

  .search-field {
    min-width: min(22rem, 100%);
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }

  .search-field .material-icons {
    color: var(--color-text-muted);
    font-size: 1rem;
  }

  .vendor-row {
    border-bottom: 1px solid var(--color-divider);
  }

  .vendor-row:last-child {
    border-bottom: 0;
  }

  .vendor-row > summary {
    min-height: 3.65rem;
    padding: 0.65rem 1rem;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(130px, 0.7fr) auto;
    align-items: center;
    gap: 0.8rem;
    cursor: pointer;
    list-style: none;
    transition: background 160ms var(--ease-out);
  }

  .vendor-row > summary:hover {
    background: color-mix(in srgb, var(--color-surface-alt) 34%, transparent);
  }

  summary::-webkit-details-marker {
    display: none;
  }

  .vendor-name {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 0.55rem;
  }

  .vendor-name .material-icons,
  .expand-icon {
    color: var(--color-text-muted);
    font-size: 1rem;
  }

  .vendor-name strong,
  .vendor-contact {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .vendor-name strong {
    font-size: 0.84rem;
  }

  .vendor-contact {
    color: var(--color-text-muted);
    font-size: 0.74rem;
  }

  .expand-icon {
    transition: transform 160ms var(--ease-out);
  }

  .vendor-row[open] > summary .expand-icon,
  .edit-vendor[open] > summary .material-icons {
    transform: rotate(180deg);
  }

  .vendor-details {
    border-top: 1px solid var(--color-divider);
  }

  .detail-grid strong,
  .detail-grid a {
    overflow: hidden;
    font-size: 0.78rem;
    text-overflow: ellipsis;
  }

  .vendor-notes {
    margin: 0;
    padding: 0.8rem 1rem;
    border-top: 1px solid var(--color-divider);
    color: var(--color-text-muted);
    font-size: 0.78rem;
    line-height: 1.45;
  }

  .edit-vendor {
    border-top: 1px solid var(--color-divider);
  }

  .edit-vendor > summary {
    padding: 0.7rem 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    font-size: 0.78rem;
    font-weight: var(--weight-semibold);
    list-style: none;
  }

  .edit-vendor > summary .material-icons {
    color: var(--color-text-muted);
    font-size: 1rem;
    transition: transform 160ms var(--ease-out);
  }

  .delete-form {
    padding: 0.65rem 1rem;
    display: flex;
    justify-content: flex-end;
    border-top: 1px solid var(--color-divider);
  }

  .danger {
    color: color-mix(in srgb, var(--color-error) 76%, var(--color-text));
    border-color: color-mix(in srgb, var(--color-error) 38%, var(--color-border));
  }

  @media (max-width: 700px) {
    .vendor-form,
    .summary-grid,
    .detail-grid,
    .vendor-row > summary {
      grid-template-columns: 1fr;
    }

    .summary-grid > div,
    .summary-grid > div:last-child,
    .detail-grid > div,
    .detail-grid > div:last-child {
      border-right: 0;
      border-bottom: 1px solid var(--color-divider);
    }

    .summary-grid > div:last-child,
    .detail-grid > div:last-child {
      border-bottom: 0;
    }

    .span-two {
      grid-column: auto;
    }

    .directory-tools {
      align-items: stretch;
      flex-direction: column;
    }

    .vendor-contact {
      display: none;
    }

    .vendor-row > summary {
      grid-template-columns: minmax(0, 1fr) auto;
    }
  }
</style>
