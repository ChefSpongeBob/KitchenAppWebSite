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
</section>

<style>
  .whiteboard-shell {
    position: relative;
    display: grid;
    gap: 0.9rem;
    padding: 1rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-lg);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0.01) 48%, rgba(255, 255, 255, 0)),
      color-mix(in srgb, var(--color-surface) 94%, black 6%);
    box-shadow: 0 18px 36px rgba(4, 5, 7, 0.18);
    overflow: hidden;
  }

  .whiteboard-shell::before {
    content: '';
    position: absolute;
    inset: 0 auto 0 0;
    width: 4px;
    background: linear-gradient(180deg, rgba(195, 32, 43, 0.9), rgba(195, 32, 43, 0.2));
  }

  .input-row {
    display: flex;
    gap: 8px;
    padding-left: 0.2rem;
  }

  input {
    flex: 1;
    padding: 10px 12px;
    border-radius: 12px;
  }

  button {
    padding: 10px 14px;
    border-radius: 12px;
    cursor: pointer;
  }
  .board {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 28px;
    min-height: 280px;
    padding: 1rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 18px;
    background:
      radial-gradient(circle at top, rgba(195, 32, 43, 0.08), transparent 36%),
      linear-gradient(180deg, color-mix(in srgb, var(--color-surface-alt) 80%, black 20%), var(--color-surface));
  }
  .wrap { display: inline-block; }
  .bubble {
    position: relative;
    border-radius: 50%;
    padding: 16px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    background:
      radial-gradient(circle at 30% 28%, rgba(255, 255, 255, 0.22), transparent 36%),
      radial-gradient(circle at 70% 78%, rgba(195, 32, 43, 0.16), transparent 42%),
      linear-gradient(180deg, color-mix(in srgb, var(--color-surface-soft) 84%, var(--color-primary) 16%), color-mix(in srgb, var(--color-surface) 94%, black 6%));
    border: 1px solid color-mix(in srgb, var(--color-primary) 36%, var(--color-border) 64%);
    backdrop-filter: blur(8px);
    animation: float var(--floatDur) ease-in-out infinite, glowPulse var(--pulseDur) ease-in-out infinite;
    animation-delay: var(--delay);
    box-shadow:
      0 12px 32px rgba(9, 10, 12, 0.32),
      inset -6px -6px 14px rgba(255, 255, 255, 0.04);
    overflow: hidden;
  }
  .bubble::before {
    content: '';
    position: absolute;
    inset: 12% 16% auto auto;
    width: 30%;
    height: 30%;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.18);
    opacity: 0.42;
  }
  @keyframes float { 0% { transform: translateY(0) } 50% { transform: translateY(-14px) } 100% { transform: translateY(0) } }
  @keyframes glowPulse {
    0% { box-shadow: 0 10px 22px rgba(8, 9, 12, 0.24); }
    50% { box-shadow: 0 16px 38px rgba(195, 32, 43, 0.18); }
    100% { box-shadow: 0 10px 22px rgba(8, 9, 12, 0.24); }
  }
  span { position: relative; z-index: 1; font-size: 0.85rem; line-height: 1.2; color: var(--color-text); }
  small { position: relative; z-index: 1; opacity: 0.78; font-size: 0.75rem; margin-top: 6px; color: var(--color-text-muted); }

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

    .bubble {
      min-width: 96px;
      min-height: 96px;
      animation-duration: 5s, 4s;
    }
  }
</style>

