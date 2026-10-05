<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
</script>

<svelte:head>
  <title>About Crimini</title>
  <meta name="description" content="Crimini brings restaurant scheduling, employee workflows, kitchen execution, documents, reporting, and connected temperature monitoring into one workspace." />
</svelte:head>

<Layout>
  <section class="about-hero" data-reveal>
    <p class="eyebrow">Crimini by NNS, LLC</p>
    <h1>Restaurant operations, kept in one clear system.</h1>
    <p class="lead">
      Crimini connects scheduling, employee workflows, kitchen execution, documents, reporting, and optional temperature monitoring without separating the team across disconnected tools.
    </p>
  </section>

  <section class="about-principles" aria-label="Crimini principles">
    <article data-reveal>
      <span>01</span>
      <h2>Built Around Service</h2>
      <p>Daily tools stay quick to reach for employees while management controls remain organized and permission-aware.</p>
    </article>
    <article data-reveal>
      <span>02</span>
      <h2>One Business, One Workspace</h2>
      <p>Each restaurant operates in a tenant-scoped workspace with role and permission controls for its people, schedules, records, reports, and registered devices.</p>
    </article>
    <article data-reveal>
      <span>03</span>
      <h2>Made To Grow</h2>
      <p>Start with the operation in front of you, then add teams, workflows, and connected monitoring as needed.</p>
    </article>
  </section>

  <section class="about-close" data-reveal>
    <div>
      <p class="eyebrow">The Platform</p>
      <h2>From setup to service.</h2>
    </div>
    <nav aria-label="About page links">
      <a href="/features">Explore Features</a>
      <a href="/how-it-works">How It Works</a>
      <a href="/pricing">View Plans</a>
    </nav>
  </section>
</Layout>

<style>
  .about-hero {
    min-height: min(62vh, 560px);
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    padding: clamp(3.5rem, 10vw, 7rem) 0 clamp(2rem, 5vw, 3.5rem);
    border-bottom: 1px solid rgba(17, 18, 20, 0.14);
    position: relative;
  }

  .about-hero::after {
    content: '';
    position: absolute;
    width: min(23rem, 48vw);
    aspect-ratio: 1;
    right: -8%;
    top: 4%;
    background: url('/crimini-mushrooms-only.svg') center / contain no-repeat;
    opacity: 0.035;
    pointer-events: none;
  }

  .eyebrow {
    margin: 0;
    color: rgba(17, 18, 20, 0.56);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  h1,
  h2 {
    font-family: Georgia, 'Times New Roman', serif;
    font-weight: 400;
    color: #111214;
  }

  h1 {
    max-width: 12ch;
    margin: 0.55rem 0 0;
    font-size: clamp(2.7rem, 8vw, 6.2rem);
    letter-spacing: -0.065em;
    line-height: 0.93;
  }

  .lead {
    max-width: 62ch;
    margin: 1.2rem 0 0;
    color: rgba(17, 18, 20, 0.66);
    font-size: clamp(0.96rem, 2vw, 1.1rem);
    line-height: 1.65;
  }

  .about-principles {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .about-principles article {
    padding: clamp(1.25rem, 3vw, 2rem) clamp(0.6rem, 2vw, 1.2rem);
    border-bottom: 1px solid rgba(17, 18, 20, 0.12);
  }

  .about-principles article + article {
    border-left: 1px solid rgba(17, 18, 20, 0.12);
  }

  .about-principles span {
    color: rgba(17, 18, 20, 0.46);
    font-size: 0.68rem;
    letter-spacing: 0.12em;
  }

  .about-principles h2 {
    margin: 1.4rem 0 0;
    font-size: clamp(1.15rem, 2.5vw, 1.55rem);
  }

  .about-principles p {
    margin: 0.55rem 0 0;
    color: rgba(17, 18, 20, 0.64);
    font-size: 0.84rem;
    line-height: 1.55;
  }

  .about-close {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 1.5rem;
    padding: clamp(2rem, 6vw, 4rem) 0;
  }

  .about-close h2 {
    margin: 0.4rem 0 0;
    font-size: clamp(1.8rem, 4vw, 3.2rem);
    letter-spacing: -0.045em;
  }

  .about-close nav {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.75rem 1.1rem;
  }

  .about-close a {
    color: #111214;
    border-bottom: 1px solid rgba(17, 18, 20, 0.34);
    padding-bottom: 0.16rem;
    text-decoration: none;
    font-size: 0.82rem;
    font-weight: 700;
  }

  .about-close a:hover,
  .about-close a:focus-visible {
    border-bottom-color: #111214;
  }

  @media (max-width: 760px) {
    .about-hero {
      min-height: 48vh;
    }

    .about-principles {
      grid-template-columns: 1fr;
    }

    .about-principles article {
      padding-inline: 0;
    }

    .about-principles article + article {
      border-left: 0;
    }

    .about-close {
      align-items: flex-start;
      flex-direction: column;
    }

    .about-close nav {
      justify-content: flex-start;
    }
  }
</style>
