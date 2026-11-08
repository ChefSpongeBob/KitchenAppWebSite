<script lang="ts">
  import { applyAction, enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import type { SubmitFunction } from '$app/forms';
  import Layout from '#lib/components/ui/Layout.svelte';
  import ManagerSectionNav from '#lib/components/ui/ManagerSectionNav.svelte';
  import PageHeader from '#lib/components/ui/PageHeader.svelte';
  import { pushToast } from '#lib/client/toasts.ts';
  import { nativeServerUrl } from '#lib/client/nativeServerUrl.ts';

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
    timeZone: string;
  };

  export let data: {
    business: {
      displayName: string;
      logoUrl: string | null;
    };
    registry: RegistryData;
    timeZones: { value: string; label: string }[];
    billing: {
      planTier: string;
      status: string;
      store: string | null;
      currentPeriodEnd: number | null;
      autoRenewing: boolean | null;
      temperatureMonitoring: boolean;
      registeredSensors: number;
    } | null;
    canManageBilling: boolean;
  };

  let registry: RegistryData = { ...data.registry };
  let registryMessage = '';
  let editOpen = false;

  $: if (data.registry) {
    registry = { ...data.registry };
  }

  const withRegistrySaveFeedback: SubmitFunction = () => {
    registryMessage = '';
    return async ({ result }) => {
      await applyAction(result);
      if (result.type === 'success') {
        await invalidateAll();
        editOpen = false;
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

  function shown(value: string) {
    return value.trim() || 'Not set';
  }

  function planLabel(value: string) {
    if (value === 'starter' || value === 'small') return 'Small';
    if (value === 'growth' || value === 'medium') return 'Medium';
    if (value === 'enterprise' || value === 'large') return 'Large';
    return value ? value.replaceAll('_', ' ') : 'Not set';
  }

  function statusLabel(value: string) {
    if (value === 'active' || value === 'paid') return 'Active';
    if (value === 'trialing') return 'Trial';
    if (value === 'pending_setup') return 'Setup pending';
    if (value === 'queued' || value === 'pending_payment' || value === 'pending_verification') return 'Pending';
    if (value === 'grace_period') return 'Grace period';
    if (value === 'past_due') return 'Past due';
    if (value === 'missing_billing') return 'Not connected';
    return value ? value.replaceAll('_', ' ') : 'Not set';
  }

  function storeLabel(value: string | null) {
    if (value === 'app_store') return 'App Store';
    if (value === 'google_play') return 'Google Play';
    if (value === 'both') return 'App Store / Google Play';
    return 'Not connected';
  }

  function formatDate(value: number | null) {
    if (!value) return 'Not scheduled';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(value * 1000));
  }

  $: locationLine = [registry.addressCity, registry.addressState, registry.addressPostalCode]
    .filter((value) => value.trim())
    .join(', ');
  $: streetLine = [registry.addressLine1, registry.addressLine2]
    .filter((value) => value.trim())
    .join(', ');
</script>

<Layout>
  <PageHeader title="Business Registry" />
  <ManagerSectionNav groupId="business" />

  <div class="registry-page">
    <section class="business-overview">
      <header class="business-identity">
        {#if data.business.logoUrl}
          <img src={nativeServerUrl(data.business.logoUrl)} alt="" />
        {/if}
        <div>
          <span>Restaurant</span>
          <h2>{data.business.displayName || registry.legalName || 'Business'}</h2>
          <a href="/admin/app-editor">Edit Branding</a>
        </div>
      </header>

      <div class="registry-facts">
        <div>
          <span>Legal Name</span>
          <strong>{shown(registry.legalName)}</strong>
        </div>
        <div>
          <span>Registry ID</span>
          <strong>{shown(registry.registryId)}</strong>
        </div>
        <div>
          <span>Contact</span>
          <strong>{shown(registry.contactEmail)}</strong>
          {#if registry.contactPhone}<small>{registry.contactPhone}</small>{/if}
        </div>
        <div>
          <span>Address</span>
          <strong>{streetLine || 'Not set'}</strong>
          {#if locationLine}<small>{locationLine}</small>{/if}
        </div>
        <div>
          <span>Country</span>
          <strong>{shown(registry.addressCountry)}</strong>
        </div>
        <div>
          <span>Time Zone</span>
          <strong>{data.timeZones.find(option => option.value === registry.timeZone)?.label ?? registry.timeZone}</strong>
        </div>
        <div>
          <span>Website</span>
          {#if registry.websiteUrl}
            <a class="fact-link" href={registry.websiteUrl} target="_blank" rel="noreferrer">{registry.websiteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}</a>
          {:else}
            <strong>Not set</strong>
          {/if}
        </div>
      </div>
    </section>

    <details class="edit-section" bind:open={editOpen}>
      <summary>
        <span>Edit Business Information</span>
        <span class="material-icons" aria-hidden="true">expand_more</span>
      </summary>

      <form method="POST" action="?/save_registry" use:enhance={withRegistrySaveFeedback} class="registry-form">
        <div class="registry-grid">
        <label class="field field-span-2">
          <span>Legal Business Name</span>
          <input type="text" name="legal_name" bind:value={registry.legalName} maxlength="120" placeholder="Legal business name" />
        </label>

        <label class="field">
          <span>Registry ID</span>
          <input type="text" name="registry_id" bind:value={registry.registryId} maxlength="80" placeholder="State Filing Number" />
        </label>

        <label class="field">
          <span>Business Contact Email</span>
          <input type="email" name="contact_email" bind:value={registry.contactEmail} maxlength="120" placeholder="admin@northsidekitchen.com" />
        </label>

        <label class="field">
          <span>Business Contact Phone</span>
          <input type="text" name="contact_phone" bind:value={registry.contactPhone} maxlength="48" placeholder="(555) 555-0143" />
        </label>

        <label class="field">
          <span>Website</span>
          <input type="text" name="website_url" bind:value={registry.websiteUrl} maxlength="180" placeholder="https://" />
        </label>

        <label class="field field-span-2">
          <span>Address Line 1</span>
          <input type="text" name="address_line_1" bind:value={registry.addressLine1} maxlength="120" placeholder="123 Main Street" />
        </label>

        <label class="field field-span-2">
          <span>Address Line 2</span>
          <input type="text" name="address_line_2" bind:value={registry.addressLine2} maxlength="120" placeholder="Suite / Unit" />
        </label>

        <label class="field">
          <span>City</span>
          <input type="text" name="address_city" bind:value={registry.addressCity} maxlength="80" />
        </label>

        <label class="field">
          <span>State / Region</span>
          <input type="text" name="address_state" bind:value={registry.addressState} maxlength="80" />
        </label>

        <label class="field">
          <span>Postal Code</span>
          <input type="text" name="address_postal_code" bind:value={registry.addressPostalCode} maxlength="24" />
        </label>

        <label class="field">
          <span>Country</span>
          <input type="text" name="address_country" bind:value={registry.addressCountry} maxlength="80" placeholder="United States" />
        </label>
        <label class="field">
          <span>Time Zone</span>
          <select name="time_zone" bind:value={registry.timeZone} required>
            {#each data.timeZones as zone}
              <option value={zone.value}>{zone.label}</option>
            {/each}
          </select>
        </label>
        </div>

        <div class="form-actions">
          <button type="button" on:click={() => (editOpen = false)}>Cancel</button>
          <span aria-hidden="true"></span>
          <button type="submit">Save Changes</button>
        </div>
      </form>
    </details>

    {#if registryMessage}
      <p class="save-message">{registryMessage}</p>
    {/if}

    {#if data.canManageBilling && data.billing}
      <section class="billing-section">
        <header class="section-heading">
          <h2>Billing</h2>
          <a href="/billing">Manage Billing</a>
        </header>
        <div class="billing-facts">
          <div><span>Plan</span><strong>{planLabel(data.billing.planTier)}</strong></div>
          <div><span>Status</span><strong>{statusLabel(data.billing.status)}</strong></div>
          <div><span>Store</span><strong>{storeLabel(data.billing.store)}</strong></div>
          <div>
            <span>{data.billing.autoRenewing === false ? 'Ends' : 'Renews'}</span>
            <strong>{formatDate(data.billing.currentPeriodEnd)}</strong>
          </div>
          <div>
            <span>Temperature Monitoring</span>
            <strong>{data.billing.temperatureMonitoring ? 'Included' : 'Not included'}</strong>
            {#if data.billing.registeredSensors > 0}<small>{data.billing.registeredSensors} registered</small>{/if}
          </div>
        </div>
      </section>
    {/if}
  </div>
</Layout>

<style>
  :global(.main-content:has(.registry-page)) {
    max-width: 1180px;
  }

  .registry-page {
    display: grid;
    gap: 1rem;
    padding-bottom: 2rem;
  }

  .business-overview,
  .edit-section,
  .billing-section {
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
    background: transparent;
  }

  .business-identity {
    min-height: 5rem;
    padding: 0.85rem 1rem;
    display: flex;
    align-items: center;
    gap: 0.85rem;
    border-bottom: 1px solid var(--color-divider);
  }

  .business-identity img {
    width: 3rem;
    height: 3rem;
    flex: 0 0 auto;
    object-fit: contain;
  }

  .business-identity div {
    min-width: 0;
    display: grid;
    gap: 0.12rem;
  }

  .business-identity span,
  .registry-facts span,
  .billing-facts span {
    color: var(--color-text-muted);
    font-size: 0.64rem;
    font-weight: var(--weight-semibold);
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }

  .business-identity h2,
  .section-heading h2 {
    margin: 0;
    font-size: 1rem;
  }

  .business-identity a,
  .section-heading a,
  .fact-link {
    width: fit-content;
    color: var(--color-text);
    font-size: 0.74rem;
    text-decoration: none;
    border-bottom: 1px solid var(--color-divider);
  }

  .registry-facts,
  .billing-facts {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .registry-facts > div,
  .billing-facts > div {
    min-width: 0;
    min-height: 4.5rem;
    padding: 0.75rem 0.9rem;
    display: grid;
    align-content: center;
    gap: 0.18rem;
    border-right: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
    transition: background 160ms var(--ease-out);
  }

  .registry-facts > div:nth-child(3n),
  .billing-facts > div:last-child {
    border-right: 0;
  }

  .registry-facts > div:nth-last-child(-n + 3),
  .billing-facts > div {
    border-bottom: 0;
  }

  .registry-facts > div:hover,
  .billing-facts > div:hover {
    background: color-mix(in srgb, var(--color-surface-alt) 34%, transparent);
  }

  .registry-facts strong,
  .billing-facts strong,
  .fact-link {
    overflow: hidden;
    font-size: 0.82rem;
    font-weight: var(--weight-semibold);
    text-overflow: ellipsis;
  }

  .registry-facts small,
  .billing-facts small {
    overflow: hidden;
    color: var(--color-text-muted);
    font-size: 0.7rem;
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

  .registry-form {
    display: grid;
    gap: 0.8rem;
    padding: 1rem;
  }

  .registry-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.62rem;
  }

  .field-span-2 {
    grid-column: span 2;
  }

  .field {
    display: grid;
    gap: 0.34rem;
    color: var(--color-text);
    font-size: 0.8rem;
  }

  .field span {
    font-weight: var(--weight-semibold);
  }

  .field input {
    width: 100%;
    border: 0;
    border-bottom: 1px solid var(--color-border);
    border-radius: 0;
    padding: 0.5rem 0;
    background: transparent;
    color: var(--color-text);
    font-size: 0.85rem;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 0.65rem;
  }

  .form-actions span {
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
    text-decoration: none;
  }

  .save-message {
    margin: -0.5rem 0 0;
    padding: 0 1rem;
    color: var(--color-text-muted);
    font-size: 0.78rem;
  }

  .billing-section {
    display: grid;
  }

  .section-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.8rem 1rem;
    border-bottom: 1px solid var(--color-divider);
  }

  .billing-facts {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }

  .billing-facts > div {
    border-right: 1px solid var(--color-divider);
  }

  @media (max-width: 700px) {
    .registry-grid,
    .registry-facts,
    .billing-facts {
      grid-template-columns: 1fr;
    }

    .field-span-2 {
      grid-column: span 1;
    }

    .registry-facts > div,
    .registry-facts > div:nth-child(3n),
    .registry-facts > div:nth-last-child(-n + 3),
    .billing-facts > div,
    .billing-facts > div:last-child {
      border-right: 0;
      border-bottom: 1px solid var(--color-divider);
    }

    .registry-facts > div:last-child,
    .billing-facts > div:last-child {
      border-bottom: 0;
    }
  }
</style>
