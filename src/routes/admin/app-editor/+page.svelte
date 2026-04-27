<script lang="ts">
  import { applyAction, enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import type { SubmitFunction } from '@sveltejs/kit';
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { pushToast } from '$lib/client/toasts';
  import type { AppFeatureKey, AppFeatureMode } from '$lib/features/appFeatures';

  type FeatureRow = {
    key: AppFeatureKey;
    label: string;
    description: string;
    mode: AppFeatureMode;
  };

  type RegistryData = {
    legalName: string;
    registryId: string;
    contactEmail: string;
    contactPhone: string;
    websiteUrl: string;
    addressLine1: string;
    addressLine2: string;
    addressCity: string;
    addressState: string;
    addressPostalCode: string;
    addressCountry: string;
  };

  export let data: {
    branding: {
      businessName: string;
      logoUrl: string | null;
    };
    registry: RegistryData;
    features: FeatureRow[];
  };

  let features: FeatureRow[] = data.features.map((feature) => ({ ...feature }));
  let businessName = data.branding.businessName;
  let brandingMessage = '';
  let registryMessage = '';
  let featuresMessage = '';
  let registry: RegistryData = { ...data.registry };

  $: if (data.features) {
    features = data.features.map((feature) => ({ ...feature }));
  }
  $: if (data.branding) {
    businessName = data.branding.businessName;
  }
  $: if (data.registry) {
    registry = { ...data.registry };
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

  const withFeatureSaveFeedback: SubmitFunction = () => {
    featuresMessage = '';
    return async ({ result }) => {
      await applyAction(result);
      if (result.type === 'success') {
        await invalidateAll();
      }

      const message =
        result.type === 'success'
          ? (result.data?.message ?? 'App feature settings saved.')
          : result.type === 'failure'
            ? (result.data?.error ?? 'Could not save app feature settings.')
            : '';

      if (message) {
        pushToast(message, result.type === 'success' ? 'success' : 'error');
        featuresMessage = message;
      }
    };
  };

  const withRegistrySaveFeedback: SubmitFunction = () => {
    registryMessage = '';
    return async ({ result }) => {
      await applyAction(result);
      if (result.type === 'success') {
        await invalidateAll();
      }

      const message =
        result.type === 'success'
          ? (result.data?.message ?? 'Business registry information updated.')
          : result.type === 'failure'
            ? (result.data?.error ?? 'Could not save business registry information.')
            : '';

      if (message) {
        pushToast(message, result.type === 'success' ? 'success' : 'error');
        registryMessage = message;
      }
    };
  };

  function isLive(mode: AppFeatureMode) {
    return mode !== 'off';
  }

  function statusLabel(mode: AppFeatureMode) {
    if (mode === 'off') return 'Hidden';
    if (mode === 'admin') return 'Live (Admin Only)';
    return 'Live';
  }
</script>

<Layout>
  <PageHeader title="App Editor" />

  <section class="panel editor-tile" id="sidebar-branding">
    <div class="tile-top">
      <div>
        <h2>Sidebar Branding</h2>
        <p>Set the restaurant name and logo shown in the left menu.</p>
      </div>
    </div>

    <form
      method="POST"
      action="?/save_branding"
      enctype="multipart/form-data"
      use:enhance={withBrandingSaveFeedback}
      class="tile-form branding-form"
    >
      <label class="branding-field">
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

      <div class="branding-logo-row">
        <label class="branding-field">
          <span>Sidebar Logo (JPG)</span>
          <input type="file" name="sidebar_logo" accept=".jpg,.jpeg,image/jpeg" />
          <small>JPG only, up to 5MB. Square images work best.</small>
        </label>

        {#if data.branding.logoUrl}
          <div class="logo-preview" aria-label="Current sidebar logo preview">
            <img src={data.branding.logoUrl} alt="Current sidebar logo" />
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

  <section class="panel editor-tile" id="business-registry">
    <details class="panel-section">
      <summary>
        <div>
          <h2>Business Registry</h2>
          <p>Business information and registration details</p>
        </div>
      </summary>

      <form method="POST" action="?/save_registry" use:enhance={withRegistrySaveFeedback} class="tile-form">
        <div class="registry-grid">
          <label class="branding-field field-span-2">
            <span>Legal Business Name</span>
            <input type="text" name="legal_name" bind:value={registry.legalName} maxlength="120" placeholder="Northside Kitchen LLC" />
          </label>

          <label class="branding-field">
            <span>Registry ID</span>
            <input type="text" name="registry_id" bind:value={registry.registryId} maxlength="80" placeholder="State Filing Number" />
          </label>

          <label class="branding-field">
            <span>Business Contact Email</span>
            <input type="email" name="contact_email" bind:value={registry.contactEmail} maxlength="120" placeholder="admin@northsidekitchen.com" />
          </label>

          <label class="branding-field">
            <span>Business Contact Phone</span>
            <input type="text" name="contact_phone" bind:value={registry.contactPhone} maxlength="48" placeholder="(555) 555-0143" />
          </label>

          <label class="branding-field">
            <span>Website</span>
            <input type="text" name="website_url" bind:value={registry.websiteUrl} maxlength="180" placeholder="northsidekitchen.com" />
          </label>

          <label class="branding-field field-span-2">
            <span>Address Line 1</span>
            <input type="text" name="address_line_1" bind:value={registry.addressLine1} maxlength="120" placeholder="123 Main Street" />
          </label>

          <label class="branding-field field-span-2">
            <span>Address Line 2</span>
            <input type="text" name="address_line_2" bind:value={registry.addressLine2} maxlength="120" placeholder="Suite / Unit (optional)" />
          </label>

          <label class="branding-field">
            <span>City</span>
            <input type="text" name="address_city" bind:value={registry.addressCity} maxlength="80" />
          </label>

          <label class="branding-field">
            <span>State / Region</span>
            <input type="text" name="address_state" bind:value={registry.addressState} maxlength="80" />
          </label>

          <label class="branding-field">
            <span>Postal Code</span>
            <input type="text" name="address_postal_code" bind:value={registry.addressPostalCode} maxlength="24" />
          </label>

          <label class="branding-field">
            <span>Country</span>
            <input type="text" name="address_country" bind:value={registry.addressCountry} maxlength="80" placeholder="United States" />
          </label>
        </div>

        <div class="form-actions">
          <button type="submit">Save Business Registry</button>
        </div>
      </form>

      {#if registryMessage}
        <p class="save-message">{registryMessage}</p>
      {/if}
    </details>
  </section>

  <section class="panel editor-tile">
    <div class="tile-top">
      <div>
        <h2>Feature Visibility</h2>
        <p>One control card for all modules. Hidden means disabled, not deleted.</p>
      </div>
      <div class="status-legend" aria-label="Feature status legend">
        <span><i class="dot live"></i> Live</span>
        <span><i class="dot off"></i> Hidden</span>
      </div>
    </div>

    <form method="POST" action="?/save" use:enhance={withFeatureSaveFeedback} class="tile-form">
      <div class="feature-list">
        {#each features as feature}
          <article class="feature-item">
            <div class="feature-main">
              <i class="dot" class:live={isLive(feature.mode)} class:off={!isLive(feature.mode)} aria-hidden="true"></i>
              <div class="feature-copy">
                <h3>{feature.label}</h3>
                <p>{feature.description}</p>
              </div>
            </div>

            <label class="mode-field">
              <span class="status-text" class:off={feature.mode === 'off'}>{statusLabel(feature.mode)}</span>
              <select name={`feature_${feature.key}`} bind:value={feature.mode}>
                <option value="all">On</option>
                <option value="admin">Admin Only</option>
                <option value="off">Hidden</option>
              </select>
            </label>
          </article>
        {/each}
      </div>

      <div class="form-actions">
        <button type="submit">Save App Editor Settings</button>
      </div>
    </form>

    {#if featuresMessage}
      <p class="save-message">{featuresMessage}</p>
    {/if}
  </section>
</Layout>

<style>
  .panel {
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-lg);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0.01) 48%, rgba(255, 255, 255, 0)),
      color-mix(in srgb, var(--color-surface) 94%, black 6%);
    box-shadow: 0 18px 36px rgba(4, 5, 7, 0.18);
  }

  .editor-tile {
    padding: 0.9rem 1rem 1rem;
    display: grid;
    gap: 0.75rem;
  }

  .tile-top {
    display: flex;
    justify-content: space-between;
    gap: 0.9rem;
    align-items: end;
    flex-wrap: wrap;
  }

  .tile-top h2 {
    margin: 0;
    font-size: 1rem;
  }

  .tile-top p {
    margin: 0.28rem 0 0;
    color: var(--color-text-muted);
    font-size: 0.8rem;
  }

  .status-legend {
    display: inline-flex;
    gap: 0.7rem;
    align-items: center;
    font-size: 0.74rem;
    color: var(--color-text-muted);
  }

  .status-legend span {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .dot {
    width: 0.62rem;
    height: 0.62rem;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.28);
    display: inline-block;
    flex: 0 0 auto;
  }

  .dot.live {
    background: #16a34a;
    box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.15);
  }

  .dot.off {
    background: #dc2626;
    box-shadow: 0 0 0 2px rgba(220, 38, 38, 0.14);
  }

  .tile-form {
    display: grid;
    gap: 0.72rem;
  }

  .branding-form {
    gap: 0.8rem;
  }

  .registry-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.62rem;
  }

  .panel-section {
    display: grid;
    gap: 0.72rem;
  }

  .panel-section > summary {
    list-style: none;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: end;
    gap: 0.9rem;
  }

  .panel-section > summary::-webkit-details-marker {
    display: none;
  }

  .field-span-2 {
    grid-column: span 2;
  }

  .branding-field {
    display: grid;
    gap: 0.34rem;
    color: var(--color-text);
    font-size: 0.8rem;
  }

  .branding-field span {
    font-weight: var(--weight-semibold);
    letter-spacing: 0.01em;
  }

  .branding-field input[type='text'] {
    width: 100%;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 0.5rem 0.6rem;
    background: color-mix(in srgb, var(--color-surface-alt) 92%, black 8%);
    color: var(--color-text);
    font-size: 0.85rem;
  }

  .branding-field input[type='email'] {
    width: 100%;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 0.5rem 0.6rem;
    background: color-mix(in srgb, var(--color-surface-alt) 92%, black 8%);
    color: var(--color-text);
    font-size: 0.85rem;
  }

  .branding-field input[type='file'] {
    width: 100%;
    border: 1px dashed rgba(255, 255, 255, 0.2);
    border-radius: 10px;
    padding: 0.42rem 0.48rem;
    background: rgba(255, 255, 255, 0.01);
    color: var(--color-text);
    font-size: 0.78rem;
  }

  .branding-field small {
    color: var(--color-text-muted);
    font-size: 0.72rem;
  }

  .branding-logo-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.72rem;
    align-items: end;
  }

  .logo-preview {
    width: 3rem;
    height: 3rem;
    border-radius: 11px;
    overflow: hidden;
    border: 1px solid rgba(122, 132, 148, 0.28);
    background: color-mix(in srgb, var(--color-surface-alt) 88%, black 12%);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
    display: grid;
    place-items: center;
  }

  .logo-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .remove-logo {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    color: var(--color-text-muted);
    font-size: 0.78rem;
    user-select: none;
  }

  .remove-logo input {
    accent-color: #ef4444;
  }

  .feature-list {
    display: grid;
    gap: 0.5rem;
  }

  .feature-item {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(190px, 210px);
    gap: 0.65rem;
    align-items: center;
    padding: 0.5rem 0.6rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 11px;
    background: rgba(255, 255, 255, 0.015);
  }

  .feature-main {
    display: flex;
    align-items: start;
    gap: 0.5rem;
    min-width: 0;
  }

  .feature-copy h3 {
    margin: 0;
    font-size: 0.9rem;
    line-height: 1.15;
  }

  .feature-copy p {
    margin: 0.2rem 0 0;
    color: var(--color-text-muted);
    font-size: 0.75rem;
    line-height: 1.35;
  }

  .mode-field {
    display: grid;
    gap: 0.24rem;
  }

  .status-text {
    font-size: 0.72rem;
    color: #22c55e;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: var(--weight-semibold);
  }

  .status-text.off {
    color: #ef4444;
  }

  .mode-field select {
    width: 100%;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 0.42rem 0.52rem;
    background: color-mix(in srgb, var(--color-surface-alt) 92%, black 8%);
    color: var(--color-text);
    font-size: 0.8rem;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
  }

  button {
    border: 1px solid rgba(132, 146, 166, 0.28);
    border-radius: 10px;
    background: linear-gradient(180deg, rgba(132, 146, 166, 0.24), rgba(132, 146, 166, 0.08));
    color: var(--color-primary-contrast);
    padding: 0.44rem 0.72rem;
    cursor: pointer;
    font-size: 0.79rem;
    font-weight: var(--weight-semibold);
  }

  .save-message {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 0.78rem;
  }

  @media (max-width: 900px) {
    .registry-grid {
      grid-template-columns: 1fr;
    }

    .field-span-2 {
      grid-column: span 1;
    }

    .branding-logo-row {
      grid-template-columns: 1fr;
      align-items: start;
    }

    .logo-preview {
      width: 2.6rem;
      height: 2.6rem;
    }

    .feature-item {
      grid-template-columns: 1fr;
    }
  }
</style>
