<script lang="ts">
  import { onMount } from 'svelte';
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { pushToast } from '$lib/client/toasts';

  type Idea = { id: string; text: string; votes: number };
  type Offset = { x: number; y: number; r: number };
  type Motion = { floatDur: number; pulseDur: number; delay: number };

  let ideas: Idea[] = [];

  let newIdea = '';
  let offsets: Record<string, Offset> = {};
  let motions: Record<string, Motion> = {};

  const randomOffset = (): Offset => ({
    x: Math.random() * 40 - 20,
    y: Math.random() * 40 - 20,
    r: Math.random() * 10 - 5
  });

  const randomMotion = (): Motion => ({
    floatDur: 4 + Math.random() * 4,
    pulseDur: 3 + Math.random() * 3,
    delay: Math.random() * 3
  });

  function size(v: number) {
    return Math.min(128, 54 + v * 4);
  }

  function ideaFontSize(idea: Idea) {
    const cloudSize = size(idea.votes);
    const lengthPenalty = Math.min(0.16, Math.max(0, idea.text.length - 24) * 0.005);
    return Math.max(0.5, Math.min(0.82, cloudSize * 0.0102 - lengthPenalty)).toFixed(3);
  }

  function voteFontSize(votes: number) {
    return Math.max(0.48, Math.min(0.66, size(votes) * 0.0068)).toFixed(3);
  }

  async function loadIdeas() {
    const res = await fetch('/api/whiteboard');
    if (!res.ok) return;
    const rows = (await res.json()) as Array<{ id: string; content: string; votes: number }>;
    ideas = rows.map((row) => ({ id: row.id, text: row.content, votes: row.votes }));

    ideas.forEach((i) => {
      if (!offsets[i.id]) offsets[i.id] = randomOffset();
      if (!motions[i.id]) motions[i.id] = randomMotion();
    });
  }

  async function upvote(id: string) {
    const res = await fetch('/api/whiteboard', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'upvote', id })
    });
    if (res.status === 409) {
      pushToast('You already voted on that idea.', 'info');
      return;
    }
    if (res.status === 401) {
      pushToast('Login required to vote.', 'error');
      return;
    }
    if (!res.ok) {
      pushToast('That vote could not be saved.', 'error');
      return;
    }
    const updated = (await res.json()) as { id: string; content: string; votes: number } | null;
    if (!updated) return;
    ideas = ideas.map((i) => (i.id === id ? { ...i, votes: updated.votes } : i));
    pushToast('Vote saved.', 'success');
  }

  async function addIdea() {
    const text = newIdea.trim();
    if (!text) return;
    const res = await fetch('/api/whiteboard', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'add', content: text })
    });
    if (!res.ok) {
      pushToast('That idea could not be submitted.', 'error');
      return;
    }
    const created = (await res.json()) as { id: string; content: string; votes: number; status: 'approved' | 'pending' };
    if (created.status === 'approved') {
      ideas = [{ id: created.id, text: created.content, votes: created.votes }, ...ideas];
      offsets[created.id] = randomOffset();
      motions[created.id] = randomMotion();
      pushToast('Idea published.', 'success');
    } else {
      pushToast('Idea submitted for admin approval.', 'success');
      await loadIdeas();
    }
    newIdea = '';
  }

  onMount(() => {
    loadIdeas();
  });
</script>

<Layout>
<PageHeader title="Whiteboard" />

<section class="whiteboard-shell">
  <div class="input-row">
    <input
      placeholder="Share an idea..."
      bind:value={newIdea}
      on:keydown={(e) => e.key === 'Enter' && addIdea()}
    />
    <button on:click={addIdea}>Add</button>
  </div>

  <section class="board">
    {#each ideas as idea}
      <div
        class="wrap"
        style="
          transform:
            translate({offsets[idea.id]?.x || 0}px, {offsets[idea.id]?.y || 0}px)
            rotate({offsets[idea.id]?.r || 0}deg);
        "
      >
        <button
          class="cloud-puff card-hit"
          type="button"
          style="
            --cloud-size:{size(idea.votes)}px;
            --idea-font:{ideaFontSize(idea)}rem;
            --vote-font:{voteFontSize(idea.votes)}rem;
            --floatDur:{motions[idea.id]?.floatDur || 6}s;
            --pulseDur:{motions[idea.id]?.pulseDur || 4}s;
            --delay:{motions[idea.id]?.delay || 0}s;
          "
          on:click={() => upvote(idea.id)}
        >
          <img class="cloud-shape" src="/whiteboard-thought-cloud.svg" alt="" aria-hidden="true" />
          <span class="cloud-content">
            <span class="idea-text">{idea.text}</span>
            <small>{idea.votes}</small>
          </span>
        </button>
      </div>
    {/each}
  </section>
</section>
</Layout>

<style>
  .whiteboard-shell {
    position: relative;
    display: grid;
    gap: 0.9rem;
    padding: 1rem;
    border: var(--surface-outline);
    border-radius: var(--radius-lg);
    background: var(--surface-wash), var(--color-surface);
    box-shadow: var(--shadow-xs);
    overflow: hidden;
  }

  .whiteboard-shell::before {
    content: none;
  }

  .input-row {
    display: flex;
    gap: 8px;
    padding-left: 0.2rem;
  }

  input {
    flex: 1;
    padding: 10px 12px;
    border-radius: var(--radius-md);
    border: var(--surface-outline);
    background: var(--color-surface);
    color: var(--color-text);
  }

  .input-row button {
    padding: 10px 14px;
    border-radius: var(--radius-md);
    border: 1px solid color-mix(in srgb, var(--color-primary) 42%, var(--color-border) 58%);
    background: color-mix(in srgb, var(--color-primary) 14%, var(--color-surface));
    color: var(--color-text);
    font-weight: var(--weight-semibold);
    cursor: pointer;
  }

  .board {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 28px;
    min-height: 280px;
    padding: 1rem;
    border: var(--surface-outline);
    border-radius: var(--radius-lg);
    background: color-mix(in srgb, var(--color-surface-alt) 74%, var(--color-surface) 26%);
  }

  .wrap { display: inline-block; }

  .cloud-puff {
    position: relative;
    width: calc(var(--cloud-size) * 1.96);
    min-height: calc(var(--cloud-size) * 1.18);
    padding: calc(var(--cloud-size) * 0.14) calc(var(--cloud-size) * 0.34) calc(var(--cloud-size) * 0.2);
    cursor: pointer;
    display: grid;
    place-items: center;
    align-items: center;
    text-align: center;
    border: 0 !important;
    border-bottom: 0 !important;
    border-radius: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
    color: var(--color-text);
    animation: cloudFloat var(--floatDur) ease-in-out infinite, cloudBreathe var(--pulseDur) ease-in-out infinite;
    animation-delay: var(--delay);
    isolation: isolate;
  }

  .cloud-shape {
    position: absolute;
    inset: -8% -7% -12%;
    width: 114%;
    height: 120%;
    z-index: -1;
    display: block;
    object-fit: contain;
    pointer-events: none;
    filter: drop-shadow(0 10px 18px rgba(17, 18, 20, 0.08));
  }

  @keyframes cloudFloat { 0% { transform: translateY(0) } 50% { transform: translateY(-8px) } 100% { transform: translateY(0) } }
  @keyframes cloudBreathe {
    0% { filter: saturate(1); }
    50% { filter: saturate(1.08); }
    100% { filter: saturate(1); }
  }

  .cloud-content {
    position: absolute;
    z-index: 1;
    display: grid;
    place-items: center;
    gap: calc(var(--cloud-size) * 0.018);
    left: 8%;
    top: 18%;
    width: 50%;
    height: 48%;
    transform: none;
  }

  .idea-text {
    display: -webkit-box;
    max-width: 100%;
    max-height: 3.54em;
    overflow: hidden;
    line-clamp: 3;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    font-size: var(--idea-font);
    font-weight: var(--weight-semibold);
    line-height: 1.18;
    color: var(--color-text);
    overflow-wrap: break-word;
    text-wrap: balance;
    text-align: center;
  }

  small {
    position: relative;
    z-index: 1;
    opacity: 0.78;
    font-size: var(--vote-font);
    margin-top: 0;
    color: var(--color-text-muted);
  }

  @media (max-width: 760px) {
    .whiteboard-shell {
      padding: 0.85rem;
      gap: 0.75rem;
    }

    .input-row {
      flex-direction: column;
      padding-left: 0;
    }

    .input-row button {
      width: 100%;
    }

    .board {
      gap: 16px;
      padding: var(--space-3);
      border-radius: 14px;
    }

    .cloud-puff {
      min-width: 96px;
      min-height: 106px;
      animation-duration: 5s, 4s;
    }
  }
</style>


