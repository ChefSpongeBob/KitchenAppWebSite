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

  export let data: {
    events: CameraEvent[];
    sources: CameraSource[];
  };

  let feedPlaying: Record<string, boolean> = {};
  let feedbackMessage = '';

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
      title: camera.title,
      id: source?.id ?? `static-${camera.slot}`,
      camera_id: source?.camera_id ?? camera.slot,
      live_url: source?.live_url ?? null,
      latest_clip_url: latestEvent?.clip_url ?? null,
      preview_image_url: latestEvent?.image_url ?? source?.preview_image_url ?? null,
      download_url: latestEvent?.clip_url ?? latestEvent?.image_url ?? source?.preview_image_url ?? null,
      is_active: source?.is_active ?? 0,
      latestLabel: latestEvent?.clip_url ? 'Latest clip' : latestEvent?.image_url ? 'Latest still' : 'No media yet',
      events
    };
  });

  function formatTimestamp(value: number) {
    if (!value) return 'Unknown';
    return new Date(value * 1000).toLocaleString();
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
        await invalidateAll();
        pushToast('Camera activity updated.', 'success');
      } else if (result.type === 'failure') {
        pushToast(result.data?.error ?? 'That camera action could not be completed.', 'error');
      }
      feedbackMessage =
        result.type === 'success'
          ? 'Camera activity updated.'
          : result.type === 'failure'
            ? result.data?.error ?? 'That camera action could not be completed.'
            : '';
    };
  };
</script>

<Layout>
  <PageHeader
    title="Admin Camera Activity"
    subtitle="View current cameras and open saved clips."
  />

  <nav class="subnav">
    <a href="/admin">Back to Dashboard</a>
    <form method="POST" action="?/clear_events" use:enhance={withFeedback}>
      <button type="submit">Clear Clips</button>
    </form>
  </nav>

  {#if feedbackMessage}
    <p class="feedback-banner">{feedbackMessage}</p>
  {/if}

  <section class="feed-grid">
    {#each cameraCards as camera}
      <article class="feed-card">
        <header class="feed-head">
          <div>
            <span class="eyebrow">Camera</span>
            <h2>{camera.title}</h2>
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
</Layout>

<style>
  .subnav {
    margin: 0.5rem 0 1rem;
    display: flex;
    gap: 0.6rem;
    align-items: center;
    flex-wrap: wrap;
  }

  .subnav a {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    color: var(--color-text-muted);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 999px;
    min-height: 2.4rem;
    padding: 0.42rem 0.8rem;
    background: rgba(255, 255, 255, 0.03);
  }

  .feed-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.9rem;
  }

  .feed-card {
    position: relative;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-lg);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.008) 42%, rgba(255, 255, 255, 0)),
      color-mix(in srgb, var(--color-surface) 95%, black 5%);
    padding: 1rem;
  }

  .feedback-banner {
    margin: 0 0 0.9rem;
    padding: 0.72rem 0.9rem;
    border: 1px solid rgba(22, 163, 74, 0.22);
    border-radius: 12px;
    background: linear-gradient(180deg, rgba(22, 163, 74, 0.18), rgba(22, 163, 74, 0.06));
    color: #bbf7d0;
  }

  .feed-card::before {
    content: '';
    position: absolute;
    inset: 0 auto 0 0;
    width: 4px;
    border-radius: var(--radius-lg) 0 0 var(--radius-lg);
    background: linear-gradient(180deg, rgba(195, 32, 43, 0.88), rgba(195, 32, 43, 0.2));
  }

  .feed-head {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: end;
  }

  .feed-head h2 {
    margin: 0.18rem 0 0;
  }

  .eyebrow,
  .clip-main span {
    color: var(--color-text-muted);
  }

  .feed-head > span {
    border: 1px solid rgba(22, 163, 74, 0.4);
    color: #86efac;
    border-radius: 999px;
    padding: 0.18rem 0.55rem;
    font-size: 0.72rem;
  }

  .feed-head > span.inactive {
    border-color: rgba(245, 158, 11, 0.35);
    color: #fcd34d;
  }

  .feed-stage {
    margin-top: 0.85rem;
    aspect-ratio: 16 / 9;
    border-radius: 12px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.28);
  }

  .feed-stage iframe,
  .feed-stage img,
  .feed-stage video {
    width: 100%;
    height: 100%;
    border: 0;
    object-fit: cover;
    background: #000;
  }

  .feed-placeholder {
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
    color: var(--color-text-muted);
    font-size: 0.88rem;
  }

  .feed-controls {
    display: flex;
    gap: 0.55rem;
    margin-top: 0.8rem;
    flex-wrap: wrap;
  }

  .control-link,
  .muted-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    min-height: 2.5rem;
  }

  .control-link {
    border: 1px solid rgba(195, 32, 43, 0.22);
    border-radius: 10px;
    background: linear-gradient(180deg, rgba(195, 32, 43, 0.22), rgba(195, 32, 43, 0.08));
    padding: 0.55rem 0.78rem;
    font-size: 0.78rem;
    color: var(--color-text-soft);
  }

  .control-link.disabled {
    opacity: 0.45;
    pointer-events: none;
  }

  .muted-btn {
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.06);
  }

  .camera-activity {
    margin-top: 0.95rem;
    padding-top: 0.9rem;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .activity-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .activity-head h3 {
    margin: 0;
    font-size: 0.98rem;
  }

  .activity-head span {
    color: var(--color-text-muted);
    font-size: 0.8rem;
  }

  .clip-list {
    display: grid;
    gap: 0.55rem;
    margin-top: 0.8rem;
  }

  .clip-card {
    display: flex;
    justify-content: space-between;
    gap: 0.8rem;
    align-items: center;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    padding: 0.7rem 0.85rem;
    background: rgba(255, 255, 255, 0.02);
  }

  .clip-card.empty {
    color: var(--color-text-muted);
  }

  .clip-main {
    display: grid;
    gap: 0.18rem;
  }

  .clip-main small {
    color: var(--color-text-muted);
    font-size: 0.75rem;
  }

  .clip-preview {
    width: min(100%, 380px);
    aspect-ratio: 16 / 9;
    border-radius: 10px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.28);
    flex: 0 0 auto;
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
    object-fit: contain;
    background: rgba(0, 0, 0, 0.38);
  }

  .clip-actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    flex-wrap: wrap;
  }

  .clip-actions a {
    color: var(--color-text-soft);
    text-decoration: none;
  }

  button {
    border: 1px solid rgba(195, 32, 43, 0.22);
    border-radius: 10px;
    background: linear-gradient(180deg, rgba(195, 32, 43, 0.22), rgba(195, 32, 43, 0.08));
    color: var(--color-text-soft);
    min-height: 2.5rem;
    padding: 0.55rem 0.78rem;
    cursor: pointer;
    font-size: 0.78rem;
    font-weight: var(--weight-medium);
  }

  .danger {
    border-color: rgba(239, 68, 68, 0.3);
    color: #ffb6b6;
    background: linear-gradient(180deg, rgba(120, 12, 18, 0.45), rgba(120, 12, 18, 0.16));
  }

  @media (max-width: 900px) {
    .feed-grid {
      grid-template-columns: minmax(0, 1fr);
    }

    .clip-card {
      flex-direction: column;
      align-items: start;
    }

    .clip-preview {
      width: 100%;
    }
  }
</style>
