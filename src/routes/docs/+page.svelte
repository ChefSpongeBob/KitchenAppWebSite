<script>
  import { onMount } from "svelte";

  let docs = [];
  let loading = true;

  onMount(async () => {
    try {
      const res = await fetch("https://ktchwork.chefspongebobsrecepiebook.workers.dev/docs");
      docs = await res.json();
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  });
</script>

<h1>Documents</h1>

{#if loading}
  <p>Loading...</p>
{:else if docs.length === 0}
  <p>No documents yet.</p>
{:else}
  <div class="grid">
    {#each docs as d}
      <div class="card">
        <h3>{d.title}</h3>
        <small>{d.section} / {d.category}</small>

        {#if d.file_url}
          <a href={d.file_url} target="_blank">Open</a>
        {/if}
      </div>
    {/each}
  </div>
{/if}

<style>
  h1 {
    text-align: center;
    margin: 1.5rem 0;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px,1fr));
    gap: 16px;
    padding: 1rem;
  }

  .card {
    background: var(--color-surface, #1e1e1e);
    padding: 16px;
    border-radius: 14px;
    border: 1px solid #2a2a2a;
  }

  h3 {
    margin: 0 0 6px;
  }

  small {
    opacity: .7;
  }

  a {
    display: inline-block;
    margin-top: 10px;
    text-decoration: none;
    font-size: 0.9rem;
    opacity: .9;
  }
</style>
