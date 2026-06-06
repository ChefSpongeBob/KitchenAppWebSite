<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';

  export let data;

  $: csvHref = `/reports/temperature.csv?start=${data.startDate}&end=${data.endDate}`;
</script>

<Layout>
  <PageHeader title="Temperature Report" />

  <div class="report-toolbar">
    <a href="/reports"><span class="material-icons" aria-hidden="true">arrow_back</span>Reports</a>
    <a href={csvHref}><span class="material-icons" aria-hidden="true">download</span>CSV</a>
  </div>

  <section class="report-table-wrap">
    {#if data.rows.length}
      <table class="report-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Sensor</th>
            <th>Temp</th>
            <th>Status</th>
            <th>Threshold</th>
            <th>Ack</th>
          </tr>
        </thead>
        <tbody>
          {#each data.rows as row}
            <tr>
              <td>{row.event_date}</td>
              <td>{row.row_type}</td>
              <td>
                <strong>{row.sensor_name}</strong>
                <span>Node {row.sensor_id}</span>
              </td>
              <td>{row.temperature === null ? '-' : `${Number(row.temperature).toFixed(1)}F`}</td>
              <td>{row.event_type || row.status || '-'}</td>
              <td>{row.threshold === null ? '-' : `${Number(row.threshold).toFixed(1)}F`}</td>
              <td>{row.acknowledged_by_name || '-'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else}
      <p class="empty-state">No temperature records yet.</p>
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
