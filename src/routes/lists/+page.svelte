<script>
  import Layout from '$lib/components/ui/Layout.svelte';
  import Section from '$lib/components/ui/Section.svelte';
  import DashboardCard from '$lib/components/ui/DashboardCard.svelte';
  import { fade } from 'svelte/transition';

  const lists = [
    { href: '/lists/preplists', title: 'Prep Lists', description: 'Kitchen and sushi prep checklists' },
    { href: '/lists/orders', title: 'Orders', description: 'Track and manage orders' },
    { href: '/lists/inventory', title: 'Inventory', description: 'Stock and supply tracking' }
  ];
</script>

<Layout>
  <Section title="">
    <div class="grid">
      {#each lists as list, index}
        <a
          href={list.href}
          class="card-link"
          in:fade={{ delay: index * 80, duration: 180 }}
        >
          <DashboardCard
            title={list.title}
            description={list.description}
          />
        </a>
      {/each}
    </div>
  </Section>
</Layout>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: var(--space-4);
    margin-top: var(--space-4);
  }

  .card-link {
    display: block;
    text-decoration: none;
    transition: transform 120ms var(--ease-out), box-shadow 120ms var(--ease-out);
  }

  .card-link:hover,
  .card-link:focus {
    transform: translateY(-2px);
    box-shadow: var(--shadow-sm);
    outline: none;
  }

  .card-link:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 4px;
  }

  /* Current nav link styling */
  .w-nav-link.w--current {
    color: var(--color-text);
  }
</style>
