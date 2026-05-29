<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';

  export let data;

  $: csvHref = `/reports/schedule.csv?start=${data.startDate}&end=${data.endDate}`;
</script>

<Layout>
  <PageHeader title="Schedule History" />

  <div class="report-toolbar">
    <a href="/reports">Reports</a>
    <a href={csvHref}>Download CSV</a>
  </div>

  <section class="report-table-wrap">
    {#if data.rows.length}
      <table class="report-table">
        <thead>
          <tr>
            <th>Week</th>
            <th>Version</th>
            <th>Date</th>
            <th>Employee</th>
            <th>Role</th>
            <th>Shift</th>
            <th>Published By</th>
          </tr>
        </thead>
        <tbody>
          {#each data.rows as row}
            <tr>
              <td>{row.week_start}</td>
              <td>{row.version_number}</td>
              <td>{row.shift_date}</td>
              <td>{row.employee_name_snapshot}</td>
              <td>
                <strong>{row.role_name}</strong>
                <span>{row.department}</span>
              </td>
              <td>
                {row.start_time} - {row.end_label || 'Close'}
                {#if row.break_minutes}
                  <span>{row.break_minutes} min break</span>
                {/if}
              </td>
              <td>{row.published_by_name}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else}
      <p class="empty-state">No schedule history yet.</p>
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
    color: var(--color-text);
    font-weight: var(--weight-semibold);
    text-decoration: none;
  }

  .report-table-wrap {
    overflow-x: auto;
  }

  .report-table {
    width: 100%;
    min-width: 820px;
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
    color: var(--color-muted);
    font-size: 0.78rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  td span {
    display: block;
    margin-top: 0.2rem;
    color: var(--color-muted);
    font-size: 0.88rem;
  }

  .empty-state {
    margin: 0;
    padding: 1rem 0;
    color: var(--color-muted);
  }
</style>
