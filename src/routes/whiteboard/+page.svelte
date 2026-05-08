<script lang="ts">
  import { onMount } from 'svelte';
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
    return 80 + v * 6;
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
          class="cloud-puff"
          type="button"
          style="
            --cloud-size:{size(idea.votes)}px;
            --floatDur:{motions[idea.id]?.floatDur || 6}s;
            --pulseDur:{motions[idea.id]?.pulseDur || 4}s;
            --delay:{motions[idea.id]?.delay || 0}s;
          "
          on:click={() => upvote(idea.id)}
        >
          <svg class="cloud-shape" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3.5 19A1.5 1.5 0 0 1 5 20.5A1.5 1.5 0 0 1 3.5 22A1.5 1.5 0 0 1 2 20.5A1.5 1.5 0 0 1 3.5 19m5-3a2.5 2.5 0 0 1 2.5 2.5A2.5 2.5 0 0 1 8.5 21A2.5 2.5 0 0 1 6 18.5A2.5 2.5 0 0 1 8.5 16m6-1c-1.19 0-2.27-.5-3-1.35c-.73.85-1.81 1.35-3 1.35c-1.96 0-3.59-1.41-3.93-3.26A4.02 4.02 0 0 1 2 8a4 4 0 0 1 4-4c.26 0 .5.03.77.07C7.5 3.41 8.45 3 9.5 3c1.19 0 2.27.5 3 1.35c.73-.85 1.81-1.35 3-1.35c1.96 0 3.59 1.41 3.93 3.26A4.02 4.02 0 0 1 22 10a4 4 0 0 1-4 4l-.77-.07c-.73.66-1.68 1.07-2.73 1.07" />
          </svg>
          <span>{idea.text}</span>
          <small>{idea.votes}</small>
        </button>
      </div>
    {/each}
  </section>
</section>

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
    content: '';
    position: absolute;
    inset: 0 auto 0 0;
    width: 4px;
    background: color-mix(in srgb, var(--color-primary) 45%, transparent);
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
    background:
      radial-gradient(circle at 18% 12%, color-mix(in srgb, var(--color-primary) 10%, transparent), transparent 32%),
      color-mix(in srgb, var(--color-surface-alt) 74%, var(--color-surface) 26%);
  }

  .wrap { display: inline-block; }

  .cloud-puff {
    position: relative;
    width: calc(var(--cloud-size) * 1.62);
    min-height: calc(var(--cloud-size) * 1.28);
    padding: calc(var(--cloud-size) * 0.22) calc(var(--cloud-size) * 0.28) calc(var(--cloud-size) * 0.38);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    border: 0;
    background: transparent;
    animation: cloudFloat var(--floatDur) ease-in-out infinite, cloudBreathe var(--pulseDur) ease-in-out infinite;
    animation-delay: var(--delay);
    isolation: isolate;
  }

  .cloud-shape {
    position: absolute;
    inset: -5% -5% -8%;
    width: 110%;
    height: 113%;
    z-index: -1;
    overflow: visible;
    color: color-mix(in srgb, var(--color-primary) 32%, var(--color-border) 68%);
    filter: drop-shadow(0 1px 2px rgba(4, 5, 7, 0.18));
  }

  .cloud-shape path {
    fill: color-mix(in srgb, var(--color-surface-soft) 90%, white 10%);
    stroke: currentColor;
    stroke-width: 0.55;
    stroke-linejoin: round;
  }

  @keyframes cloudFloat { 0% { transform: translateY(0) } 50% { transform: translateY(-8px) } 100% { transform: translateY(0) } }
  @keyframes cloudBreathe {
    0% { filter: saturate(1); }
    50% { filter: saturate(1.08); }
    100% { filter: saturate(1); }
  }

  span {
    position: relative;
    z-index: 1;
    max-width: min(calc(var(--cloud-size) * 1.02), 16ch);
    font-size: 0.85rem;
    line-height: 1.18;
    color: var(--color-text);
    overflow-wrap: anywhere;
  }

  small {
    position: relative;
    z-index: 1;
    opacity: 0.78;
    font-size: 0.75rem;
    margin-top: 4px;
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


