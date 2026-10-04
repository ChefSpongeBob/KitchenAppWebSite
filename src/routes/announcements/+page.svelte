<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';

  export let data: {
    announcement: { content: string; updatedAt: number };
  };

  function formatUpdatedAt(value: number) {
    return value
      ? new Date(value * 1000).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
      : 'Not updated yet';
  }

</script>

<svelte:head>
  <title>Announcements | Crimini</title>
</svelte:head>

<Layout>
  <PageHeader title="Announcements" />

  <section class="announcement-shell">
    <article class="announcement-preview">
      <span>Current Announcement</span>
      {#if data.announcement.content}
        {#each data.announcement.content.split('\n') as line}
          <p>{line}</p>
        {/each}
      {:else}
        <p class="muted">Nothing posted.</p>
      {/if}
      <small>{formatUpdatedAt(data.announcement.updatedAt)}</small>
    </article>

  </section>
</Layout>

<style>
  .announcement-shell {
    display: grid;
    gap: 1rem;
    max-width: 54rem;
  }

  .announcement-preview {
    display: grid;
    gap: 0.8rem;
    padding: clamp(0.9rem, 2vw, 1.2rem) 0;
    border: 0;
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
    border-radius: 0;
    background: transparent;
  }

  .announcement-preview span {
    color: var(--color-text-muted);
    font-size: 0.72rem;
    font-weight: var(--weight-semibold);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .announcement-preview p {
    margin: 0;
    color: var(--color-text);
    line-height: 1.5;
  }

  .announcement-preview small,
  .muted {
    color: var(--color-text-muted);
  }

</style>
