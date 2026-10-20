<script lang="ts">
  import { applyAction, enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import type { SubmitFunction } from '@sveltejs/kit';
  import Layout from '$lib/components/ui/Layout.svelte';
  import ManagerSectionNav from '$lib/components/ui/ManagerSectionNav.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { pushToast } from '$lib/client/toasts';
  import { nativeServerUrl } from '$lib/client/nativeServerUrl';

  export let data: {
    branding: {
      businessName: string;
      logoUrl: string | null;
    };
  };

  let businessName = data.branding.businessName;
  let brandingMessage = '';
  let editOpen = false;

  $: if (data.branding) {
    businessName = data.branding.businessName;
  }

  const withBrandingSaveFeedback: SubmitFunction = () => {
    brandingMessage = '';
    return async ({ result }) => {
      await applyAction(result);
      if (result.type === 'success') {
        await invalidateAll();
        editOpen = false;
      }

      const message =
        result.type === 'success'
          ? (result.data?.message ?? 'Sidebar branding updated.')
          : result.type === 'failure'
            ? (result.data?.error ?? 'Could not save sidebar branding.')
            : '';

      if (message) {
        pushToast(message, result.type === 'success' ? 'success' : 'error');
        brandingMessage = message;
      }
    };
  };
</script>

<Layout>
  <PageHeader title="App Editor" />
  <ManagerSectionNav groupId="workspace" />

  <div class="editor-page">
    <section class="branding-overview" id="sidebar-branding">
      <div class="branding-preview">
        {#if data.branding.logoUrl}
          <img src={nativeServerUrl(data.branding.logoUrl)} alt="" />
        {:else}
          <span class="material-icons" aria-hidden="true">storefront</span>
        {/if}
        <div>
          <small>Sidebar Branding</small>
          <h2>{data.branding.businessName || 'Restaurant'}</h2>
        </div>
      </div>

      <div class="branding-facts">
        <div><span>Restaurant Name</span><strong>{data.branding.businessName || 'Not set'}</strong></div>
        <div><span>Restaurant Logo</span><strong>{data.branding.logoUrl ? 'Uploaded' : 'Not set'}</strong></div>
      </div>
    </section>

    <details class="edit-section" bind:open={editOpen}>
      <summary>
        <span>Edit Branding</span>
        <span class="material-icons" aria-hidden="true">expand_more</span>
      </summary>

      <form
        method="POST"
        action="?/save_branding"
        enctype="multipart/form-data"
        use:enhance={withBrandingSaveFeedback}
        class="branding-form"
      >
        <label class="field">
          <span>Restaurant Name</span>
          <input
            type="text"
            name="business_name"
            bind:value={businessName}
            maxlength="80"
            required
            placeholder="Restaurant name"
          />
        </label>

        <div class="logo-row">
          <label class="field">
            <span>Restaurant Logo (JPG)</span>
            <input type="file" name="sidebar_logo" accept=".jpg,.jpeg,image/jpeg" />
            <small>JPG, up to 5MB.</small>
          </label>

          {#if data.branding.logoUrl}
            <div class="logo-preview" aria-label="Current restaurant logo">
              <img src={nativeServerUrl(data.branding.logoUrl)} alt="" />
            </div>
          {/if}
        </div>

        {#if data.branding.logoUrl}
          <label class="remove-logo">
            <input type="checkbox" name="remove_logo" value="1" />
            <span>Remove current logo</span>
          </label>
        {/if}

        <div class="form-actions">
          <button type="button" on:click={() => (editOpen = false)}>Cancel</button>
          <i aria-hidden="true"></i>
          <button type="submit">Save Changes</button>
        </div>
      </form>
    </details>

    {#if brandingMessage}
      <p class="save-message">{brandingMessage}</p>
    {/if}

    <section class="registry-link">
      <h2>Business Information</h2>
      <a href="/admin/business-registry">Business Registry</a>
    </section>
  </div>
</Layout>

<style>
  :global(.main-content:has(.editor-page)) {
    max-width: 1040px;
  }

  .editor-page {
    display: grid;
    gap: 1rem;
    padding-bottom: 2rem;
  }

  .branding-overview,
  .edit-section,
  .registry-link {
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
    background: transparent;
  }

  .branding-preview {
    min-height: 5rem;
    padding: 0.85rem 1rem;
    display: flex;
    align-items: center;
    gap: 0.85rem;
    border-bottom: 1px solid var(--color-divider);
  }

  .branding-preview > img,
  .branding-preview > .material-icons {
    width: 3rem;
    height: 3rem;
    flex: 0 0 auto;
  }

  .branding-preview > img {
    object-fit: contain;
  }

  .branding-preview > .material-icons {
    display: grid;
    place-items: center;
    color: var(--color-text-muted);
    font-size: 1.65rem;
  }

  .branding-preview > div {
    min-width: 0;
    display: grid;
    gap: 0.12rem;
  }

  .branding-preview small,
  .branding-facts span {
    color: var(--color-text-muted);
    font-size: 0.64rem;
    font-weight: var(--weight-semibold);
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }

  .branding-preview h2,
  .registry-link h2 {
    margin: 0;
    font-size: 1rem;
  }

  .branding-facts {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .branding-facts > div {
    min-width: 0;
    min-height: 4.25rem;
    padding: 0.75rem 0.9rem;
    display: grid;
    align-content: center;
    gap: 0.18rem;
    border-right: 1px solid var(--color-divider);
    transition: background 160ms var(--ease-out);
  }

  .branding-facts > div:last-child {
    border-right: 0;
  }

  .branding-facts > div:hover {
    background: color-mix(in srgb, var(--color-surface-alt) 34%, transparent);
  }

  .branding-facts strong {
    overflow: hidden;
    font-size: 0.82rem;
    text-overflow: ellipsis;
  }

  .edit-section summary {
    padding: 0.8rem 1rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    cursor: pointer;
    font-size: 0.82rem;
    font-weight: var(--weight-semibold);
    list-style: none;
  }

  .edit-section summary::-webkit-details-marker {
    display: none;
  }

  .edit-section summary .material-icons {
    color: var(--color-text-muted);
    font-size: 1rem;
    transition: transform 160ms var(--ease-out);
  }

  .edit-section[open] summary {
    border-bottom: 1px solid var(--color-divider);
  }

  .edit-section[open] summary .material-icons {
    transform: rotate(180deg);
  }

  .branding-form,
  .field {
    display: grid;
    gap: 0.45rem;
  }

  .branding-form {
    padding: 1rem;
  }

  .field {
    color: var(--color-text);
    font-size: 0.8rem;
  }

  .field span {
    font-weight: var(--weight-semibold);
  }

  .field input[type='text'] {
    width: 100%;
    border: 0;
    border-bottom: 1px solid var(--color-border);
    border-radius: 0;
    padding: 0.5rem 0;
    background: transparent;
    color: var(--color-text);
    font-size: 0.85rem;
  }

  .field input[type='file'] {
    width: 100%;
    border: 0;
    border-bottom: 1px dashed var(--color-border);
    border-radius: 0;
    padding: 0.42rem 0.48rem;
    background: transparent;
    color: var(--color-text);
    font-size: 0.78rem;
  }

  .field small,
  .save-message {
    color: var(--color-text-muted);
    font-size: 0.74rem;
  }

  .logo-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.72rem;
    align-items: end;
  }

  .logo-preview {
    width: 3rem;
    height: 3rem;
    overflow: hidden;
    display: grid;
    place-items: center;
  }

  .logo-preview img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .remove-logo {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    color: var(--color-text-muted);
    font-size: 0.78rem;
  }

  .remove-logo input {
    accent-color: var(--color-error);
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 0.65rem;
  }

  .form-actions i {
    width: 1px;
    height: 1rem;
    background: var(--color-divider);
  }

  button {
    border: 0;
    border-bottom: 1px solid var(--color-border);
    border-radius: 0;
    background: transparent;
    color: var(--color-text);
    padding: 0.44rem 0.72rem;
    cursor: pointer;
    font-size: 0.79rem;
    font-weight: var(--weight-semibold);
  }

  .save-message {
    margin: -0.5rem 0 0;
    padding: 0 1rem;
  }

  .registry-link {
    padding: 0.8rem 1rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .registry-link a {
    color: var(--color-text);
    font-size: 0.76rem;
    font-weight: var(--weight-semibold);
    text-decoration: none;
    border-bottom: 1px solid var(--color-divider);
  }

  @media (max-width: 900px) {
    .logo-row {
      grid-template-columns: 1fr;
      align-items: start;
    }
  }

  @media (max-width: 600px) {
    .branding-facts {
      grid-template-columns: 1fr;
    }

    .branding-facts > div,
    .branding-facts > div:last-child {
      border-right: 0;
      border-bottom: 1px solid var(--color-divider);
    }

    .branding-facts > div:last-child {
      border-bottom: 0;
    }
  }
</style>
