<script lang="ts">
  import { onMount } from 'svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';

  type Idea = { id: string; text: string; votes: number };
  type Offset = { x: number; y: number; r: number };
  type Motion = { floatDur: number; pulseDur: number; delay: number };

  let ideas: Idea[] = [];
  let submitNote = '';

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
    if (!res.ok) return;
    const updated = (await res.json()) as { id: string; content: string; votes: number } | null;
    if (!updated) return;
    ideas = ideas.map((i) => (i.id === id ? { ...i, votes: updated.votes } : i));
  }

  async function addIdea() {
    const text = newIdea.trim();
    if (!text) return;
    const res = await fetch('/api/whiteboard', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'add', content: text })
    });
    if (!res.ok) return;
    const created = (await res.json()) as { id: string; content: string; votes: number; status: 'approved' | 'pending' };
    if (created.status === 'approved') {
      ideas = [{ id: created.id, text: created.content, votes: created.votes }, ...ideas];
      offsets[created.id] = randomOffset();
      motions[created.id] = randomMotion();
      submitNote = 'Idea published.';
    } else {
      submitNote = 'Idea submitted for admin approval.';
      await loadIdeas();
    }
    newIdea = '';
  }

  onMount(() => {
    loadIdeas();
  });
</script>

<PageHeader title="Whiteboard" subtitle="Brainstorm space" />

<div class="input-row">
  <input
    placeholder="Drop an idea..."
    bind:value={newIdea}
    on:keydown={(e) => e.key === 'Enter' && addIdea()}
  />
  <button on:click={addIdea}>Add</button>
</div>
{#if submitNote}
  <p class="submit-note">{submitNote}</p>
{/if}

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
        class="bubble"
        type="button"
        style="
          width:{size(idea.votes)}px;
          height:{size(idea.votes)}px;
          --glow:{idea.votes};
          --floatDur:{motions[idea.id]?.floatDur || 6}s;
          --pulseDur:{motions[idea.id]?.pulseDur || 4}s;
          --delay:{motions[idea.id]?.delay || 0}s;
        "
        on:click={() => upvote(idea.id)}
      >
        <span>{idea.text}</span>
        <small>{idea.votes}</small>
      </button>
    </div>
  {/each}
</section>

<style>
  .input-row { display: flex; gap: 8px; padding: var(--space-3) var(--space-4); }
  input { flex: 1; padding: 10px 12px; border-radius: 12px; border: 1px solid color-mix(in srgb, var(--color-border) 70%, white 30%); background: linear-gradient(180deg, color-mix(in srgb, var(--color-surface) 82%, white 18%), var(--color-surface)); color: var(--color-text); outline: none; }
  button { padding: 10px 14px; border-radius: 12px; border: 1px solid var(--color-border); cursor: pointer; background: linear-gradient(180deg, color-mix(in srgb, var(--color-surface-alt) 82%, white 18%), var(--color-surface-alt)); color: var(--color-text); }
  .submit-note { margin: 0; padding: 0 var(--space-4); color: var(--color-text-muted); font-size: 0.82rem; }
  .board { display: flex; flex-wrap: wrap; justify-content: center; gap: 28px; padding: var(--space-4); background: radial-gradient(80% 70% at 50% 20%, color-mix(in srgb, var(--color-surface-alt) 72%, white 28%), var(--color-surface)); border: 1px solid var(--color-border); border-radius: 18px; }
  .wrap { display: inline-block; }
  .bubble { position: relative; border-radius: 50%; padding: 16px; cursor: pointer; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; background: radial-gradient(circle at 30% 30%, color-mix(in srgb, #ffffff 62%, transparent 38%), color-mix(in srgb, #67e8f9 22%, transparent 78%)); border: 1px solid color-mix(in srgb, #67e8f9 40%, var(--color-border) 60%); backdrop-filter: blur(8px); animation: float var(--floatDur) ease-in-out infinite, glowPulse var(--pulseDur) ease-in-out infinite; animation-delay: var(--delay); box-shadow: 0 10px 30px rgba(24, 76, 86, 0.18), inset -6px -6px 14px rgba(255, 255, 255, 0.28); overflow: hidden; }
  .bubble::before { content: ''; position: absolute; inset: 10% 15% auto auto; width: 30%; height: 30%; border-radius: 50%; background: color-mix(in srgb, #ffffff 70%, transparent 30%); opacity: 0.45; }
  @keyframes float { 0% { transform: translateY(0) } 50% { transform: translateY(-14px) } 100% { transform: translateY(0) } }
  @keyframes glowPulse { 0% { box-shadow: 0 8px 18px rgba(28,82,91,0.12); } 50% { box-shadow: 0 14px 34px rgba(28,82,91,0.24); } 100% { box-shadow: 0 8px 18px rgba(28,82,91,0.12); } }
  span { position: relative; z-index: 1; font-size: 0.85rem; line-height: 1.2; color: #06202d; }
  small { position: relative; z-index: 1; opacity: 0.75; font-size: 0.75rem; margin-top: 6px; color: #0e3b4f; }
</style>
