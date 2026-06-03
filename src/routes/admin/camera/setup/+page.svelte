<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { applyAction, enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { pushToast } from '$lib/client/toasts';
  import type { SubmitFunction } from '@sveltejs/kit';

  type IoTDevice = {
    id: string;
    businessId: string;
    deviceType: 'sensor' | 'camera' | 'sensor_gateway';
    externalDeviceId: string;
    displayName: string;
    keyPrefix: string;
    isActive: number;
    lastSeenAt: number | null;
    revokedAt: number | null;
    createdAt: number;
    updatedAt: number;
  };

  export let data: { iotDevices: IoTDevice[] };

  let feedbackMessage = '';

  $: cameraDevices = data.iotDevices.filter((device) => device.deviceType === 'camera');
  $: activeCameraCount = cameraDevices.filter((device) => device.isActive === 1).length;
  $: latestCameraSeen = Math.max(0, ...cameraDevices.map((device) => device.lastSeenAt ?? 0));

  function formatShortTime(value: number | null) {
    if (!value) return 'None';
    return new Date(value * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const withFeedback: SubmitFunction = () => {
    feedbackMessage = '';
    return async ({ result }) => {
      await applyAction(result);
      if (result.type === 'success') {
        await invalidateAll();
        pushToast('Camera setup updated.', 'success');
      } else if (result.type === 'failure') {
        pushToast(result.data?.error ?? 'That action could not be completed.', 'error');
      }
      feedbackMessage =
        result.type === 'success'
          ? 'Camera setup updated.'
          : result.type === 'failure'
            ? result.data?.error ?? 'That action could not be completed.'
            : '';
    };
  };
</script>

<Layout>
  <PageHeader title="Camera Setup" />

  {#if feedbackMessage}
    <p class="feedback-banner">{feedbackMessage}</p>
  {/if}

  <section class="status-strip" aria-label="Camera setup status">
    <div>
      <span>Cameras</span>
      <strong>{activeCameraCount}/{cameraDevices.length}</strong>
    </div>
    <div>
      <span>Latest Check-In</span>
      <strong>{formatShortTime(latestCameraSeen)}</strong>
    </div>
  </section>

  <section class="unit-workbench">
    <details class="register-panel">
      <summary class="section-heading">
        <span class="material-icons" aria-hidden="true">add_circle</span>
        <div>
          <h2>Register Camera</h2>
          <p>Serial number and name.</p>
        </div>
      </summary>

      <form method="POST" action="?/register_iot_unit" use:enhance={withFeedback}>
        <div class="register-grid">
          <label>
            <span>Unit Serial</span>
            <input name="external_device_id" placeholder="CRIMINI-CAM-001" required />
          </label>
          <label>
            <span>Name</span>
            <input name="display_name" placeholder="Walk-in camera" required />
          </label>
        </div>

        <div class="button-line">
          <button type="submit">Register</button>
        </div>
      </form>
    </details>

    <details class="registered-panel">
      <summary class="section-heading">
        <span class="material-icons" aria-hidden="true">videocam</span>
        <div>
          <h2>Registered Cameras</h2>
          <p>{activeCameraCount} active</p>
        </div>
      </summary>

      <div class="unit-list">
        {#if cameraDevices.length === 0}
          <p class="empty-line">No cameras registered yet.</p>
        {:else}
          {#each cameraDevices as device}
            <article class="unit-row" class:muted={device.isActive !== 1}>
              <span class="material-icons" aria-hidden="true">videocam</span>
              <div>
                <strong>{device.displayName}</strong>
                <small>{device.externalDeviceId}</small>
                <small>Last seen {formatShortTime(device.lastSeenAt)}</small>
              </div>
              {#if device.isActive === 1}
                <form method="POST" action="?/revoke_iot_device" use:enhance={withFeedback}>
                  <input type="hidden" name="id" value={device.id} />
                  <button type="submit" class="danger">Revoke</button>
                </form>
              {:else}
                <span class="status-text">Revoked</span>
              {/if}
            </article>
          {/each}
        {/if}
      </div>
    </details>
  </section>
</Layout>

<style>
  .feedback-banner {
    border: 1px solid var(--color-divider);
    background: color-mix(in srgb, var(--color-surface) 88%, transparent);
  }

  .feedback-banner {
    margin: 0 0 0.9rem;
    padding: 0.72rem 0.9rem;
    color: var(--color-text);
  }

  .status-strip {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
  }

  .status-strip > div {
    display: grid;
    gap: 0.18rem;
    min-width: 0;
    padding: 0.9rem 1rem;
    border-left: 1px solid var(--color-divider);
  }

  .status-strip > div:first-child {
    border-left: 0;
  }

  .status-strip span,
  .section-heading p,
  .unit-row small,
  .empty-line {
    color: var(--color-text-muted);
  }

  .status-strip strong {
    font-size: clamp(1.1rem, 1.7vw, 1.42rem);
  }

  .unit-workbench {
    display: grid;
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
    gap: 1rem;
    margin-top: 1rem;
  }

  .register-panel,
  .registered-panel {
    min-width: 0;
    padding: 1rem;
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
    background: linear-gradient(180deg, color-mix(in srgb, var(--color-surface) 96%, transparent), transparent);
  }

  .section-heading {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    margin-bottom: 0;
    list-style: none;
    cursor: pointer;
  }

  .section-heading::-webkit-details-marker {
    display: none;
  }

  .register-panel[open] > summary,
  .registered-panel[open] > summary {
    margin-bottom: 0.95rem;
  }

  .section-heading h2 {
    margin: 0;
  }

  .section-heading p {
    margin: 0.08rem 0 0;
  }

  .register-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.72rem;
  }

  label {
    display: grid;
    gap: 0.28rem;
    min-width: 0;
  }

  input {
    width: 100%;
    min-width: 0;
    min-height: 2.35rem;
    border: 1px solid var(--color-divider);
    border-radius: 4px;
    background: color-mix(in srgb, var(--color-surface-alt) 56%, transparent);
    color: var(--color-text);
    padding: 0.5rem 0.62rem;
  }

  .button-line {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.6rem;
    margin-top: 0.85rem;
  }

  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 2.2rem;
    border: 0;
    border-left: 1px solid var(--color-divider);
    border-right: 1px solid var(--color-divider);
    border-radius: 0;
    background: transparent;
    color: var(--color-text);
    padding: 0.35rem 0.72rem;
    cursor: pointer;
    font-size: 0.78rem;
    font-weight: var(--weight-semibold);
  }

  .danger {
    color: color-mix(in srgb, var(--color-error) 76%, var(--color-text) 24%);
  }

  .unit-list {
    display: grid;
    gap: 0.65rem;
  }

  .unit-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.72rem;
    padding-top: 0.65rem;
    border-top: 1px solid var(--color-divider);
  }

  .unit-row:first-child {
    border-top: 0;
    padding-top: 0;
  }

  .unit-row > div {
    display: grid;
    gap: 0.14rem;
    min-width: 0;
    flex: 1;
  }

  .unit-row.muted {
    opacity: 0.62;
  }

  .status-text {
    color: var(--color-text-muted);
    font-size: 0.78rem;
  }

  @media (max-width: 900px) {
    .unit-workbench,
    .register-grid,
    .status-strip {
      grid-template-columns: minmax(0, 1fr);
    }

    .status-strip > div {
      border-left: 0;
      border-top: 1px solid var(--color-divider);
    }

    .status-strip > div:first-child {
      border-top: 0;
    }
  }
</style>
