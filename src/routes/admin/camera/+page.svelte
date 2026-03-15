<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { enhance } from '$app/forms';

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
    endpoint: string;
    status: string;
    events: CameraEvent[];
    sources: CameraSource[];
  };

  function formatTimestamp(value: number) {
    if (!value) return 'Unknown';
    return new Date(value * 1000).toLocaleString();
  }

  function looksVideo(url: string | null) {
    if (!url) return false;
    return /\.(mp4|webm|ogg|m3u8)(\?|$)/i.test(url);
  }
</script>

<Layout>
  <PageHeader
    title="Admin Camera Activity"
    subtitle="View clips and manage camera feeds."
  />

  <nav class="subnav">
    <a href="/admin">Back to Dashboard</a>
  </nav>

  <section class="grid">
    <article class="panel callout">
      <span class="eyebrow">Endpoint</span>
      <h2>{data.endpoint}</h2>
      <p>Camera events post to this address.</p>
      <code>{data.status}{data.endpoint}</code>
    </article>

    <article class="panel callout">
      <span class="eyebrow">Status</span>
      <h2>Recording Ready</h2>
      <p>Built for motion clips and quick review.</p>
      <form method="POST" action="?/clear_events" use:enhance>
        <button type="submit">Clear Event Log</button>
      </form>
    </article>
  </section>

  <section class="panel">
    <header class="panel-header">
      <div>
        <span class="eyebrow">Live Feed</span>
        <h2>Camera Sources</h2>
      </div>
      <p>{data.sources.length} feeds configured</p>
    </header>

    <form method="POST" action="?/save_source" use:enhance class="source-form">
      <input name="camera_id" placeholder="camera-1" />
      <input name="name" placeholder="Front Entry" required />
      <input name="live_url" placeholder="Live feed URL" />
      <input name="preview_image_url" placeholder="Preview image URL" />
      <select name="is_active">
        <option value="1" selected>Active</option>
        <option value="0">Inactive</option>
      </select>
      <button type="submit">Save Feed</button>
    </form>

    {#if data.sources.length === 0}
      <p class="empty-copy">No camera feeds yet.</p>
    {:else}
      <div class="feed-grid">
        {#each data.sources as source}
          <article class="feed-card">
            <header>
              <div>
                <h3>{source.name}</h3>
                <p>{source.camera_id ?? 'No camera id'}</p>
              </div>
              <span class:inactive={source.is_active !== 1}>
                {source.is_active === 1 ? 'Live' : 'Paused'}
              </span>
            </header>

            <div class="feed-stage">
              {#if source.live_url}
                {#if looksVideo(source.live_url)}
                  <video controls autoplay muted playsinline preload="metadata">
                    <source src={source.live_url} />
                  </video>
                {:else}
                  <iframe title={source.name} src={source.live_url} loading="lazy"></iframe>
                {/if}
              {:else if source.preview_image_url}
                <img src={source.preview_image_url} alt={`${source.name} preview`} />
              {:else}
                <div class="feed-placeholder">No live feed set</div>
              {/if}
            </div>

            <form method="POST" action="?/save_source" use:enhance class="feed-edit">
              <input type="hidden" name="id" value={source.id} />
              <input name="camera_id" value={source.camera_id ?? ''} placeholder="camera-1" />
              <input name="name" value={source.name} required />
              <input name="live_url" value={source.live_url ?? ''} placeholder="Live feed URL" />
              <input name="preview_image_url" value={source.preview_image_url ?? ''} placeholder="Preview image URL" />
              <select name="is_active">
                <option value="1" selected={source.is_active === 1}>Active</option>
                <option value="0" selected={source.is_active !== 1}>Inactive</option>
              </select>
              <button type="submit">Update</button>
            </form>
            <form method="POST" action="?/delete_source" use:enhance class="delete-source">
              <input type="hidden" name="id" value={source.id} />
              <button type="submit" class="danger">Delete</button>
            </form>
          </article>
        {/each}
      </div>
    {/if}
  </section>

  <section class="panel">
    <header class="panel-header">
      <div>
        <span class="eyebrow">Recent Activity</span>
        <h2>Motion Clips</h2>
      </div>
      <p>{data.events.length} stored</p>
    </header>

    <table class="sheet">
      <thead>
        <tr>
          <th>Camera</th>
          <th>Type</th>
          <th>Still</th>
          <th>Clip</th>
          <th>Received</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#if data.events.length === 0}
          <tr><td colspan="6">No camera events yet.</td></tr>
        {:else}
          {#each data.events as event}
            <tr>
              <td>{event.camera_name ?? event.camera_id ?? 'Unnamed camera'}</td>
              <td>{event.event_type}</td>
              <td>
                {#if event.image_url}
                  <a href={event.image_url} target="_blank" rel="noreferrer">View still</a>
                {:else}
                  None
                {/if}
              </td>
              <td>
                {#if event.clip_url}
                  <div class="clip-links">
                    <a href={event.clip_url} target="_blank" rel="noreferrer">Open clip</a>
                    <a href={event.clip_url} download>Download</a>
                    {#if event.clip_duration_seconds}
                      <span>{event.clip_duration_seconds}s</span>
                    {/if}
                  </div>
                {:else}
                  No clip
                {/if}
              </td>
              <td>{formatTimestamp(event.created_at)}</td>
              <td>
                <form method="POST" action="?/delete_event" use:enhance>
                  <input type="hidden" name="id" value={event.id} />
                  <button type="submit" class="danger">Delete</button>
                </form>
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </section>
</Layout>

<style>
  .subnav {
    margin: 0.5rem 0 1rem;
  }

  .subnav a {
    text-decoration: none;
    color: var(--color-text-muted);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 999px;
    padding: 0.32rem 0.7rem;
    background: rgba(255, 255, 255, 0.03);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.8rem;
    margin-bottom: 1rem;
  }

  .panel {
    position: relative;
    padding: 1rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-lg);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.008) 42%, rgba(255, 255, 255, 0)),
      color-mix(in srgb, var(--color-surface) 95%, black 5%);
  }

  .panel::before {
    content: '';
    position: absolute;
    inset: 0 auto 0 0;
    width: 4px;
    border-radius: var(--radius-lg) 0 0 var(--radius-lg);
    background: linear-gradient(180deg, rgba(195, 32, 43, 0.88), rgba(195, 32, 43, 0.2));
  }

  .callout h2,
  .panel-header h2 {
    margin: 0.25rem 0 0;
  }

  .eyebrow,
  .callout p,
  .panel-header p,
  .empty-copy,
  .feed-card header p {
    color: var(--color-text-muted);
  }

  code {
    display: inline-flex;
    margin-top: 0.75rem;
    padding: 0.5rem 0.7rem;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.03);
    font-size: 0.78rem;
    word-break: break-all;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: end;
    margin-bottom: 0.8rem;
  }

  .source-form,
  .feed-edit {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr)) auto;
    gap: 0.55rem;
    margin-bottom: 1rem;
  }

  .feed-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.8rem;
  }

  .feed-card {
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    padding: 0.85rem;
    background: rgba(255, 255, 255, 0.02);
  }

  .feed-card header {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    align-items: start;
    margin-bottom: 0.7rem;
  }

  .feed-card h3 {
    margin: 0;
  }

  .feed-card header span {
    border: 1px solid rgba(22, 163, 74, 0.4);
    color: #86efac;
    border-radius: 999px;
    padding: 0.18rem 0.55rem;
    font-size: 0.72rem;
  }

  .feed-card header span.inactive {
    border-color: rgba(245, 158, 11, 0.35);
    color: #fcd34d;
  }

  .feed-stage {
    aspect-ratio: 16 / 9;
    border-radius: 12px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.28);
    margin-bottom: 0.75rem;
  }

  .feed-stage iframe,
  .feed-stage video,
  .feed-stage img {
    width: 100%;
    height: 100%;
    border: 0;
    object-fit: cover;
  }

  .feed-placeholder {
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
    color: var(--color-text-muted);
    font-size: 0.88rem;
  }

  .delete-source {
    margin-top: 0.55rem;
  }

  .sheet {
    width: 100%;
    border-collapse: collapse;
  }

  .sheet th,
  .sheet td {
    text-align: left;
    padding: 0.48rem 0.42rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    vertical-align: top;
  }

  .sheet th {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-muted);
    background: rgba(255, 255, 255, 0.02);
  }

  .clip-links {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
    align-items: center;
  }

  .clip-links span {
    color: var(--color-text-muted);
    font-size: 0.76rem;
  }

  input,
  select {
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 0.42rem 0.55rem;
    background: color-mix(in srgb, var(--color-surface-alt) 92%, black 8%);
    color: var(--color-text);
    font-size: 0.82rem;
    width: 100%;
  }

  button,
  a {
    color: var(--color-text-soft);
  }

  button {
    border: 1px solid rgba(195, 32, 43, 0.22);
    border-radius: 10px;
    background: linear-gradient(180deg, rgba(195, 32, 43, 0.22), rgba(195, 32, 43, 0.08));
    padding: 0.4rem 0.62rem;
    cursor: pointer;
    font-size: 0.78rem;
  }

  .danger {
    border-color: rgba(239, 68, 68, 0.3);
    color: #ffb6b6;
    background: linear-gradient(180deg, rgba(120, 12, 18, 0.45), rgba(120, 12, 18, 0.16));
  }

  @media (max-width: 1100px) {
    .source-form,
    .feed-edit {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 900px) {
    .grid,
    .feed-grid {
      grid-template-columns: minmax(0, 1fr);
    }

    .sheet {
      min-width: 760px;
    }
  }
</style>
