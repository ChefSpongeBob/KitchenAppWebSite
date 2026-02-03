<script>
  import Layout from '$lib/components/ui/Layout.svelte';
  import Section from '$lib/components/ui/Section.svelte';
  import DashboardCard from '$lib/components/ui/DashboardCard.svelte';
</script>

<Layout>
  <Section title="Inventory">

    <a href="/lists/inventory/fohinv" class="card-link">
      <DashboardCard
        title="FOH Inventory"
        description="Front of house supplies and stock"
      />
    </a>

    <a href="/lists/inventory/kitcheninv" class="card-link">
      <DashboardCard
        title="Kitchen Inventory"
        description="Kitchen stock tracking"
      />
    </a>

    <a href="/lists/inventory/sushiinv" class="card-link">
      <DashboardCard
        title="Sushi Inventory"
        description="Sushi bar inventory"
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
