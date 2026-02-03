<script>
  import Layout from '$lib/components/ui/Layout.svelte';
  import Section from '$lib/components/ui/Section.svelte';
  import DashboardCard from '$lib/components/ui/DashboardCard.svelte';
</script>

<Layout>
  <Section title="Lists">

    <a href="/lists/preplists" class="card-link">
      <DashboardCard
        title="Prep Lists"
        description="Kitchen and sushi prep checklists"
      />
    </a>

    <a href="/lists/orders" class="card-link">
      <DashboardCard
        title="Orders"
        description="Track and manage orders"
      />
    </a>

    <a href="/lists/inventory" class="card-link">
      <DashboardCard
        title="Inventory"
        description="Stock and supply tracking"
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
