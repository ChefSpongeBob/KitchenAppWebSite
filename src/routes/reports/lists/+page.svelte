<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';

  export let data;

  const titles = {
    preplists: 'Prep History',
    inventory: 'Inventory History',
    orders: 'Order History'
  };

  $: csvHref = `/reports/lists.csv?domain=${data.domain}&start=${data.startDate}&end=${data.endDate}`;
</script>

<Layout>
  <PageHeader title={titles[data.domain] ?? 'List History'} />

  <div class="report-toolbar">
    <a href="/reports"><span class="material-icons" aria-hidden="true">arrow_back</span>Reports</a>
    <a href="/reports/lists?domain=preplists"><span class="material-icons" aria-hidden="true">restaurant</span>Prep</a>
    <a href="/reports/lists?domain=inventory"><span class="material-icons" aria-hidden="true">inventory_2</span>Inventory</a>
    <a href="/reports/lists?domain=orders"><span class="material-icons" aria-hidden="true">receipt_long</span>Orders</a>
    <a href={csvHref}><span class="material-icons" aria-hidden="true">download</span>CSV</a>
  </div>

  <section class="report-table-wrap">
    {#if data.rows.length}
      <table class="report-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>List</th>
            <th>Item</th>
            <th>Value</th>
            <th>Par</th>
            <th>Done</th>
            <th>By</th>
          </tr>
        </thead>
        <tbody>
          {#each data.rows as row}
            <tr>
              <td>{row.business_day}</td>
              <td>{row.section_title_snapshot}</td>
              <td>
                <strong>{row.item_name_snapshot}</strong>
                {#if row.details_snapshot}
                  <span>{row.details_snapshot}</span>
                {/if}
              </td>
              <td>{row.submitted_value || '-'}</td>
              <td>{row.par_count_snapshot || '-'}</td>
              <td>{row.is_checked_snapshot ? 'Yes' : 'No'}</td>
              <td>{row.submitted_by_name}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else}
      <p class="empty-state">No history yet.</p>
    {/if}
  </section>
</Layout>

<style>
  .report-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem 0.9rem;
    align-items: center;
    padding: 0.7rem 0;
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
  }

  .report-toolbar a {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    border-bottom: 1px solid var(--color-divider);
    color: var(--color-text);
    font-weight: var(--weight-semibold);
    text-decoration: none;
  }

  .report-toolbar .material-icons {
    color: var(--color-text-muted);
    font-size: 1rem;
    line-height: 1;
  }

  .report-table-wrap {
    overflow-x: auto;
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
  }

  .report-table {
    width: 100%;
    min-width: 760px;
    border-collapse: collapse;
  }

  th,
  td {
    padding: 0.75rem 0.55rem;
    border-bottom: 1px solid var(--color-divider);
    text-align: left;
    vertical-align: top;
  }

  th {
    color: var(--color-text-muted);
    font-size: 0.78rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  td span {
    display: block;
    margin-top: 0.2rem;
    color: var(--color-text-muted);
    font-size: 0.88rem;
  }

  .empty-state {
    margin: 0;
    padding: 1rem 0;
    color: var(--color-text-muted);
  }
</style>
