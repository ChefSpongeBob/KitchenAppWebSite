<script>
  import Layout from '$lib/components/ui/Layout.svelte';
  import Section from '$lib/components/ui/Section.svelte';
  import DashboardCard from '$lib/components/ui/DashboardCard.svelte';
</script>

<Layout>
  <Section title="Orders">

    <a href="/lists/orders/sysco_link" class="card-link">
      <DashboardCard
        title="Sysco"
        description="Open Sysco ordering"
      />
    </a>

    <a href="/lists/orders/sfotw" class="card-link">
      <DashboardCard
        title="SFOTW"
        description="Specials / order of the week"
      />
    </a>

    <a href="/lists/orders/order1" class="card-link">
      <DashboardCard
        title="Order Sheet 1"
        description="Primary order list"
      />
    </a>

    <a href="/lists/orders/order2" class="card-link">
      <DashboardCard
        title="Order Sheet 2"
        description="Secondary order list"
      />
    </a>

    <a href="/lists/orders/order3" class="card-link">
      <DashboardCard
        title="Order Sheet 3"
        description="Additional ordering"
      />
    </a>

  </Section>
</Layout>

<style>
  .card-link {
    display: block;
    text-decoration: none;
  }
</style>
