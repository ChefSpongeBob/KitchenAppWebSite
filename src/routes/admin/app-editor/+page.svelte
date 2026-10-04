<script lang="ts">
  import { applyAction, enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import type { SubmitFunction } from '@sveltejs/kit';
  import Layout from '$lib/components/ui/Layout.svelte';
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

  $: if (data.branding) {
    businessName = data.branding.businessName;
  }

  const withBrandingSaveFeedback: SubmitFunction = () => {
    brandingMessage = '';
    return async ({ result }) => {
      await applyAction(result);
      if (result.type === 'success') {
        await invalidateAll();
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

  <section class="editor-section" id="sidebar-branding">
    <div class="section-heading">
      <h2>Sidebar Branding</h2>
      <p>Set the restaurant name and logo shown in the left menu.</p>
    </div>

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
          placeholder="Enter your restaurant name"
        />
      </label>

      <div class="logo-row">
        <label class="field">
          <span>Sidebar Logo (JPG)</span>
          <input type="file" name="sidebar_logo" accept=".jpg,.jpeg,image/jpeg" />
          <small>JPG only, up to 5MB. Square images work best.</small>
        </label>

        {#if data.branding.logoUrl}
          <div class="logo-preview" aria-label="Current sidebar logo preview">
            <img src={nativeServerUrl(data.branding.logoUrl)} alt="Current sidebar logo" />
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
        <button type="submit">Save Sidebar Branding</button>
      </div>
    </form>

    {#if brandingMessage}
      <p class="save-message">{brandingMessage}</p>
    {/if}
  </section>
</Layout>

<style>
  .editor-section {
    padding: 0.9rem 1rem 1rem;
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
    display: grid;
    gap: 0.8rem;
  }

  .section-heading h2 {
    margin: 0;
    font-size: 1rem;
  }

  .section-heading p {
    margin: 0.28rem 0 0;
    color: var(--color-text-muted);
    font-size: 0.8rem;
  }

  .branding-form,
  .field {
    display: grid;
    gap: 0.45rem;
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
    border: 1px solid var(--color-border);
    display: grid;
    place-items: center;
  }

  .logo-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
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
    margin: 0;
  }

  @media (max-width: 900px) {
    .logo-row {
      grid-template-columns: 1fr;
      align-items: start;
    }
  }
</style>
