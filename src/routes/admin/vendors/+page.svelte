<script lang="ts">
  import { applyAction, enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import type { SubmitFunction } from '@sveltejs/kit';
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';
  import { pushToast } from '$lib/client/toasts';

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

  const withFeedback: SubmitFunction = ({ formElement }) => {
    message = '';
    return async ({ result }) => {
      await applyAction(result);
      if (result.type === 'success') {
        if (formElement.dataset.resetOnSuccess === 'true') formElement.reset();
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

  <section class="vendor-workspace">
    {#if message}
      <p class="feedback">{message}</p>
    {/if}

    <details class="vendor-panel" open>
      <summary>
        <span class="material-icons" aria-hidden="true">add_business</span>
        Add Vendor
      </summary>
      <form
        method="POST"
        action="?/create_vendor"
        use:enhance={withFeedback}
        data-reset-on-success="true"
        class="vendor-form"
      >
        <input name="name" placeholder="Vendor name" maxlength="90" required />
        <input name="website_url" placeholder="Website" maxlength="180" />
        <input name="phone" placeholder="Phone" maxlength="48" />
        <input name="contact_name" placeholder="Contact" maxlength="90" />
        <textarea name="notes" rows="3" maxlength="280" placeholder="Brief notes"></textarea>
        <select name="is_active">
          <option value="1" selected>Active</option>
          <option value="0">Hidden</option>
        </select>
        <button type="submit">Save Vendor</button>
      </form>
    </details>

    <section class="vendor-list">
      {#if data.vendors.length === 0}
        <EmptyState title="No vendors yet." compact />
      {:else}
        {#each data.vendors as vendor}
          <details class="vendor-row">
            <summary>
              <span class="vendor-summary-copy">
                <span class="material-icons" aria-hidden="true">local_shipping</span>
                <strong>{vendor.name}</strong>
              </span>
              <small>{vendor.isActive === 1 ? 'Active' : 'Hidden'}</small>
            </summary>

            <div class="vendor-view">
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
              {#if vendor.notes}
                <p>{vendor.notes}</p>
              {/if}
            </div>

            <form method="POST" action="?/update_vendor" use:enhance={withFeedback} class="vendor-form compact">
              <input type="hidden" name="id" value={vendor.id} />
              <input name="name" value={vendor.name} maxlength="90" required />
              <input name="website_url" value={vendor.websiteUrl} maxlength="180" />
              <input name="phone" value={vendor.phone} maxlength="48" />
              <input name="contact_name" value={vendor.contactName} maxlength="90" />
              <textarea name="notes" rows="3" maxlength="280">{vendor.notes}</textarea>
              <select name="is_active">
                <option value="1" selected={vendor.isActive === 1}>Active</option>
                <option value="0" selected={vendor.isActive === 0}>Hidden</option>
              </select>
              <button type="submit">Save</button>
            </form>

            <form method="POST" action="?/delete_vendor" use:enhance={withFeedback} class="delete-form">
              <input type="hidden" name="id" value={vendor.id} />
              <button type="submit" class="danger">Delete</button>
            </form>
          </details>
        {/each}
      {/if}
    </section>
  </section>
</Layout>

<style>
  .vendor-workspace {
    display: grid;
    gap: 0.9rem;
  }

  .feedback {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 0.8rem;
  }

  .vendor-panel,
  .vendor-row {
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
    padding: 0.9rem 0;
  }

  summary {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    cursor: pointer;
    list-style: none;
    font-weight: var(--weight-semibold);
  }

  summary::-webkit-details-marker {
    display: none;
  }

  .vendor-row > summary {
    display: flex;
    justify-content: space-between;
    gap: 0.8rem;
    align-items: center;
  }

  .vendor-summary-copy,
  .vendor-view span,
  .vendor-view a {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }

  .material-icons {
    color: var(--color-text-muted);
    font-size: 1rem;
    line-height: 1;
  }

  .vendor-row small,
  .vendor-view {
    color: var(--color-text-muted);
    font-size: 0.78rem;
  }

  .vendor-form {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.55rem;
    margin-top: 0.7rem;
  }

  .vendor-form.compact {
    margin-top: 0.8rem;
  }

  input,
  select,
  textarea {
    width: 100%;
    border: 0;
    border-bottom: 1px solid var(--color-divider);
    border-radius: 0;
    padding: 0.52rem 0.62rem;
    background: transparent;
    color: var(--color-text);
    font: inherit;
    font-size: 0.84rem;
  }

  textarea {
    grid-column: 1 / -1;
    resize: vertical;
  }

  button {
    border: 0;
    border-bottom: 1px solid var(--color-divider);
    border-radius: 0;
    background: transparent;
    color: var(--color-text);
    padding: 0.48rem 0.75rem;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: var(--weight-medium);
  }

  .vendor-view {
    display: flex;
    gap: 0.7rem;
    flex-wrap: wrap;
    margin-top: 0.55rem;
  }

  .vendor-view a {
    color: var(--color-text);
    text-decoration: none;
    border-bottom: 1px solid var(--color-divider);
  }

  .vendor-view p {
    flex: 1 0 100%;
    margin: 0;
    line-height: 1.45;
  }

  .delete-form {
    display: flex;
    justify-content: flex-end;
    margin-top: 0.45rem;
  }

  .danger {
    color: color-mix(in srgb, var(--color-error) 76%, var(--color-text));
    border-color: color-mix(in srgb, var(--color-error) 38%, var(--color-border));
  }

  @media (max-width: 760px) {
    .vendor-form {
      grid-template-columns: 1fr;
    }

    button,
    .delete-form {
      width: 100%;
    }
  }
</style>
