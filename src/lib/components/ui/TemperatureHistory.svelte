<script lang="ts">
  import { onMount } from 'svelte';
  import { TEMPERATURE_HISTORY_SECONDS, TEMPERATURE_ONLINE_WINDOW_SECONDS } from '#lib/temperatureTiming.ts';

  export let sensorId: number;
  export let name: string;
  export let refreshToken = 0;
  export let onClose: () => void;
  type Reading = { ts: number; temperature: number; humidity_pct: number | null };
  let dialog: HTMLDialogElement;
  let mounted = false;
  let controller: AbortController | undefined;
  let readings: Reading[] = [];
  let loading = true;
  let error = '';
  let timeZone = 'UTC';
  let end = Math.floor(Date.now() / 1000);
  let start = end - TEMPERATURE_HISTORY_SECONDS;

  async function loadHistory() {
    controller?.abort();
    const current = new AbortController();
    controller = current;
    loading = true;
    error = '';
    try {
      const response = await fetch(`/api/temps?view=history&sensor=${sensorId}`, { signal: current.signal, cache: 'no-store' });
      if (!response.ok) throw new Error('History could not load.');
      const data = await response.json();
      if (current.signal.aborted) return;
      readings = [...data.readings].sort((a: Reading,b: Reading) => a.ts - b.ts);
      start = data.start; end = data.end; timeZone = data.timeZone;
    } catch {
      if (!current.signal.aborted) error = 'History could not load. Please retry.';
    } finally {
      if (!current.signal.aborted) loading = false;
    }
  }

  onMount(() => {
    dialog.showModal();
    mounted = true;
    return () => { mounted = false; controller?.abort(); };
  });
  $: if (mounted) { refreshToken; void loadHistory(); }
  $: minimum = readings.length ? Math.min(...readings.map(row => row.temperature)) : 0;
  $: maximum = readings.length ? Math.max(...readings.map(row => row.temperature)) : 0;
  $: average = readings.length ? readings.reduce((sum,row) => sum + row.temperature,0) / readings.length : 0;
  $: floor = minimum - Math.max(1, (maximum - minimum) * 0.1);
  $: ceiling = maximum + Math.max(1, (maximum - minimum) * 0.1);
  $: points = readings.map(row => ({ ...row, x: 18 + Math.max(0, Math.min(1, (row.ts - start) / (end - start))) * 564,
    y: 140 - (row.temperature - floor) / (ceiling - floor) * 120 }));
  $: path = points.map((point,index) => `${index && point.ts - points[index - 1].ts <= TEMPERATURE_ONLINE_WINDOW_SECONDS ? 'L' : 'M'}${point.x} ${point.y}`).join(' ');

  function time(seconds: number) {
    return new Date(seconds * 1000).toLocaleTimeString([], { timeZone, hour: 'numeric', minute: '2-digit' });
  }
</script>

<dialog bind:this={dialog} on:close={onClose} aria-labelledby="temperature-history-title">
  <header>
    <div><h2 id="temperature-history-title">{name}</h2><p>Last 8 hours | 20-minute readings</p></div>
    <form method="dialog"><button type="submit">Close</button></form>
  </header>
  {#if loading && !readings.length}
    <p role="status">Loading history...</p>
  {:else if error}
    <p role="alert">{error}</p><button type="button" on:click={loadHistory}>Retry</button>
  {:else if !readings.length}
    <p>No readings in the last 8 hours.</p>
  {:else}
    <div class="summary" aria-label="Temperature summary">
      <span>Low <strong>{minimum.toFixed(1)}F</strong></span>
      <span>Average <strong>{average.toFixed(1)}F</strong></span>
      <span>High <strong>{maximum.toFixed(1)}F</strong></span>
    </div>
    <svg viewBox="0 0 600 160" role="img" aria-label={`${name}: ${readings.length} temperature readings over the last 8 hours`}>
      <path d={path} fill="none" stroke="currentColor" stroke-width="2" />
      {#each points as point}
        <circle cx={point.x} cy={point.y} r="3"><title>{time(point.ts)}: {point.temperature.toFixed(1)}F</title></circle>
      {/each}
    </svg>
    <div class="axis"><span>{time(start)}</span><span>{time(end)}</span></div>
    <div class="readout">
      <table>
        <caption>{timeZone}</caption>
        <thead><tr><th scope="col">Time</th><th scope="col">Temperature</th><th scope="col">Humidity</th></tr></thead>
        <tbody>
          {#each [...readings].reverse() as reading}
            <tr><td>{time(reading.ts)}</td><td>{reading.temperature.toFixed(1)}F</td><td>{reading.humidity_pct === null ? '--' : `${reading.humidity_pct.toFixed(0)}%`}</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</dialog>

<style>
  dialog { width: min(40rem, calc(100vw - 2rem)); max-height: 85dvh; padding: 1.25rem; border: 1px solid var(--color-divider); border-radius: 0; background: var(--color-bg); color: var(--color-text); }
  dialog::backdrop { background: rgb(0 0 0 / 40%); }
  header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; padding-bottom: 0.85rem; border-bottom: 1px solid var(--color-divider); }
  h2 { margin: 0; font-size: 1.15rem; }
  p { color: var(--color-text-muted); font-size: 0.82rem; }
  header p { margin: 0.3rem 0 0; }
  button { padding: 0.15rem 0; border: 0; border-bottom: 1px solid var(--color-divider); border-radius: 0; background: transparent; color: var(--color-text); font: inherit; cursor: pointer; }
  .summary { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 0.7rem; padding: 1rem 0 0; font-size: 0.76rem; color: var(--color-text-muted); }
  strong { display: block; margin-top: 0.15rem; font-size: 1rem; color: var(--color-text); }
  svg { display: block; width: 100%; color: var(--color-text); margin-top: 0.75rem; }
  circle { fill: currentColor; }
  .axis { display: flex; justify-content: space-between; font-size: 0.7rem; color: var(--color-text-muted); padding-bottom: 0.75rem; }
  .readout { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
  caption { text-align: left; color: var(--color-text-muted); font-size: 0.7rem; padding: 0.5rem 0; }
  th, td { padding: 0.5rem 0.25rem; text-align: left; border-bottom: 1px solid var(--color-divider); font-variant-numeric: tabular-nums; }
  th { color: var(--color-text-muted); font-weight: var(--weight-semibold); }
</style>
