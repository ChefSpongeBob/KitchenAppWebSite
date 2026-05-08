<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { applyAction, enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { pushToast } from '$lib/client/toasts';
  import type { SubmitFunction } from '@sveltejs/kit';

  type CameraEvent = {
    id: string;
    camera_id: string | null;
    camera_name: string | null;
    event_type: string;
    payload_json: string | null;
    image_url: string | null;
    clip_url: string | null;
    clip_duration_seconds: number | null;
    created_at: number;
  };

  type CameraSource = {
    id: string;
    camera_id: string | null;
    name: string;
    live_url: string | null;
    preview_image_url: string | null;
    is_active: number;
    updated_at: number;
  };

  type NodeName = {
    sensor_id: number;
    name: string;
  };

  type IoTDevice = {
    id: string;
    businessId: string;
    deviceType: 'sensor' | 'camera';
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
    events: CameraEvent[];
    sources: CameraSource[];
    nodeNames: NodeName[];
    iotDevices: IoTDevice[];
  };

  let feedPlaying: Record<string, boolean> = {};
  let feedbackMessage = '';
  let generatedDeviceKey = '';

  const fixedCameras = [
    { slot: 'walkin', title: 'Walkin' },
    { slot: 'freezer', title: 'Freezer' }
  ];

  function findSource(slot: string) {
    return (
      data.sources.find((source) => (source.camera_id ?? '').toLowerCase() === slot) ??
      data.sources.find((source) => source.name.toLowerCase() === slot)
    );
  }

  $: cameraCards = fixedCameras.map((camera) => {
    const source = findSource(camera.slot);
    const events = data.events.filter((event) => {
      const eventKey = (event.camera_id ?? event.camera_name ?? '').toLowerCase();
      return eventKey === camera.slot || eventKey === camera.title.toLowerCase();
    });
    const latestEvent = events[0];

    return {
      slot: camera.slot,
      title: source?.name ?? camera.title,
      id: source?.id ?? `static-${camera.slot}`,
      camera_id: source?.camera_id ?? camera.slot,
      live_url: source?.live_url ?? null,
      latest_clip_url: latestEvent?.clip_url ?? null,
      preview_image_url: latestEvent?.image_url ?? source?.preview_image_url ?? null,
      download_url: latestEvent?.clip_url ?? latestEvent?.image_url ?? source?.preview_image_url ?? null,
      is_active: source?.is_active ?? 0,
      latestLabel: latestEvent?.clip_url ? 'Latest clip' : latestEvent?.image_url ? 'Latest still' : 'No media yet',
      latestAt: latestEvent?.created_at ?? null,
      saved: Boolean(source),
      events
    };
  });

  $: activeCameraCount = cameraCards.filter((camera) => camera.is_active === 1).length;
  $: mediaEventCount = data.events.filter((event) => event.clip_url || event.image_url).length;
  $: latestCameraEvent = data.events[0]?.created_at ?? null;

  function formatTimestamp(value: number | null) {
    if (!value) return 'None';
    return new Date(value * 1000).toLocaleString();
  }

  function formatShortTime(value: number | null) {
    if (!value) return 'None';
    return new Date(value * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function startFeed(id: string) {
    feedPlaying = { ...feedPlaying, [id]: true };
  }

  function stopFeed(id: string) {
    feedPlaying = { ...feedPlaying, [id]: false };
  }

  function isPlaying(id: string, active: number) {
    return feedPlaying[id] ?? active === 1;
  }

  const withFeedback: SubmitFunction = () => {
    feedbackMessage = '';
    return async ({ result }) => {
      await applyAction(result);
      if (result.type === 'success') {
        generatedDeviceKey = String(result.data?.deviceKey ?? '');
        await invalidateAll();
        pushToast('Camera & sensor settings updated.', 'success');
      } else if (result.type === 'failure') {
        generatedDeviceKey = '';
        pushToast(result.data?.error ?? 'That camera or sensor action could not be completed.', 'error');
      }
      feedbackMessage =
        result.type === 'success'
          ? 'Camera & sensor settings updated.'
          : result.type === 'failure'
            ? result.data?.error ?? 'That camera or sensor action could not be completed.'
            : '';
    };
  };
</script>

<Layout>
  <PageHeader title="Camera & Sensors" />

  {#if feedbackMessage}
    <p class="feedback-banner">{feedbackMessage}</p>
  {/if}

  <section class="signal-strip" aria-label="Camera and sensor status">
    <div>
      <span>Active Cameras</span>
      <strong>{activeCameraCount}/{cameraCards.length}</strong>
    </div>
    <div>
      <span>Sensor Nodes</span>
      <strong>{data.nodeNames.length}</strong>
    </div>
    <div>
      <span>Saved Media</span>
      <strong>{mediaEventCount}</strong>
    </div>
    <div>
      <span>Latest Event</span>
      <strong>{formatShortTime(latestCameraEvent)}</strong>
    </div>
  </section>

  <div class="monitor-workspace">
    <aside class="setup-rail" aria-label="Camera and sensor setup">
      <details class="setup-panel" open>
        <summary>
          <span>Cameras</span>
          <small>{data.sources.length} saved</small>
        </summary>

        <div class="camera-settings">
          {#each cameraCards as camera}
            <form method="POST" action="?/save_source" use:enhance={withFeedback} class="settings-block">
              <input type="hidden" name="id" value={camera.id} />
              <input type="hidden" name="camera_id" value={camera.camera_id} />

              <div class="settings-title">
                <strong>{camera.slot}</strong>
                <span class:offline={camera.is_active !== 1}>{camera.is_active === 1 ? 'Live' : 'Idle'}</span>
              </div>

              <label>
                <span>Name</span>
                <input name="name" value={camera.title} placeholder="Camera name" required />
              </label>
              <label>
                <span>Live URL</span>
                <input name="live_url" value={camera.live_url ?? ''} placeholder="https://..." />
              </label>
              <label>
                <span>Preview URL</span>
                <input name="preview_image_url" value={camera.preview_image_url ?? ''} placeholder="https://..." />
              </label>
              <label>
                <span>Status</span>
                <select name="is_active" value={String(camera.is_active)}>
                  <option value="1">Live</option>
                  <option value="0">Idle</option>
                </select>
              </label>

              <div class="form-actions">
                <button type="submit">Save</button>
                {#if camera.saved}
                  <button type="submit" formaction="?/delete_source" class="danger ghost">Remove</button>
                {/if}
              </div>
            </form>
          {/each}
        </div>
      </details>

      <details class="setup-panel" open>
        <summary>
          <span>Sensors</span>
          <small>{data.nodeNames.length} saved</small>
        </summary>

        <form method="POST" action="?/add_node_name" use:enhance={withFeedback} class="node-form">
          <label>
            <span>Node ID</span>
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
            <p>No node names yet.</p>
          {:else}
            {#each data.nodeNames as node}
              <div class="node-row">
                <span>#{node.sensor_id}</span>
                <strong>{node.name}</strong>
                <form method="POST" action="?/delete_node_name" use:enhance={withFeedback}>
                  <input type="hidden" name="sensor_id" value={node.sensor_id} />
                  <button type="submit" class="danger compact">Delete</button>
                </form>
              </div>
            {/each}
          {/if}
        </div>
      </details>

      <details class="setup-panel">
        <summary>
          <span>Device Keys</span>
          <small>{data.iotDevices.filter((device) => device.isActive === 1).length} active</small>
        </summary>

        {#if generatedDeviceKey}
          <div class="key-output">
            <span>New key</span>
            <code>{generatedDeviceKey}</code>
          </div>
        {/if}

        <form method="POST" action="?/provision_iot_device" use:enhance={withFeedback} class="device-form">
          <label>
            <span>Type</span>
            <select name="device_type">
              <option value="sensor">Sensor</option>
              <option value="camera">Camera</option>
            </select>
          </label>
          <label>
            <span>Device ID</span>
            <input name="external_device_id" placeholder="walkin-01" required />
          </label>
          <label>
            <span>Name</span>
            <input name="display_name" placeholder="Walk-in cooler" required />
          </label>
          <button type="submit">Generate Key</button>
        </form>

        <div class="device-list">
          {#if data.iotDevices.length === 0}
            <p>No device keys yet.</p>
          {:else}
            {#each data.iotDevices as device}
              <div class="device-row" class:revoked={device.isActive !== 1}>
                <div>
                  <strong>{device.displayName}</strong>
                  <span>{device.deviceType} · {device.externalDeviceId}</span>
                  <small>{device.keyPrefix}… · Last seen {formatShortTime(device.lastSeenAt)}</small>
                </div>
                {#if device.isActive === 1}
                  <form method="POST" action="?/revoke_iot_device" use:enhance={withFeedback}>
                    <input type="hidden" name="id" value={device.id} />
                    <button type="submit" class="danger compact">Revoke</button>
                  </form>
                {:else}
                  <span class="revoked-pill">Revoked</span>
                {/if}
              </div>
            {/each}
          {/if}
        </div>
      </details>

      <form method="POST" action="?/clear_events" use:enhance={withFeedback} class="clear-form">
        <button type="submit" class="danger ghost">Clear Clips</button>
      </form>
    </aside>

    <section class="feed-grid">
    {#each cameraCards as camera}
      <article class="feed-card">
        <header class="feed-head">
          <div>
            <h2>{camera.title}</h2>
            <small>{camera.latestLabel} · {formatTimestamp(camera.latestAt)}</small>
          </div>
          <span class:inactive={camera.is_active !== 1}>
            {camera.is_active === 1 ? 'Live' : 'Idle'}
          </span>
        </header>

        <div class="feed-stage">
          {#if isPlaying(camera.id, camera.is_active) && camera.live_url}
            <iframe title={camera.title} src={camera.live_url} loading="lazy" scrolling="no"></iframe>
          {:else if camera.latest_clip_url}
            <video
              src={camera.latest_clip_url}
              controls
              preload="metadata"
              playsinline
            >
              <track kind="captions" />
            </video>
          {:else if camera.preview_image_url}
            <img src={camera.preview_image_url} alt={`${camera.title} preview`} />
          {:else}
            <div class="feed-placeholder">{camera.latestLabel}</div>
          {/if}
        </div>

        <div class="feed-controls">
          <button type="button" on:click={() => startFeed(camera.id)}>Start</button>
          <button type="button" class="muted-btn" on:click={() => stopFeed(camera.id)}>Stop</button>
          {#if camera.download_url}
            <a class="control-link" href={camera.download_url} target="_blank" rel="noreferrer" download>
              Download
            </a>
          {:else}
            <span class="control-link disabled">Download</span>
          {/if}
        </div>

        <section class="camera-activity">
          <header class="activity-head">
            <h3>Activity</h3>
            <span>{camera.events.length} saved</span>
          </header>

          <div class="clip-list">
            {#if camera.events.length === 0}
              <article class="clip-card empty">No clips yet.</article>
            {:else}
              {#each camera.events as event}
                <article class="clip-card">
                  <div class="clip-main">
                    <strong>{event.event_type}</strong>
                    <span>{formatTimestamp(event.created_at)}</span>
                    {#if event.clip_duration_seconds}
                      <small>{event.clip_duration_seconds}s clip</small>
                    {/if}
                  </div>
                  {#if event.clip_url}
                    <div class="clip-preview">
                      <video
                        src={event.clip_url}
                        controls
                        preload="metadata"
                        playsinline
                      >
                        <track kind="captions" />
                      </video>
                    </div>
                  {:else if event.image_url}
                    <div class="clip-preview still-preview">
                      <img src={event.image_url} alt={`${event.event_type} still`} loading="lazy" />
                    </div>
                  {/if}
                  <div class="clip-actions">
                    {#if event.image_url}
                      <a href={event.image_url} target="_blank" rel="noreferrer">Still</a>
                    {/if}
                    {#if event.clip_url}
                      <a href={event.clip_url} target="_blank" rel="noreferrer">Open</a>
                      <a href={event.clip_url} download>Download</a>
                    {/if}
                    <form method="POST" action="?/delete_event" use:enhance={withFeedback}>
                      <input type="hidden" name="id" value={event.id} />
                      <button type="submit" class="danger">Delete</button>
                    </form>
                  </div>
                </article>
              {/each}
            {/if}
          </div>
        </section>
      </article>
    {/each}
    </section>
  </div>
</Layout>

<style>
  .feedback-banner {
    margin: 0 0 0.9rem;
    padding: 0.72rem 0.9rem;
    border: 1px solid color-mix(in srgb, var(--color-success) 32%, var(--color-border) 68%);
    border-radius: 14px;
    background: color-mix(in srgb, var(--color-success) 10%, var(--color-surface) 90%);
    color: var(--color-text);
  }

  .signal-strip {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 1px;
    overflow: hidden;
    border: var(--surface-outline);
    border-radius: var(--radius-lg);
    background: var(--color-border);
    box-shadow: var(--shadow-xs);
  }

  .signal-strip > div {
    display: grid;
    gap: 0.2rem;
    min-width: 0;
    padding: 0.86rem 0.95rem;
    background: color-mix(in srgb, var(--color-surface) 94%, transparent);
  }

  .signal-strip span,
  .settings-title span,
  .node-row span,
  .node-list p,
  .feed-head small,
  .clip-main span,
  .clip-main small,
  .clip-card.empty {
    color: var(--color-text-muted);
  }

  .signal-strip strong {
    font-size: clamp(1.1rem, 1.7vw, 1.45rem);
    line-height: 1.05;
  }

  .monitor-workspace {
    display: grid;
    grid-template-columns: minmax(280px, 0.34fr) minmax(0, 1fr);
    gap: 0.95rem;
    margin-top: 0.95rem;
    align-items: start;
  }

  .setup-rail {
    display: grid;
    gap: 0.75rem;
    position: sticky;
    top: 1rem;
  }

  .setup-panel,
  .feed-card {
    border: var(--surface-outline);
    border-radius: var(--radius-lg);
    background: var(--surface-wash), var(--color-surface);
    box-shadow: var(--shadow-xs);
  }

  .setup-panel {
    overflow: hidden;
  }

  .setup-panel summary {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    list-style: none;
    padding: 0.9rem 1rem;
  }

  .setup-panel summary::-webkit-details-marker {
    display: none;
  }

  .setup-panel summary span {
    font-weight: var(--weight-bold);
  }

  .setup-panel summary small {
    color: var(--color-text-muted);
  }

  .camera-settings,
  .node-list,
  .device-list {
    display: grid;
    gap: 0.7rem;
    padding: 0 1rem 1rem;
  }

  .settings-block {
    display: grid;
    gap: 0.55rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--color-divider);
  }

  .settings-block:first-child {
    border-top: 0;
    padding-top: 0;
  }

  .settings-title,
  .node-row,
  .device-row,
  .feed-head,
  .form-actions,
  .feed-controls,
  .clip-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.65rem;
  }

  .settings-title span,
  .feed-head > span {
    border: 1px solid color-mix(in srgb, var(--color-success) 42%, var(--color-border) 58%);
    border-radius: 999px;
    color: color-mix(in srgb, var(--color-success) 72%, var(--color-text) 28%);
    padding: 0.15rem 0.5rem;
    font-size: 0.72rem;
    font-weight: var(--weight-semibold);
  }

  .settings-title span.offline,
  .feed-head > span.inactive {
    border-color: color-mix(in srgb, var(--color-warning) 42%, var(--color-border) 58%);
    color: color-mix(in srgb, var(--color-warning) 74%, var(--color-text) 26%);
  }

  label {
    display: grid;
    gap: 0.25rem;
    min-width: 0;
  }

  label span {
    color: var(--color-text-muted);
    font-size: 0.76rem;
  }

  input,
  select {
    width: 100%;
    min-width: 0;
    min-height: 2.35rem;
    border: var(--surface-outline);
    border-radius: 10px;
    background: color-mix(in srgb, var(--color-surface-alt) 62%, transparent);
    color: var(--color-text);
    padding: 0.5rem 0.62rem;
  }

  .form-actions,
  .feed-controls {
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .node-form,
  .device-form {
    display: grid;
    grid-template-columns: minmax(70px, 0.42fr) minmax(0, 1fr);
    gap: 0.55rem;
    padding: 0 1rem 0.8rem;
  }

  .device-form {
    grid-template-columns: minmax(0, 0.5fr) minmax(0, 1fr);
  }

  .device-form label:nth-child(3),
  .node-form button,
  .device-form button {
    grid-column: 1 / -1;
  }

  .node-row,
  .device-row {
    border-top: 1px solid var(--color-divider);
    padding-top: 0.62rem;
  }

  .node-row:first-child,
  .device-row:first-child {
    border-top: 0;
    padding-top: 0;
  }

  .node-row strong {
    min-width: 0;
    flex: 1;
    font-size: 0.92rem;
  }

  .clear-form button {
    width: 100%;
  }

  .key-output {
    display: grid;
    gap: 0.35rem;
    margin: 0 1rem 0.8rem;
    padding: 0.72rem;
    border: 1px solid color-mix(in srgb, var(--color-success) 34%, var(--color-border) 66%);
    border-radius: 12px;
    background: color-mix(in srgb, var(--color-success) 9%, var(--color-surface) 91%);
  }

  .key-output span,
  .device-row span,
  .device-row small,
  .device-list p {
    color: var(--color-text-muted);
    font-size: 0.76rem;
  }

  .key-output code {
    overflow-wrap: anywhere;
    color: var(--color-text);
    font-size: 0.78rem;
  }

  .device-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.7rem;
  }

  .device-row > div {
    display: grid;
    gap: 0.16rem;
    min-width: 0;
  }

  .device-row.revoked {
    opacity: 0.68;
  }

  .revoked-pill {
    border: 1px solid color-mix(in srgb, var(--color-border) 76%, transparent);
    border-radius: 999px;
    padding: 0.22rem 0.52rem;
    color: var(--color-text-muted);
    font-size: 0.72rem;
  }

  .feed-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.95rem;
  }

  .feed-card {
    padding: 1rem;
    min-width: 0;
  }

  .feed-head {
    align-items: flex-start;
  }

  .feed-head h2 {
    margin: 0 0 0.18rem;
    font-size: clamp(1.16rem, 2vw, 1.45rem);
  }

  .feed-stage {
    margin-top: 0.9rem;
    aspect-ratio: 16 / 9;
    border: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
    border-radius: 14px;
    overflow: hidden;
    background: #050607;
  }

  .feed-stage iframe,
  .feed-stage img,
  .feed-stage video {
    width: 100%;
    height: 100%;
    border: 0;
    object-fit: cover;
    background: #050607;
  }

  .feed-placeholder {
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
    color: var(--color-text-muted);
    font-size: 0.88rem;
  }

  .camera-activity {
    margin-top: 0.95rem;
    padding-top: 0.85rem;
    border-top: 1px solid var(--color-divider);
  }

  .activity-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .activity-head h3 {
    margin: 0;
    font-size: 1rem;
  }

  .activity-head span {
    color: var(--color-text-muted);
    font-size: 0.8rem;
  }

  .clip-list {
    display: grid;
    gap: 0.62rem;
    margin-top: 0.72rem;
  }

  .clip-card {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(110px, 160px) auto;
    gap: 0.75rem;
    align-items: center;
    border-top: 1px solid var(--color-divider);
    padding-top: 0.62rem;
  }

  .clip-card:first-child {
    border-top: 0;
    padding-top: 0;
  }

  .clip-main {
    display: grid;
    gap: 0.16rem;
    min-width: 0;
  }

  .clip-main small {
    font-size: 0.75rem;
  }

  .clip-preview {
    width: 100%;
    aspect-ratio: 16 / 9;
    border-radius: 10px;
    overflow: hidden;
    background: #050607;
  }

  .clip-preview video,
  .clip-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    background: #000;
  }

  .still-preview img {
    object-fit: cover;
    background: rgba(0, 0, 0, 0.38);
  }

  .clip-actions {
    justify-content: flex-end;
    flex-wrap: wrap;
  }

  .clip-actions a,
  .control-link {
    color: var(--color-text-soft);
    text-decoration: none;
  }

  .control-link,
  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 2.35rem;
    border: 1px solid color-mix(in srgb, var(--color-primary) 26%, var(--color-border) 74%);
    border-radius: 10px;
    background: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface) 88%);
    color: var(--color-text);
    padding: 0.5rem 0.72rem;
    cursor: pointer;
    font-size: 0.78rem;
    font-weight: var(--weight-semibold);
  }

  .danger {
    border-color: color-mix(in srgb, var(--color-error) 42%, var(--color-border) 58%);
    color: color-mix(in srgb, var(--color-error) 76%, var(--color-text) 24%);
  }

  .ghost {
    background: color-mix(in srgb, var(--color-surface-alt) 76%, transparent);
  }

  .control-link.disabled {
    opacity: 0.45;
    pointer-events: none;
  }

  .compact {
    min-height: 2rem;
    padding: 0.35rem 0.58rem;
  }

  @media (max-width: 1180px) {
    .monitor-workspace,
    .feed-grid {
      grid-template-columns: minmax(0, 1fr);
    }

    .setup-rail {
      position: static;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .clear-form {
      grid-column: 1 / -1;
    }
  }

  @media (max-width: 760px) {
    .signal-strip {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .setup-rail {
      grid-template-columns: minmax(0, 1fr);
    }

    .clip-card {
      grid-template-columns: minmax(0, 1fr);
      align-items: stretch;
    }

    .clip-preview {
      width: 100%;
    }

    .clip-actions {
      justify-content: flex-start;
    }
  }

  @media (max-width: 460px) {
    .signal-strip {
      grid-template-columns: minmax(0, 1fr);
    }

    .node-form {
      grid-template-columns: minmax(0, 1fr);
    }

    .feed-head,
    .settings-title,
    .node-row,
    .device-row {
      align-items: flex-start;
      flex-direction: column;
    }
  }
</style>


