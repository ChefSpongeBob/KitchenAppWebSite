<script lang="ts">
  import { applyAction, enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import type { SubmitFunction } from '@sveltejs/kit';
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { pushToast } from '$lib/client/toasts';

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
    registry: RegistryData;
    canManageBilling: boolean;
  };

  let registry: RegistryData = { ...data.registry };
  let registryMessage = '';

  $: if (data.registry) {
    registry = { ...data.registry };
  }

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
</script>

<Layout>
  <PageHeader title="Business Registry" subtitle="Business information and registration details" />

  <section class="registry-section">
    <form method="POST" action="?/save_registry" use:enhance={withRegistrySaveFeedback} class="registry-form">
      <div class="registry-grid">
        <label class="field field-span-2">
          <span>Legal Business Name</span>
          <input type="text" name="legal_name" bind:value={registry.legalName} maxlength="120" placeholder="Northside Kitchen LLC" />
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
          <input type="text" name="website_url" bind:value={registry.websiteUrl} maxlength="180" placeholder="northsidekitchen.com" />
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
      </div>

      <div class="form-actions">
        <button type="submit">Save Business Registry</button>
      </div>
    </form>

    {#if registryMessage}
      <p class="save-message">{registryMessage}</p>
    {/if}
  </section>

  {#if data.canManageBilling}
    <section class="billing-section">
      <div>
        <h2>Billing</h2>
        <p>Plan, subscription, and store billing.</p>
      </div>
      <a href="/billing">Manage Billing</a>
    </section>
  {/if}
</Layout>

<style>
  .registry-section,
  .billing-section {
    padding: 0.9rem 1rem 1rem;
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
  }

  .registry-form {
    display: grid;
    gap: 0.8rem;
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
  }

  button,
  .billing-section a {
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
    margin: 0.7rem 0 0;
    color: var(--color-text-muted);
    font-size: 0.78rem;
  }

  .billing-section {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .billing-section h2 {
    margin: 0;
    font-size: 1rem;
  }

  .billing-section p {
    margin: 0.28rem 0 0;
    color: var(--color-text-muted);
    font-size: 0.8rem;
  }

  @media (max-width: 700px) {
    .registry-grid {
      grid-template-columns: 1fr;
    }

    .field-span-2 {
      grid-column: span 1;
    }

    .billing-section {
      align-items: flex-start;
      flex-direction: column;
    }
  }
</style>
