<script>
  import { onMount } from "svelte";
  import PageHeader from '$lib/components/ui/PageHeader.svelte';

  let ideas = [
    { id: 1, text: "Mango crab roll", votes: 8 },
    { id: 2, text: "Prep sauce kits", votes: 3 },
    { id: 3, text: "Late-night menu", votes: 12 },
    { id: 4, text: "Seasonal specials", votes: 5 }
  ];

  let newIdea = "";

  function upvote(id) {
    ideas = ideas.map(i =>
      i.id === id ? { ...i, votes: i.votes + 1 } : i
    );
  }

  function addIdea() {
    const text = newIdea.trim();
    if (!text) return;

    const id = Date.now();
    ideas = [...ideas, { id, text, votes: 1 }];

    offsets[id] = randomOffset();
    motions[id] = randomMotion();

    newIdea = "";
  }

  const size = v => 80 + v * 6;

  let offsets = {};
  let motions = {};

  const randomOffset = () => ({
    x: Math.random()*40-20,
    y: Math.random()*40-20,
    r: Math.random()*10-5
  });

  const randomMotion = () => ({
    floatDur: 4 + Math.random()*4,
    pulseDur: 3 + Math.random()*3,
    delay: Math.random()*3
  });

  onMount(() => {
    ideas.forEach(i => {
      offsets[i.id] = randomOffset();
      motions[i.id] = randomMotion();
    });
  });
</script>

<PageHeader
  title="Whiteboard"
  subtitle="Brainstorm space"
/>

<div class="input-row">
  <input
    placeholder="Drop an idea..."
    bind:value={newIdea}
    on:keydown={(e)=>e.key==="Enter"&&addIdea()}
  />
  <button on:click={addIdea}>Add</button>
</div>

<section class="board">
  {#each ideas as idea}
    <div
      class="wrap"
      style="
        transform:
          translate({offsets[idea.id]?.x||0}px,
                    {offsets[idea.id]?.y||0}px)
          rotate({offsets[idea.id]?.r||0}deg);
      "
    >
      <div
        class="bubble"
        style="
          width:{size(idea.votes)}px;
          height:{size(idea.votes)}px;
          --glow:{idea.votes};
          --floatDur:{motions[idea.id]?.floatDur||6}s;
          --pulseDur:{motions[idea.id]?.pulseDur||4}s;
          --delay:{motions[idea.id]?.delay||0}s;
        "
        on:click={()=>upvote(idea.id)}
      >
        <span>{idea.text}</span>
        <small>▲ {idea.votes}</small>
      </div>
    </div>
  {/each}
</section>

<style>
  .input-row {
    display:flex;
    gap:8px;
    padding:var(--space-3) var(--space-4);
  }

  input {
    flex:1;
    padding:10px 12px;
    border-radius:12px;
    border:1px solid rgba(255,255,255,0.15);
    background:rgba(255,255,255,0.05);
    color:white;
    outline:none;
  }

  button {
    padding:10px 14px;
    border-radius:12px;
    border:none;
    cursor:pointer;
    background:rgba(120,255,220,0.25);
    color:white;
  }

  .board {
    display:flex;
    flex-wrap:wrap;
    justify-content:center;
    gap:28px;
    padding:var(--space-4);
  }

  .wrap {
    display:inline-block;
  }

  .bubble {
    border-radius:50%;
    padding:16px;
    cursor:pointer;

    display:flex;
    flex-direction:column;
    justify-content:center;
    align-items:center;
    text-align:center;

    background:
      radial-gradient(
        circle at 30% 30%,
        rgba(120,255,220,0.25),
        rgba(0,40,60,0.6)
      );

    backdrop-filter:blur(10px);
    border:1px solid rgba(255,255,255,0.15);

    animation:
      float var(--floatDur) ease-in-out infinite,
      glowPulse var(--pulseDur) ease-in-out infinite;

    animation-delay:var(--delay);

    box-shadow:
      0 0 calc(var(--glow)*1px) rgba(120,255,220,0.15);
  }

  @keyframes float {
    0%{transform:translateY(0)}
    50%{transform:translateY(-14px)}
    100%{transform:translateY(0)}
  }

  @keyframes glowPulse {
    0%{box-shadow:0 0 calc(var(--glow)*1px) rgba(120,255,220,0.12);}
    50%{box-shadow:0 0 calc(var(--glow)*2px) rgba(120,255,220,0.25);}
    100%{box-shadow:0 0 calc(var(--glow)*1px) rgba(120,255,220,0.12);}
  }

  span {
    font-size:0.85rem;
    line-height:1.2;
  }

  small {
    opacity:0.7;
    font-size:0.75rem;
    margin-top:6px;
  }
</style>
