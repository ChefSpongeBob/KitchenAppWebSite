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
    is_active: number;
    updated_at: number;
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
    events: CameraEvent[];
    sources: CameraSource[];
    iotDevices: IoTDevice[];
  };

  let feedbackMessage = '';

  function keyFor(value: string | null | undefined) {
    return String(value ?? '').trim().toLowerCase();
  }

  function sourceForDevice(device: IoTDevice) {
    return data.sources.find((source) => keyFor(source.camera_id) === keyFor(device.externalDeviceId));
  }

  function eventsForCamera(device: IoTDevice, source?: CameraSource) {
    const serial = keyFor(device.externalDeviceId);
    const name = keyFor(device.displayName);
    const sourceName = keyFor(source?.name);
    return data.events.filter((event) => {
      const cameraId = keyFor(event.camera_id);
      const cameraName = keyFor(event.camera_name);
      return cameraId === serial || cameraName === name || cameraName === sourceName;
    });
  }

  $: cameraDevices = data.iotDevices.filter((device) => device.deviceType === 'camera');
  $: legacyCameraSources = data.sources.filter(
    (source) => !cameraDevices.some((device) => keyFor(device.externalDeviceId) === keyFor(source.camera_id))
  );
  $: cameraCards = [
    ...cameraDevices.map((device) => {
      const source = sourceForDevice(device);
      const events = eventsForCamera(device, source);
      const latestEvent = events[0];
      return {
        id: device.id,
        serial: device.externalDeviceId,
        title: source?.name ?? device.displayName,
        isActive: device.isActive === 1 && device.revokedAt === null,
        latest_clip_url: latestEvent?.clip_url ?? null,
        still_url: latestEvent?.image_url ?? null,
        download_url: latestEvent?.clip_url ?? latestEvent?.image_url ?? null,
        latestLabel: latestEvent?.clip_url ? 'Latest clip' : latestEvent?.image_url ? 'Latest still' : 'Waiting for media',
        latestAt: latestEvent?.created_at ?? null,
        events
      };
    }),
    ...legacyCameraSources.map((source) => {
      const events = data.events.filter((event) => keyFor(event.camera_id) === keyFor(source.camera_id) || keyFor(event.camera_name) === keyFor(source.name));
      const latestEvent = events[0];
      return {
        id: source.id,
        serial: source.camera_id ?? source.name,
        title: source.name,
        isActive: source.is_active === 1,
        latest_clip_url: latestEvent?.clip_url ?? null,
        still_url: latestEvent?.image_url ?? null,
        download_url: latestEvent?.clip_url ?? latestEvent?.image_url ?? null,
        latestLabel: latestEvent?.clip_url ? 'Latest clip' : latestEvent?.image_url ? 'Latest still' : 'Waiting for media',
        latestAt: latestEvent?.created_at ?? null,
        events
      };
    })
  ];

  $: activeCameraCount = cameraCards.filter((camera) => camera.isActive).length;
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

  const withFeedback: SubmitFunction = () => {
    feedbackMessage = '';
    return async ({ result }) => {
      await applyAction(result);
      if (result.type === 'success') {
        await invalidateAll();
        pushToast('Camera media updated.', 'success');
      } else if (result.type === 'failure') {
        pushToast(result.data?.error ?? 'That action could not be completed.', 'error');
      }
      feedbackMessage =
        result.type === 'success'
          ? 'Camera media updated.'
          : result.type === 'failure'
            ? result.data?.error ?? 'That action could not be completed.'
            : '';
    };
  };
</script>

<Layout>
  <PageHeader title="Camera Media" />

  {#if feedbackMessage}
    <p class="feedback-banner">{feedbackMessage}</p>
  {/if}

  <section class="status-strip" aria-label="Camera media status">
    <div>
      <span>Cameras</span>
      <strong>{activeCameraCount}/{cameraCards.length}</strong>
    </div>
    <div>
      <span>Media</span>
      <strong>{mediaEventCount}</strong>
    </div>
    <div>
      <span>Latest</span>
      <strong>{formatShortTime(latestCameraEvent)}</strong>
    </div>
  </section>

  <section class="camera-view">
    {#if cameraCards.length === 0}
      <article class="empty-line-panel">
        <span class="material-icons" aria-hidden="true">videocam_off</span>
        <div>
          <h2>No cameras registered.</h2>
          <p>Register camera units from Camera Setup.</p>
        </div>
      </article>
    {:else}
      <div class="feed-grid" aria-label="Camera feeds">
        {#each cameraCards as camera}
          <article class="feed-card">
            <header class="feed-head">
              <div>
                <h2>{camera.title}</h2>
                <small>{camera.serial} / {camera.latestLabel}</small>
              </div>
              <span class:inactive={!camera.isActive}>{camera.isActive ? 'Active' : 'Idle'}</span>
            </header>

            <div class="feed-stage">
              {#if camera.latest_clip_url}
                <video src={camera.latest_clip_url} controls preload="metadata" playsinline>
                  <track kind="captions" />
                </video>
              {:else if camera.still_url}
                <img src={camera.still_url} alt={`${camera.title} preview`} />
              {:else}
                <div class="feed-placeholder">
                  <span class="material-icons" aria-hidden="true">photo_camera</span>
                  <p>Waiting for camera media.</p>
                </div>
              {/if}
            </div>

            <div class="feed-controls">
              <span>Updated {formatTimestamp(camera.latestAt)}</span>
              {#if camera.download_url}
                <a class="control-link" href={camera.download_url} target="_blank" rel="noreferrer" download>Download</a>
              {/if}
            </div>

            <section class="camera-activity">
              <div class="activity-head">
                <h3>Activity</h3>
                <span>{camera.events.length} saved</span>
              </div>

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
                          <video src={event.clip_url} controls preload="metadata" playsinline>
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
      </div>
    {/if}

    <details class="maintenance-panel">
      <summary class="section-heading">
        <span class="material-icons" aria-hidden="true">cleaning_services</span>
        <div>
          <h2>Media Cleanup</h2>
          <p>Clear saved camera clips.</p>
        </div>
      </summary>
      <form method="POST" action="?/clear_events" use:enhance={withFeedback}>
        <button type="submit" class="danger">Clear Clips</button>
      </form>
    </details>
  </section>
</Layout>

<style>
  .feedback-banner,
  .empty-line-panel,
  .feed-card,
  .maintenance-panel {
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
    background: linear-gradient(180deg, color-mix(in srgb, var(--color-surface) 96%, transparent), transparent);
  }

  .feedback-banner {
    margin: 0 0 0.9rem;
    padding: 0.72rem 0.9rem;
    color: var(--color-text);
  }

  .status-strip {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
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
  .feed-head small,
  .feed-controls span,
  .clip-main span,
  .clip-main small,
  .clip-card.empty,
  .section-heading p,
  .empty-line-panel p {
    color: var(--color-text-muted);
  }

  .status-strip strong {
    font-size: clamp(1.1rem, 1.7vw, 1.42rem);
  }

  .camera-view {
    display: grid;
    gap: 1rem;
    margin-top: 1rem;
  }

  .empty-line-panel {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    min-height: 5.25rem;
    padding: 1rem 0;
    border-left: 0;
    border-right: 0;
  }

  .empty-line-panel h2,
  .empty-line-panel p,
  .section-heading h2,
  .feed-head h2,
  .activity-head h3 {
    margin: 0;
  }

  .empty-line-panel p,
  .section-heading p {
    margin-top: 0.12rem;
  }

  .feed-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
  }

  .feed-card,
  .maintenance-panel {
    min-width: 0;
    padding: 1rem;
  }

  .feed-head,
  .activity-head,
  .feed-controls,
  .clip-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.72rem;
    flex-wrap: wrap;
  }

  .feed-head > span {
    color: color-mix(in srgb, var(--color-success) 68%, var(--color-text) 32%);
    font-size: 0.78rem;
  }

  .feed-head > span.inactive {
    color: var(--color-text-muted);
  }

  .feed-stage {
    display: grid;
    place-items: center;
    margin-top: 0.9rem;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
    background: #050607;
  }

  .feed-stage img,
  .feed-stage video,
  .clip-preview img,
  .clip-preview video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .feed-placeholder {
    display: grid;
    place-items: center;
    gap: 0.35rem;
    color: var(--color-text-muted);
    text-align: center;
  }

  .feed-controls {
    margin-top: 0.68rem;
  }

  .camera-activity {
    margin-top: 0.95rem;
    padding-top: 0.85rem;
    border-top: 1px solid var(--color-divider);
  }

  .clip-list {
    display: grid;
    gap: 0.65rem;
    margin-top: 0.7rem;
  }

  .clip-card {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(110px, 160px) auto;
    gap: 0.72rem;
    align-items: center;
    padding-top: 0.65rem;
    border-top: 1px solid var(--color-divider);
  }

  .clip-card:first-child {
    border-top: 0;
    padding-top: 0;
  }

  .clip-main {
    display: grid;
    gap: 0.14rem;
    min-width: 0;
  }

  .clip-preview {
    width: 100%;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    background: #050607;
  }

  button,
  .control-link,
  .clip-actions a {
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
    text-decoration: none;
  }

  .danger {
    color: color-mix(in srgb, var(--color-error) 76%, var(--color-text) 24%);
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

  .maintenance-panel[open] > summary {
    margin-bottom: 0.95rem;
  }

  @media (max-width: 1180px) {
    .feed-grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  @media (max-width: 700px) {
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

    .clip-card {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
