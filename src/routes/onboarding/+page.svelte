<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import OnboardingFormPreview from '$lib/components/ui/OnboardingFormPreview.svelte';
  import { applyAction, enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { pushToast } from '$lib/client/toasts';
  import type { SubmitFunction } from '@sveltejs/kit';

  type Packet = {
    id: string;
    status: 'sent' | 'in_progress' | 'submitted' | 'returned' | 'approved';
    sent_at: number;
    submitted_at: number | null;
    approved_at: number | null;
    manager_note: string;
    version: number;
  };

  type Item = {
    id: string;
    item_type: 'form' | 'document' | 'acknowledgement';
    form_key: string;
    title: string;
    description: string;
    status: 'pending' | 'submitted' | 'approved' | 'needs_changes';
    file_url: string;
    file_name: string;
    form_payload: string;
    source_file_url: string;
    source_file_name: string;
    signed_name: string;
    manager_note: string;
    submitted_at: number | null;
  };

  export let data: {
    user: { id: string; display_name: string | null; email: string };
    profile: Record<string, string>;
    onboarding: {
      package: Packet | null;
      items: Item[];
      history: Packet[];
    };
  };

  const withFeedback: SubmitFunction = () => async ({ result }) => {
    await applyAction(result);
    if (result.type === 'success') {
      await invalidateAll();
      pushToast(result.data?.message ?? 'Saved.', 'success');
    } else if (result.type === 'failure') {
      pushToast(result.data?.error ?? 'That onboarding update could not be saved.', 'error');
    }
  };

  const statusLabel = (value: string) =>
    value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  const formatDate = (value: number | null) =>
    value ? new Date(value * 1000).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Not set';

  function payloadFor(item: Item) {
    try {
      return JSON.parse(item.form_payload || '{}') as Record<string, string>;
    } catch {
      return {};
    }
  }

  function valueFor(item: Item, key: string, fallback = '') {
    return payloadFor(item)[key] ?? fallback;
  }

  function officialForm(item: Item) {
    if (item.form_key === 'federal_i9') {
      return { label: 'Open Current Form I-9', url: 'https://www.uscis.gov/sites/default/files/document/forms/i-9.pdf' };
    }
    if (item.form_key === 'federal_w4') {
      return { label: 'Open Current Form W-4', url: 'https://www.irs.gov/pub/irs-pdf/fw4.pdf' };
    }
    return null;
  }

  $: packet = data.onboarding.package;
  $: editable = Boolean(packet && !['submitted', 'approved'].includes(packet.status));
  $: completed = data.onboarding.items.filter((item) => item.status === 'submitted' || item.status === 'approved').length;
  $: readyToSubmit = Boolean(packet && data.onboarding.items.length > 0 && completed === data.onboarding.items.length && editable);
</script>

<Layout>
  <PageHeader title="Employee Onboarding" />

  <section class="packet-shell">
    {#if !packet}
      <section class="packet-empty">
        <span class="material-symbols-outlined" aria-hidden="true">assignment_ind</span>
        <h2>No onboarding packet</h2>
        <p>Your employer has not assigned an onboarding packet.</p>
      </section>
    {:else}
      <header class="packet-header">
        <div>
          <span class="eyebrow">Packet {packet.version}</span>
          <h2>{packet.status === 'approved' ? 'Employment Records' : 'Onboarding Packet'}</h2>
          <p>{completed} of {data.onboarding.items.length} complete</p>
        </div>
        <span class={`status-pill status-pill-${packet.status}`}>{statusLabel(packet.status)}</span>
      </header>

      {#if packet.manager_note}
        <div class="packet-notice"><strong>Employer note</strong><span>{packet.manager_note}</span></div>
      {/if}

      {#if packet.status === 'submitted'}
        <div class="packet-notice"><strong>Under review</strong><span>Submitted {formatDate(packet.submitted_at)}</span></div>
      {:else if packet.status === 'approved'}
        <div class="packet-notice"><strong>Accepted</strong><span>These records are locked. A new packet is required for changes.</span></div>
      {/if}

      <div class="packet-items">
        {#each data.onboarding.items as item, index}
          {@const official = officialForm(item)}
          <article class="packet-item">
            <header>
              <span class="step">{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
              <span class={`status-pill status-pill-${item.status}`}>{statusLabel(item.status)}</span>
            </header>

            {#if item.manager_note}<p class="item-note">{item.manager_note}</p>{/if}

            {#if item.source_file_url}
              <OnboardingFormPreview src={item.source_file_url} title={item.title} fileName={item.source_file_name} label="Employer form" />
            {:else if official}
              <a class="official-link" href={official.url} target="_blank" rel="noreferrer">{official.label}</a>
            {/if}

            {#if !editable}
              <div class="record-line">
                <span>{item.file_name || (item.signed_name ? `Signed by ${item.signed_name}` : 'Submitted')}</span>
                {#if item.file_url}<a href={item.file_url} target="_blank">View document</a>{/if}
              </div>
            {:else}
              <form method="POST" action="?/submit_item" enctype="multipart/form-data" use:enhance={withFeedback} class="item-form">
                <input type="hidden" name="item_id" value={item.id} />

                {#if item.item_type === 'document'}
                  <label class="upload-field">
                    <span>{item.file_url ? 'Replace completed document' : 'Upload completed document'}</span>
                    <input name="file" type="file" accept={item.form_key ? '.pdf,application/pdf' : '.pdf,.jpg,.jpeg,.png,.webp'} required={!item.file_url} />
                  </label>
                  {#if ['federal_i9', 'federal_w4', 'state_withholding'].includes(item.form_key)}
                    <label><span>Typed name</span><input name="signed_name" value={item.signed_name} required /></label>
                    <label class="check-line"><input type="checkbox" name="official_form_confirmed" value="1" required /><span>I completed and signed the current official form.</span></label>
                  {/if}
                {:else if item.item_type === 'acknowledgement'}
                  <label class="check-line"><input type="checkbox" name="acknowledged" value="1" required /><span>I have read and acknowledge this document.</span></label>
                  <label><span>Typed name</span><input name="signed_name" value={item.signed_name} required /></label>
                {:else if item.form_key === 'personal_information'}
                  <div class="field-grid">
                    <label><span>Legal name</span><input name="legal_name" value={valueFor(item, 'legal_name', data.profile.real_name)} required /></label>
                    <label><span>Preferred name</span><input name="preferred_name" value={valueFor(item, 'preferred_name', data.user.display_name ?? '')} /></label>
                    <label><span>Date of birth</span><input name="birthday" type="date" value={valueFor(item, 'birthday', data.profile.birthday)} required /></label>
                    <label><span>Phone</span><input name="phone" type="tel" value={valueFor(item, 'phone', data.profile.phone)} required /></label>
                    <label><span>Address</span><input name="address_line_1" value={valueFor(item, 'address_line_1', data.profile.address_line_1)} required /></label>
                    <label><span>Address line 2</span><input name="address_line_2" value={valueFor(item, 'address_line_2', data.profile.address_line_2)} /></label>
                    <label><span>City</span><input name="city" value={valueFor(item, 'city', data.profile.city)} required /></label>
                    <label><span>State</span><input name="state" value={valueFor(item, 'state', data.profile.state)} required /></label>
                    <label><span>Postal code</span><input name="postal_code" value={valueFor(item, 'postal_code', data.profile.postal_code)} required /></label>
                  </div>
                  <label><span>Typed name</span><input name="signed_name" value={item.signed_name} required /></label>
                {:else if item.form_key === 'emergency_contact'}
                  <div class="field-grid">
                    <label><span>Emergency contact</span><input name="emergency_contact_name" value={valueFor(item, 'emergency_contact_name', data.profile.emergency_contact_name)} required /></label>
                    <label><span>Phone</span><input name="emergency_contact_phone" type="tel" value={valueFor(item, 'emergency_contact_phone', data.profile.emergency_contact_phone)} required /></label>
                    <label><span>Relationship</span><input name="emergency_contact_relationship" value={valueFor(item, 'emergency_contact_relationship', data.profile.emergency_contact_relationship)} required /></label>
                  </div>
                  <label><span>Typed name</span><input name="signed_name" value={item.signed_name} required /></label>
                {:else}
                  <div class="field-grid">
                    <label><span>Start date</span><input name="start_date" type="date" value={valueFor(item, 'start_date')} required /></label>
                    <label><span>Pay type</span><select name="pay_type"><option value="hourly">Hourly</option><option value="salary">Salary</option></select></label>
                    <input type="hidden" name="worker_classification" value="employee" />
                    <label class="check-line"><input type="checkbox" name="direct_deposit_authorized" value="1" /><span>Direct deposit authorization included</span></label>
                    <label><span>Bank name</span><input name="bank_name" value={valueFor(item, 'bank_name')} /></label>
                    <label><span>Routing last four</span><input name="routing_last_four" maxlength="4" value={valueFor(item, 'routing_last_four')} /></label>
                    <label><span>Account last four</span><input name="account_last_four" maxlength="4" value={valueFor(item, 'account_last_four')} /></label>
                  </div>
                  <label><span>Typed name</span><input name="signed_name" value={item.signed_name} required /></label>
                {/if}

                <button type="submit">{item.status === 'submitted' ? 'Replace Submission' : 'Save Item'}</button>
              </form>
            {/if}
          </article>
        {/each}
      </div>

      {#if readyToSubmit}
        <form method="POST" action="?/submit_packet" use:enhance={withFeedback} class="packet-submit">
          <input type="hidden" name="package_id" value={packet.id} />
          <p>Submit the complete packet to your employer for review.</p>
          <button type="submit">Submit Packet</button>
        </form>
      {/if}

      {#if data.onboarding.history.length > 1}
        <section class="history-strip">
          <h3>Packet history</h3>
          {#each data.onboarding.history as entry}
            <div><span>Packet {entry.version}</span><strong>{statusLabel(entry.status)}</strong><small>{formatDate(entry.approved_at ?? entry.submitted_at ?? entry.sent_at)}</small></div>
          {/each}
        </section>
      {/if}
    {/if}
  </section>
</Layout>

<style>
  .packet-shell { display: grid; gap: 1rem; max-width: 980px; margin: .75rem auto 0; }
  .packet-header, .packet-item, .packet-submit, .packet-empty, .history-strip { border-top: 1px solid var(--surface-outline); padding: 1rem 0; }
  .packet-header, .packet-item > header, .record-line, .history-strip div { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
  .packet-header h2, .packet-item h3, .history-strip h3 { margin: .2rem 0; }
  .packet-header p, .packet-item p, .packet-empty p { margin: 0; color: var(--color-text-muted); }
  .eyebrow, .step { font-size: .72rem; letter-spacing: .13em; text-transform: uppercase; color: var(--color-text-muted); }
  .packet-notice { display: flex; gap: .8rem; border-left: 3px solid var(--color-accent); padding: .65rem .8rem; background: var(--color-surface-subtle); }
  .packet-items { display: grid; gap: 1rem; }
  .packet-item > header { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; }
  .item-form, .field-grid { display: grid; gap: .8rem; margin-top: 1rem; }
  .field-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  label { display: grid; gap: .3rem; }
  label > span { font-size: .76rem; color: var(--color-text-muted); }
  .check-line { display: flex; align-items: center; gap: .55rem; }
  .check-line input { width: auto; }
  .official-link, .record-line a { display: inline-block; margin-top: .75rem; color: var(--color-text); text-decoration: underline; text-underline-offset: .3rem; }
  .item-note { border-left: 2px solid var(--color-danger); padding-left: .65rem; }
  .record-line { margin-top: .8rem; padding-top: .7rem; border-top: 1px solid var(--surface-outline); }
  .packet-submit { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
  .packet-submit p { margin: 0; }
  .history-strip { display: grid; gap: .65rem; }
  .history-strip div { padding: .55rem 0; border-bottom: 1px solid var(--surface-outline); }
  .history-strip small { color: var(--color-text-muted); }
  .packet-empty { text-align: center; padding: 3rem 1rem; }
  .packet-empty .material-symbols-outlined { font-size: 2rem; }
  @media (max-width: 700px) {
    .field-grid { grid-template-columns: 1fr; }
    .packet-header, .packet-submit { align-items: flex-start; flex-direction: column; }
    .packet-item > header { grid-template-columns: auto minmax(0, 1fr); }
    .packet-item > header .status-pill { grid-column: 2; justify-self: start; }
  }
</style>
