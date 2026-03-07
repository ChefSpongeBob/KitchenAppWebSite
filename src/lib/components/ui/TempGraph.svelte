<script lang="ts">
  export let series: Record<string | number, number[]> = {};
  export let height = 40;

  const W = 100;
  const P = 4;

  function buildPath(vals: number[]) {
    if (!vals || vals.length < 2) return '';

    vals = vals.map(Number).filter((v) => !isNaN(v));
    if (vals.length < 2) return '';

    let min = Math.min(...vals);
    let max = Math.max(...vals);

    if (max === min) {
      max += 0.5;
      min -= 0.5;
    }

    const range = max - min;

    return vals
      .map((v, i) => {
        const x = P + (i / (vals.length - 1)) * (W - P * 2);
        const y = height - P - ((v - min) / range) * (height - P * 2);
        return `${i ? 'L' : 'M'}${x} ${y}`;
      })
      .join(' ');
  }
</script>

<svg width="100%" {height} viewBox={`0 0 100 ${height}`}>
  {#each Object.values(series) as vals}
    <path
      d={buildPath(vals)}
      fill="none"
      stroke="cyan"
      stroke-width="2"
      stroke-linecap="round"
    />
  {/each}
</svg>
