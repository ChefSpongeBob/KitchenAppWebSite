<script>
  import Layout from '$lib/components/ui/Layout.svelte';
  import Section from '$lib/components/ui/Section.svelte';
  import DashboardCard from '$lib/components/ui/DashboardCard.svelte';
</script>

<Layout>
  <Section title="Prep Lists">

    <a href="/lists/preplists/kitchen" class="card-link">
      <DashboardCard
        title="Kitchen Prep"
        description="Daily kitchen setup and prep tasks"
      />
    </a>

    <a href="/lists/preplists/opener" class="card-link">
      <DashboardCard
        title="Fish Opener"
        description="Fish cutting and opener duties"
      />
    </a>

    <a href="/lists/preplists/sushi" class="card-link">
      <DashboardCard
        title="Veg Sushi Prep"
        description="Vegetarian sushi station prep"
      />
    </a>

    <a href="/lists/preplists/sushiprep" class="card-link">
      <DashboardCard
        title="Sushi Prep"
        description="Full sushi prep checklist"
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
