<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import ManagerSectionNav from '$lib/components/ui/ManagerSectionNav.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { applyAction, enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { pushToast } from '$lib/client/toasts';
  import {
    GatewayProvisioning,
    isGatewayProvisioningAvailable,
    type GatewayWifiNetwork
  } from '$lib/client/gatewayProvisioning';
  import type { SubmitFunction } from '@sveltejs/kit';

  type NodeName = {
    sensor_id: number;
    name: string;
  };

  type GatewayDevice = {
    id: string;
    businessId: string;
    deviceType: 'sensor_gateway';
    externalDeviceId: string;
    displayName: string;
    keyPrefix: string;
    isActive: number;
    lastSeenAt: number | null;
    revokedAt: number | null;
    createdAt: number;
    updatedAt: number;
  };

  type SensorNode = {
    id: string;
    businessId: string;
    gatewayDeviceId: string;
    gatewaySerial: string | null;
    gatewayName: string | null;
    nodeSerial: string;
    sensorId: number;
    displayName: string;
    hardwareModel: string | null;
    firmwareVersion: string | null;
    isActive: number;
    lastSeenAt: number | null;
    batteryMv: number | null;
    humidityPct: number | null;
    rssi: number | null;
    packetSequence: number | null;
    wakeNonce: string | null;
    lqi: number | null;
    revokedAt: number | null;
    createdAt: number;
    updatedAt: number;
  };

  type SensorSetting = {
    sensor_id: number;
    high_threshold: number;
    low_threshold: number;
    stale_after_minutes: number;
    offline_after_minutes: number;
    alert_cooldown_minutes: number;
    is_alerting_enabled: number;
  };

  type ActiveAlert = {
    id: string;
    sensor_id: number;
    event_type: 'high' | 'low' | 'stale' | 'offline' | 'recovered';
    temperature: number | null;
    threshold: number | null;
    last_seen_at: number;
  };

  export let data: {
    nodeNames: NodeName[];
    gateways: GatewayDevice[];
    sensorNodes: SensorNode[];
    sensorSettings: SensorSetting[];
    activeAlerts: ActiveAlert[];
  };

  let feedbackMessage = '';
  let setupGatewayId = '';
  let setupStage: 'idle' | 'scanning' | 'ready' | 'connecting' | 'complete' = 'idle';
  let setupNetworks: GatewayWifiNetwork[] = [];
  let selectedSsid = '';
  let customSsid = '';
  let wifiPassword = '';
  let setupError = '';

  $: gatewayDevices = data.gateways;
  $: activeSensorNodes = data.sensorNodes.filter((node) => node.isActive === 1);
  $: activeSensorCount = activeSensorNodes.length;
  $: activeGatewayCount = gatewayDevices.filter((device) => device.isActive === 1).length;
  $: latestSensorSeen = Math.max(0, ...data.sensorNodes.map((node) => node.lastSeenAt ?? 0));
  $: settingsBySensor = new Map(data.sensorSettings.map((setting) => [setting.sensor_id, setting]));
  $: sensorIds = Array.from(
    new Set([
      ...data.nodeNames.map((node) => node.sensor_id),
      ...activeSensorNodes.map((node) => node.sensorId)
    ])
  ).sort((a, b) => a - b);
  $: activeAlertCount = data.activeAlerts.length;

  function formatShortTime(value: number | null) {
    if (!value) return 'None';
    const date = new Date(value * 1000);
    const today = new Date();
    const sameDay = date.toDateString() === today.toDateString();
    return sameDay
      ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  function formatDateTime(value: number | null) {
    if (!value) return 'No readings';
    return new Date(value * 1000).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function sensorName(sensorId: number) {
    return activeSensorNodes.find((node) => node.sensorId === sensorId)?.displayName
      ?? data.nodeNames.find((node) => node.sensor_id === sensorId)?.name
      ?? `Sensor ${sensorId}`;
  }

  function settingFor(sensorId: number): SensorSetting {
    return (
      settingsBySensor.get(sensorId) ?? {
        sensor_id: sensorId,
        high_threshold: 42,
        low_threshold: 32,
        stale_after_minutes: 15,
        offline_after_minutes: 45,
        alert_cooldown_minutes: 60,
        is_alerting_enabled: 1
      }
    );
  }

  function alertLabel(value: ActiveAlert['event_type']) {
    if (value === 'high') return 'High';
    if (value === 'low') return 'Low';
    if (value === 'stale') return 'Stale';
    if (value === 'offline') return 'Offline';
    return 'Recovered';
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

  const beginGatewaySetup: SubmitFunction = ({ cancel, formData }) => {
    if (!isGatewayProvisioningAvailable()) {
      cancel();
      pushToast('Open Crimini on your phone to connect gateway Wi-Fi.', 'error');
      return;
    }

    setupGatewayId = String(formData.get('gateway_id') ?? '');
    setupStage = 'scanning';
    setupNetworks = [];
    selectedSsid = '';
    customSsid = '';
    wifiPassword = '';
    setupError = '';

    return async ({ result }) => {
      const payload = result.type === 'success' || result.type === 'failure'
        ? result.data as {
            error?: string;
            provisioning?: { serviceName: string; proofOfPossession: string };
          }
        : undefined;

      if (result.type !== 'success' || !payload?.provisioning) {
        setupStage = 'idle';
        setupError = payload?.error ?? 'Gateway setup could not start.';
        pushToast(setupError, 'error');
        return;
      }

      try {
        const response = await GatewayProvisioning.scanNetworks(payload.provisioning);
        setupNetworks = response.networks;
        selectedSsid = response.networks[0]?.ssid ?? '__other';
        setupStage = 'ready';
      } catch (error) {
        setupStage = 'idle';
        setupError = error instanceof Error ? error.message : 'Gateway was not found nearby.';
        pushToast(setupError, 'error');
      }
    };
  };

  async function connectGatewayWifi() {
    const ssid = (selectedSsid === '__other' ? customSsid : selectedSsid).trim();
    if (!ssid) {
      setupError = 'Choose or enter a Wi-Fi network.';
      return;
    }

    setupStage = 'connecting';
    setupError = '';
    try {
      await GatewayProvisioning.provisionNetwork({ ssid, password: wifiPassword });
      wifiPassword = '';
      setupStage = 'complete';
      pushToast('Gateway connected to Wi-Fi.', 'success');
    } catch (error) {
      wifiPassword = '';
      setupStage = 'ready';
      setupError = error instanceof Error ? error.message : 'Gateway could not connect to Wi-Fi.';
      pushToast(setupError, 'error');
    }
  }

  async function closeGatewaySetup() {
    try {
      await GatewayProvisioning.disconnect();
    } catch {
      // The gateway may already have disconnected after successful setup.
    }
    setupGatewayId = '';
    setupStage = 'idle';
    setupNetworks = [];
    selectedSsid = '';
    customSsid = '';
    wifiPassword = '';
    setupError = '';
  }
</script>

<Layout>
  <PageHeader title="Temperature Monitoring Sensors" />
  <ManagerSectionNav groupId="business" />

  <div class="sensor-page">
    {#if feedbackMessage}
      <p class="feedback-banner">{feedbackMessage}</p>
    {/if}

    <section class="status-section">
      <div class="status-strip">
        <div><span>Gateways</span><strong>{activeGatewayCount}/{gatewayDevices.length}</strong></div>
        <div><span>Sensors</span><strong>{activeSensorCount}/{data.sensorNodes.length}</strong></div>
        <div><span>Last Check-In</span><strong>{formatShortTime(latestSensorSeen)}</strong></div>
        <div><span>Active Alerts</span><strong>{activeAlertCount}</strong></div>
        <div><span>Alert Rules</span><strong>{sensorIds.length}</strong></div>
      </div>
    </section>

    <section class="alerts-section">
      <header class="section-title">
        <h2>Active Alerts</h2>
        <span>{activeAlertCount}</span>
      </header>
      {#if data.activeAlerts.length === 0}
        <p class="empty-line">No active alerts.</p>
      {:else}
        <div class="alert-list">
          {#each data.activeAlerts as alert}
            <div class="alert-row" data-alert-type={alert.event_type}>
              <div>
                <strong>{sensorName(alert.sensor_id)}</strong>
                <small>
                  {alertLabel(alert.event_type)}
                  {#if alert.temperature !== null} | {alert.temperature.toFixed(1)}F{/if}
                  | {formatDateTime(alert.last_seen_at)}
                </small>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </section>

    <section class="equipment-section">
      <header class="section-title"><h2>Registered Equipment</h2></header>

      <div class="equipment-group">
        <header><h3>Gateways</h3><span>{activeGatewayCount} active</span></header>
        {#if gatewayDevices.length === 0}
          <p class="empty-line">No gateways registered.</p>
        {:else}
          <div class="unit-list">
            {#each gatewayDevices as device}
              <details class="unit-row" class:muted={device.isActive !== 1}>
                <summary>
                  <span class="unit-name"><span class="material-icons" aria-hidden="true">router</span><strong>{device.displayName}</strong></span>
                  <span>{device.externalDeviceId}</span>
                  <span>{formatShortTime(device.lastSeenAt)}</span>
                  <small>{device.isActive === 1 ? 'Active' : 'Revoked'}</small>
                  <span class="material-icons expand-icon" aria-hidden="true">expand_more</span>
                </summary>
                <div class="unit-details">
                  <div><span>Serial</span><strong>{device.externalDeviceId}</strong></div>
                  <div><span>Last Seen</span><strong>{formatDateTime(device.lastSeenAt)}</strong></div>
                  <div><span>Registered</span><strong>{formatDateTime(device.createdAt)}</strong></div>
                </div>
                {#if device.isActive === 1}
                  {#if setupGatewayId === device.id}
                    <div class="wifi-setup">
                      {#if setupStage === 'scanning'}
                        <p>Finding gateway...</p>
                      {:else if setupStage === 'ready' || setupStage === 'connecting'}
                        <div class="wifi-fields">
                          <label>
                            <span>Wi-Fi Network</span>
                            <select bind:value={selectedSsid} disabled={setupStage === 'connecting'}>
                              {#each setupNetworks as network}
                                <option value={network.ssid}>{network.ssid}</option>
                              {/each}
                              <option value="__other">Other network</option>
                            </select>
                          </label>
                          {#if selectedSsid === '__other'}
                            <label><span>Network Name</span><input bind:value={customSsid} maxlength="32" disabled={setupStage === 'connecting'} /></label>
                          {/if}
                          <label><span>Wi-Fi Password</span><input type="password" bind:value={wifiPassword} maxlength="63" autocomplete="new-password" disabled={setupStage === 'connecting'} /></label>
                        </div>
                        {#if setupError}<p class="setup-error">{setupError}</p>{/if}
                        <div class="setup-actions">
                          <button type="button" on:click={closeGatewaySetup} disabled={setupStage === 'connecting'}>Cancel</button>
                          <button type="button" on:click={connectGatewayWifi} disabled={setupStage === 'connecting'}>
                            {setupStage === 'connecting' ? 'Connecting...' : 'Connect'}
                          </button>
                        </div>
                      {:else if setupStage === 'complete'}
                        <div class="setup-complete">
                          <strong>Wi-Fi connected.</strong>
                          <button type="button" on:click={closeGatewaySetup}>Close</button>
                        </div>
                      {:else if setupError}
                        <div class="setup-complete">
                          <span class="setup-error">{setupError}</span>
                          <button type="button" on:click={closeGatewaySetup}>Close</button>
                        </div>
                      {/if}
                    </div>
                  {/if}
                  <div class="gateway-actions">
                    <form method="POST" action="?/gateway_setup" use:enhance={beginGatewaySetup}>
                      <input type="hidden" name="gateway_id" value={device.id} />
                      <button type="submit" disabled={setupStage === 'scanning' || setupStage === 'connecting'}>Connect Wi-Fi</button>
                    </form>
                    <form method="POST" action="?/revoke_iot_device" use:enhance={withFeedback}>
                      <input type="hidden" name="id" value={device.id} />
                      <button type="submit" class="danger">Revoke Gateway</button>
                    </form>
                  </div>
                {/if}
              </details>
            {/each}
          </div>
        {/if}
      </div>

      <div class="equipment-group">
        <header><h3>Sensor Nodes</h3><span>{activeSensorCount} active</span></header>
        {#if data.sensorNodes.length === 0}
          <p class="empty-line">No sensor nodes registered.</p>
        {:else}
          <div class="unit-list">
            {#each data.sensorNodes as node}
              <details class="unit-row" class:muted={node.isActive !== 1}>
                <summary>
                  <span class="unit-name"><span class="material-icons" aria-hidden="true">device_thermostat</span><strong>{node.displayName}</strong></span>
                  <span>{node.nodeSerial}</span>
                  <span>{node.gatewayName ?? 'Gateway'}</span>
                  <small>{node.isActive === 1 ? formatShortTime(node.lastSeenAt) : 'Revoked'}</small>
                  <span class="material-icons expand-icon" aria-hidden="true">expand_more</span>
                </summary>
                <div class="unit-details sensor-details">
                  <div><span>Last Seen</span><strong>{formatDateTime(node.lastSeenAt)}</strong></div>
                  <div><span>Battery</span><strong>{node.batteryMv !== null ? `${node.batteryMv}mV` : 'No data'}</strong></div>
                  <div><span>Humidity</span><strong>{node.humidityPct !== null ? `${node.humidityPct.toFixed(0)}%` : 'No data'}</strong></div>
                  <div><span>Signal</span><strong>{node.rssi !== null ? `${node.rssi}dBm` : 'No data'}</strong></div>
                  <div><span>LQI</span><strong>{node.lqi !== null ? node.lqi : 'No data'}</strong></div>
                  <div><span>Packet</span><strong>{node.packetSequence !== null ? node.packetSequence : 'No data'}</strong></div>
                  <div><span>Hardware</span><strong>{node.hardwareModel || 'Not reported'}</strong></div>
                  <div><span>Firmware</span><strong>{node.firmwareVersion || 'Not reported'}</strong></div>
                </div>
                {#if node.isActive === 1}
                  <form method="POST" action="?/revoke_sensor_node" use:enhance={withFeedback} class="danger-line">
                    <input type="hidden" name="id" value={node.id} />
                    <button type="submit" class="danger">Revoke Sensor</button>
                  </form>
                {/if}
              </details>
            {/each}
          </div>
        {/if}
      </div>
    </section>

    <section class="registration-section">
      <header class="section-title"><h2>Register Equipment</h2></header>
      <details class="register-panel">
        <summary><span>Temp Sensor Gateway</span><span class="material-icons" aria-hidden="true">expand_more</span></summary>
        <form method="POST" action="?/register_gateway" use:enhance={withFeedback}>
          <div class="field-grid">
            <label><span>Gateway Serial</span><input name="external_device_id" required /></label>
            <label><span>Name</span><input name="display_name" required /></label>
          </div>
          <div class="button-line"><button type="submit">Register Gateway</button></div>
        </form>
      </details>

      <details class="register-panel">
        <summary><span>Sensor Node</span><span class="material-icons" aria-hidden="true">expand_more</span></summary>
        <form method="POST" action="?/register_sensor" use:enhance={withFeedback}>
          <div class="field-grid three">
            <label>
              <span>Gateway</span>
              <select name="gateway_device_id" required>
                <option value="">Choose gateway</option>
                {#each gatewayDevices.filter((device) => device.isActive === 1) as gateway}
                  <option value={gateway.id}>{gateway.displayName}</option>
                {/each}
              </select>
            </label>
            <label><span>Sensor Serial</span><input name="external_device_id" required /></label>
            <label><span>Name</span><input name="display_name" required /></label>
          </div>
          <div class="button-line"><button type="submit">Register Sensor</button></div>
        </form>
      </details>
    </section>

    <section class="rules-section">
      <header class="section-title"><h2>Alert Rules</h2><span>{sensorIds.length}</span></header>
      {#if sensorIds.length === 0}
        <p class="empty-line">No sensors registered.</p>
      {:else}
        <div class="rules-list">
          {#each sensorIds as sensorId}
            {@const setting = settingFor(sensorId)}
            <details class="rule-row">
              <summary>
                <strong>{sensorName(sensorId)}</strong>
                <span>{setting.low_threshold}F - {setting.high_threshold}F</span>
                <small>{setting.is_alerting_enabled === 1 ? 'Alerts On' : 'Alerts Off'}</small>
                <span class="material-icons expand-icon" aria-hidden="true">expand_more</span>
              </summary>
              <form method="POST" action="?/save_sensor_settings" use:enhance={withFeedback}>
                <input type="hidden" name="sensor_id" value={sensorId} />
                <div class="rule-fields">
                  <label><span>High</span><input name="high_threshold" type="number" step="0.1" value={setting.high_threshold} /></label>
                  <label><span>Low</span><input name="low_threshold" type="number" step="0.1" value={setting.low_threshold} /></label>
                  <label><span>Stale Minutes</span><input name="stale_after_minutes" type="number" min="2" value={setting.stale_after_minutes} /></label>
                  <label><span>Offline Minutes</span><input name="offline_after_minutes" type="number" min="2" value={setting.offline_after_minutes} /></label>
                  <label><span>Cooldown</span><input name="alert_cooldown_minutes" type="number" min="5" value={setting.alert_cooldown_minutes} /></label>
                  <label class="inline-toggle"><input name="is_alerting_enabled" type="checkbox" value="1" checked={setting.is_alerting_enabled === 1} /><span>Alerts On</span></label>
                </div>
                <div class="button-line"><button type="submit">Save Rule</button></div>
              </form>
            </details>
          {/each}
        </div>
      {/if}
    </section>
  </div>
</Layout>

<style>
  :global(.main-content:has(.sensor-page)) {
    max-width: 1200px;
  }

  .sensor-page {
    display: grid;
    gap: 1rem;
    padding-bottom: 2rem;
  }

  .status-section,
  .alerts-section,
  .equipment-section,
  .registration-section,
  .rules-section {
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
    background: transparent;
  }

  .feedback-banner {
    margin: 0;
    padding: 0.7rem 1rem;
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
    color: var(--color-text);
    font-size: 0.78rem;
  }

  .status-strip {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }

  .status-strip > div {
    min-width: 0;
    padding: 0.72rem 0.85rem;
    display: grid;
    align-content: center;
    gap: 0.12rem;
    border-right: 1px solid var(--color-divider);
    transition: background 160ms var(--ease-out);
  }

  .status-strip > div:last-child {
    border-right: 0;
  }

  .status-strip > div:hover,
  .unit-row > summary:hover,
  .rule-row > summary:hover {
    background: color-mix(in srgb, var(--color-surface-alt) 34%, transparent);
  }

  .status-strip span,
  .unit-details span,
  label > span {
    color: var(--color-text-muted);
    font-size: 0.64rem;
    font-weight: var(--weight-semibold);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .status-strip strong {
    overflow: hidden;
    font-size: 1.08rem;
    font-weight: var(--weight-semibold);
    text-overflow: ellipsis;
  }

  .section-title,
  .equipment-group > header {
    min-height: 3.3rem;
    padding: 0.7rem 1rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    border-bottom: 1px solid var(--color-divider);
  }

  .section-title h2,
  .equipment-group h3 {
    margin: 0;
    font-size: 1rem;
  }

  .section-title > span,
  .equipment-group > header span,
  .unit-row summary > span:not(.unit-name):not(.material-icons),
  .unit-row summary small,
  .rule-row summary span,
  .rule-row summary small {
    color: var(--color-text-muted);
    font-size: 0.72rem;
  }

  .empty-line {
    margin: 0;
    padding: 0.85rem 1rem;
    color: var(--color-text-muted);
    font-size: 0.78rem;
  }

  .alert-row {
    min-height: 3.65rem;
    padding: 0.65rem 1rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    border-bottom: 1px solid var(--color-divider);
  }

  .alert-row:last-child {
    border-bottom: 0;
  }

  .alert-row > div {
    display: grid;
    gap: 0.12rem;
  }

  .alert-row small {
    color: var(--color-text-muted);
  }

  .alert-row[data-alert-type='high'],
  .alert-row[data-alert-type='offline'] {
    box-shadow: inset 2px 0 color-mix(in srgb, var(--color-error) 68%, transparent);
  }

  .alert-row[data-alert-type='low'],
  .alert-row[data-alert-type='stale'] {
    box-shadow: inset 2px 0 color-mix(in srgb, var(--color-warning) 68%, transparent);
  }

  .equipment-group + .equipment-group {
    border-top: 1px solid var(--color-divider);
  }

  .equipment-group > header {
    min-height: 2.9rem;
  }

  .equipment-group h3 {
    font-size: 0.84rem;
  }

  .unit-row,
  .rule-row,
  .register-panel {
    border-bottom: 1px solid var(--color-divider);
  }

  .unit-row:last-child,
  .rule-row:last-child,
  .register-panel:last-child {
    border-bottom: 0;
  }

  .unit-row > summary {
    min-height: 3.6rem;
    padding: 0.6rem 1rem;
    display: grid;
    grid-template-columns: minmax(170px, 1fr) minmax(130px, 0.8fr) minmax(110px, 0.65fr) auto auto;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    list-style: none;
    transition: background 160ms var(--ease-out);
  }

  summary::-webkit-details-marker {
    display: none;
  }

  .unit-name {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 0.55rem;
  }

  .unit-name .material-icons,
  .expand-icon {
    color: var(--color-text-muted);
    font-size: 1rem;
  }

  .unit-name strong,
  .unit-row summary > span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .unit-row.muted {
    opacity: 0.62;
  }

  .expand-icon {
    transition: transform 160ms var(--ease-out);
  }

  .unit-row[open] > summary .expand-icon,
  .rule-row[open] > summary .expand-icon,
  .register-panel[open] > summary .material-icons {
    transform: rotate(180deg);
  }

  .unit-details {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    border-top: 1px solid var(--color-divider);
  }

  .sensor-details {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .unit-details > div {
    min-width: 0;
    padding: 0.65rem 0.85rem;
    display: grid;
    gap: 0.14rem;
    border-right: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
  }

  .unit-details > div:nth-child(3n),
  .sensor-details > div:nth-child(4n) {
    border-right: 0;
  }

  .unit-details > div:nth-last-child(-n + 3),
  .sensor-details > div:nth-last-child(-n + 4) {
    border-bottom: 0;
  }

  .unit-details strong {
    overflow: hidden;
    font-size: 0.76rem;
    text-overflow: ellipsis;
  }

  .danger-line {
    padding: 0.55rem 1rem;
    display: flex;
    justify-content: flex-end;
    border-top: 1px solid var(--color-divider);
  }

  .gateway-actions,
  .setup-actions,
  .setup-complete {
    padding: 0.55rem 1rem;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.55rem;
    border-top: 1px solid var(--color-divider);
  }

  .wifi-setup {
    border-top: 1px solid var(--color-divider);
  }

  .wifi-setup > p,
  .setup-error {
    margin: 0;
    padding: 0.75rem 1rem;
    color: var(--color-text-muted);
    font-size: 0.76rem;
  }

  .setup-error {
    color: color-mix(in srgb, var(--color-error) 76%, var(--color-text));
  }

  .wifi-fields {
    padding: 0.8rem 1rem;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.72rem;
  }

  .setup-complete {
    justify-content: space-between;
  }

  .setup-complete strong {
    font-size: 0.78rem;
  }

  .register-panel > summary,
  .rule-row > summary {
    padding: 0.7rem 1rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: var(--weight-semibold);
    list-style: none;
  }

  .register-panel > summary .material-icons,
  .rule-row > summary .material-icons {
    color: var(--color-text-muted);
    font-size: 1rem;
    transition: transform 160ms var(--ease-out);
  }

  .register-panel > form,
  .rule-row > form {
    padding: 0.9rem 1rem;
    border-top: 1px solid var(--color-divider);
  }

  .field-grid,
  .rule-fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.72rem;
  }

  .field-grid.three {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .rule-fields {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }

  label {
    min-width: 0;
    display: grid;
    gap: 0.28rem;
  }

  input,
  select {
    width: 100%;
    min-width: 0;
    border: 0;
    border-bottom: 1px solid var(--color-divider);
    border-radius: 0;
    background: transparent;
    color: var(--color-text);
    padding: 0.5rem 0;
    font: inherit;
    font-size: 0.8rem;
  }

  .inline-toggle {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .inline-toggle input {
    width: auto;
  }

  .button-line {
    margin-top: 0.75rem;
    display: flex;
    justify-content: flex-end;
  }

  button {
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
  }

  .danger {
    color: color-mix(in srgb, var(--color-error) 76%, var(--color-text));
    border-color: color-mix(in srgb, var(--color-error) 38%, var(--color-border));
  }

  .rule-row > summary {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(120px, 0.45fr) auto auto;
    transition: background 160ms var(--ease-out);
  }

  @media (max-width: 900px) {
    .status-strip {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .status-strip > div:nth-child(even) {
      border-right: 0;
    }

    .status-strip > div {
      border-bottom: 1px solid var(--color-divider);
    }

    .status-strip > div:last-child {
      border-bottom: 0;
    }

    .field-grid.three,
    .rule-fields,
    .sensor-details {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .sensor-details > div,
    .sensor-details > div:nth-child(4n) {
      border-right: 1px solid var(--color-divider);
      border-bottom: 1px solid var(--color-divider);
    }

    .sensor-details > div:nth-child(even) {
      border-right: 0;
    }

    .sensor-details > div:nth-last-child(-n + 2) {
      border-bottom: 0;
    }
  }

  @media (max-width: 680px) {
    .status-strip,
    .field-grid,
    .field-grid.three,
    .rule-fields,
    .unit-details,
    .sensor-details,
    .unit-row > summary,
    .rule-row > summary {
      grid-template-columns: 1fr;
    }

    .status-strip > div,
    .status-strip > div:nth-child(even),
    .unit-details > div,
    .unit-details > div:nth-child(3n),
    .unit-details > div:nth-last-child(-n + 3),
    .sensor-details > div,
    .sensor-details > div:nth-child(even),
    .sensor-details > div:nth-last-child(-n + 2) {
      border-right: 0;
      border-bottom: 1px solid var(--color-divider);
    }

    .status-strip > div:last-child,
    .unit-details > div:last-child,
    .sensor-details > div:last-child {
      border-bottom: 0;
    }

    .unit-row > summary,
    .rule-row > summary {
      grid-template-columns: minmax(0, 1fr) auto;
    }

    .unit-row > summary > span:nth-child(2),
    .unit-row > summary > span:nth-child(3),
    .rule-row > summary > span:nth-child(2) {
      display: none;
    }

    .alert-row {
      align-items: flex-start;
      flex-direction: column;
    }

    .wifi-fields {
      grid-template-columns: 1fr;
    }
  }
</style>
