<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { applyAction, enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { pushToast } from '$lib/client/toasts';
  import type { SubmitFunction } from '@sveltejs/kit';

  type NodeName = {
    sensor_id: number;
    name: string;
  };

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

  export let data: {
    nodeNames: NodeName[];
    iotDevices: IoTDevice[];
  };

  let feedbackMessage = '';

  $: sensorDevices = data.iotDevices.filter((device) => device.deviceType === 'sensor');
  $: gatewayDevices = data.iotDevices.filter((device) => device.deviceType === 'sensor_gateway');
  $: activeSensorCount = sensorDevices.filter((device) => device.isActive === 1).length;
  $: activeGatewayCount = gatewayDevices.filter((device) => device.isActive === 1).length;
  $: latestSensorSeen = Math.max(0, ...sensorDevices.map((device) => device.lastSeenAt ?? 0));

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
        pushToast('Temperature sensors updated.', 'success');
      } else if (result.type === 'failure') {
        pushToast(result.data?.error ?? 'That action could not be completed.', 'error');
      }
      feedbackMessage =
        result.type === 'success'
          ? 'Temperature sensors updated.'
          : result.type === 'failure'
            ? result.data?.error ?? 'That action could not be completed.'
            : '';
    };
  };
</script>

<Layout>
  <PageHeader title="Temperature Monitoring Sensors" />

  {#if feedbackMessage}
    <p class="feedback-banner">{feedbackMessage}</p>
  {/if}

  <section class="status-strip" aria-label="Temperature sensor status">
    <div>
      <span>Gateways</span>
      <strong>{activeGatewayCount}/{gatewayDevices.length}</strong>
    </div>
    <div>
      <span>Sensors</span>
      <strong>{activeSensorCount}/{sensorDevices.length}</strong>
    </div>
    <div>
      <span>Labels</span>
      <strong>{data.nodeNames.length}</strong>
    </div>
    <div>
      <span>Latest Check-In</span>
      <strong>{formatShortTime(latestSensorSeen)}</strong>
    </div>
  </section>

  <section class="sensor-workbench">
    <details class="register-panel">
      <summary class="section-heading">
        <span class="material-icons" aria-hidden="true">router</span>
        <div>
          <h2>Temp Sensor Gateway</h2>
          <p>Serial number and name.</p>
        </div>
      </summary>

      <form method="POST" action="?/register_gateway" use:enhance={withFeedback}>
        <div class="field-grid">
          <label>
            <span>Gateway Serial</span>
            <input name="external_device_id" placeholder="CRIMINI-GATEWAY-001" required />
          </label>
          <label>
            <span>Name</span>
            <input name="display_name" placeholder="Kitchen gateway" required />
          </label>
        </div>

        <div class="button-line">
          <button type="submit">Register</button>
        </div>
      </form>
    </details>

    <details class="register-panel">
      <summary class="section-heading">
        <span class="material-icons" aria-hidden="true">add_circle</span>
        <div>
          <h2>Register Sensor</h2>
          <p>Serial number and name.</p>
        </div>
      </summary>

      <form method="POST" action="?/register_sensor" use:enhance={withFeedback}>
        <div class="field-grid">
          <label>
            <span>Sensor Serial</span>
            <input name="external_device_id" placeholder="CRIMINI-SENSOR-001" required />
          </label>
          <label>
            <span>Name</span>
            <input name="display_name" placeholder="Walk-in cooler" required />
          </label>
        </div>

        <div class="button-line">
          <button type="submit">Register</button>
        </div>
      </form>
    </details>

    <details class="registered-panel">
      <summary class="section-heading">
        <span class="material-icons" aria-hidden="true">router</span>
        <div>
          <h2>Registered Gateways</h2>
          <p>{activeGatewayCount} active</p>
        </div>
      </summary>

      <div class="unit-list">
        {#if gatewayDevices.length === 0}
          <p class="empty-line">No gateways registered yet.</p>
        {:else}
          {#each gatewayDevices as device}
            <article class="unit-row" class:muted={device.isActive !== 1}>
              <span class="material-icons" aria-hidden="true">router</span>
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

    <details class="registered-panel">
      <summary class="section-heading">
        <span class="material-icons" aria-hidden="true">device_thermostat</span>
        <div>
          <h2>Registered Sensors</h2>
          <p>{activeSensorCount} active</p>
        </div>
      </summary>

      <div class="unit-list">
        {#if sensorDevices.length === 0}
          <p class="empty-line">No sensors registered yet.</p>
        {:else}
          {#each sensorDevices as device}
            <article class="unit-row" class:muted={device.isActive !== 1}>
              <span class="material-icons" aria-hidden="true">device_thermostat</span>
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

    <details class="labels-panel">
      <summary class="section-heading">
        <span class="material-icons" aria-hidden="true">label</span>
        <div>
          <h2>Sensor Labels</h2>
          <p>{data.nodeNames.length} saved</p>
        </div>
      </summary>

      <form method="POST" action="?/add_node_name" use:enhance={withFeedback} class="node-form">
        <label>
          <span>Node</span>
          <input name="sensor_id" type="number" min="1" placeholder="1" required />
        </label>
        <label>
          <span>Name</span>
          <input name="name" placeholder="Walk-in cooler" required />
        </label>
        <button type="submit">Save</button>
      </form>

      <div class="node-list">
        {#if data.nodeNames.length === 0}
          <p class="empty-line">No sensor labels yet.</p>
        {:else}
          {#each data.nodeNames as node}
            <div class="node-row">
              <span>#{node.sensor_id}</span>
              <strong>{node.name}</strong>
              <form method="POST" action="?/delete_node_name" use:enhance={withFeedback}>
                <input type="hidden" name="sensor_id" value={node.sensor_id} />
                <button type="submit" class="danger">Delete</button>
              </form>
            </div>
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
    grid-template-columns: repeat(4, minmax(0, 1fr));
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
  .node-row span,
  .empty-line,
  label span {
    color: var(--color-text-muted);
  }

  .status-strip strong {
    font-size: clamp(1.1rem, 1.7vw, 1.42rem);
  }

  .sensor-workbench {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
    margin-top: 1rem;
  }

  .register-panel,
  .registered-panel,
  .labels-panel {
    min-width: 0;
    padding: 1rem;
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
    background: linear-gradient(180deg, color-mix(in srgb, var(--color-surface) 96%, transparent), transparent);
  }

  .labels-panel {
    grid-column: 1 / -1;
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
  .registered-panel[open] > summary,
  .labels-panel[open] > summary {
    margin-bottom: 0.95rem;
  }

  .section-heading h2 {
    margin: 0;
  }

  .section-heading p {
    margin: 0.08rem 0 0;
  }

  .field-grid,
  .node-form {
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

  .unit-list,
  .node-list {
    display: grid;
    gap: 0.65rem;
  }

  .unit-row,
  .node-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.72rem;
    padding-top: 0.65rem;
    border-top: 1px solid var(--color-divider);
  }

  .unit-row:first-child,
  .node-row:first-child {
    border-top: 0;
    padding-top: 0;
  }

  .unit-row > div,
  .node-row strong {
    min-width: 0;
    flex: 1;
  }

  .unit-row > div {
    display: grid;
    gap: 0.14rem;
  }

  .unit-row.muted {
    opacity: 0.62;
  }

  .status-text {
    color: var(--color-text-muted);
    font-size: 0.78rem;
  }

  .node-form button {
    grid-column: 1 / -1;
    justify-self: start;
  }

  @media (max-width: 900px) {
    .sensor-workbench,
    .field-grid,
    .node-form,
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
