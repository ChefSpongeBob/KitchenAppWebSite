<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';

  type PreplistItem = {
    id: string;
    content: string;
    amount: number;
    par_count: number;
    is_checked: number;
  };

  type OcrMatch = {
    id: string;
    content: string;
    amount: string;
    score: number;
  };

  type OcrWord = {
    text: string;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    cy: number;
    height: number;
  };

  type OcrRow = {
    words: OcrWord[];
    top: number;
    bottom: number;
    left: number;
    right: number;
    midY: number;
  };

  export let title = 'Prep List';
  export let subtitle = 'Submit prep counts together. Admins can adjust par levels in admin tools.';
  export let items: PreplistItem[] = [];
  export let isAdmin = false;
  export let valueLabel = 'Prep';
  export let submitLabel = 'Submit Prep Counts';
  export let resetLabel = 'New Prep List (Reset to 0)';
  export let adminSummaryLabel = '+ Admin Par Levels';
  export let enablePictureSubmit = false;
  export let pictureParseMode: 'generic' | 'ordered-single-column' = 'generic';

  const isDone = (item: PreplistItem) => Number(item.is_checked) === 1;

  let amountDrafts: Record<string, string> = {};
  let syncedDraftKey = '';
  let fileInput: HTMLInputElement | null = null;
  let ocrStatus = '';
  let ocrError = '';
  let ocrBusy = false;
  let ocrMatches: Array<{ content: string; amount: string }> = [];

  $: {
    const nextKey = items.map((item) => `${item.id}:${item.amount}`).join('|');
    if (nextKey !== syncedDraftKey) {
      amountDrafts = Object.fromEntries(items.map((item) => [item.id, String(item.amount ?? 0)]));
      syncedDraftKey = nextKey;
    }
  }

  function normalizeText(value: string) {
    return value
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9.\s/()-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function levenshteinDistance(left: string, right: string) {
    if (left === right) return 0;
    if (!left.length) return right.length;
    if (!right.length) return left.length;

    const costs = Array.from({ length: right.length + 1 }, (_, index) => index);

    for (let i = 1; i <= left.length; i++) {
      let previous = i - 1;
      costs[0] = i;

      for (let j = 1; j <= right.length; j++) {
        const current = costs[j];
        const substitution = left[i - 1] === right[j - 1] ? previous : previous + 1;
        costs[j] = Math.min(costs[j] + 1, costs[j - 1] + 1, substitution);
        previous = current;
      }
    }

    return costs[right.length];
  }

  function tokensRoughlyMatch(left: string, right: string) {
    if (left === right) return true;
    if (!left || !right) return false;
    if (left.length >= 4 && (left.includes(right) || right.includes(left))) return true;

    const distance = levenshteinDistance(left, right);
    return distance <= (Math.max(left.length, right.length) >= 7 ? 2 : 1);
  }

  function scoreLineAgainstItem(lineText: string, itemText: string) {
    if (!lineText || !itemText) return 0;

    let score = 0;
    const lineTokens = lineText.split(' ').filter(Boolean);
    const itemTokens = itemText.split(' ').filter(Boolean);

    if (lineText.includes(itemText)) score += 10;
    if (itemText.includes(lineText)) score += 5;

    for (const token of itemTokens) {
      const matchingToken = lineTokens.find((lineToken) => tokensRoughlyMatch(lineToken, token));
      if (!matchingToken) continue;
      score += matchingToken === token ? (token.length <= 2 ? 1 : 3) : 2;
    }

    const lineJoined = lineTokens.join(' ');
    const distance = levenshteinDistance(lineJoined, itemText);
    score += Math.max(0, 8 - distance);

    return score;
  }

  function extractLineAmount(line: string) {
    const dashMatch = line.match(/[-–—_=~]{1,}$/);
    if (dashMatch && dashMatch.index != null) {
      return {
        amount: '0',
        text: normalizeText(line.slice(0, dashMatch.index))
      };
    }

    const mixedFractionMatches = [...line.matchAll(/(^|[^\d])(\d+)\s+1\/2(?=$|[^\d])/g)];
    const mixedFraction = mixedFractionMatches.at(-1);
    if (mixedFraction && mixedFraction.index != null) {
      const amount = String(Number(mixedFraction[2]) + 0.5);
      const amountStart = mixedFraction.index + mixedFraction[1].length;
      const amountEnd = amountStart + `${mixedFraction[2]} 1/2`.length;

      return {
        amount,
        text: normalizeText(`${line.slice(0, amountStart)} ${line.slice(amountEnd)}`)
      };
    }

    const amountMatches = [...line.matchAll(/(^|[^\d])(\d+(?:\.\d+)?)(?=$|[^\d])/g)];
    const last = amountMatches.at(-1);
    if (!last || last.index == null) return null;

    const amount = last[2];
    const amountStart = last.index + last[1].length;
    const amountEnd = amountStart + amount.length;

    return {
      amount,
      text: normalizeText(`${line.slice(0, amountStart)} ${line.slice(amountEnd)}`)
    };
  }

  function buildTextMatches(rawText: string) {
    const availableItems = items.map((item) => ({
      id: item.id,
      content: item.content,
      normalized: normalizeText(item.content)
    }));

    const applied = new Set<string>();
    const matches: OcrMatch[] = [];
    const lines = rawText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    for (const line of lines) {
      const parsed = extractLineAmount(line);
      if (!parsed || !parsed.text) continue;

      let bestMatch:
        | {
            id: string;
            content: string;
            normalized: string;
            score: number;
          }
        | null = null;

      for (const item of availableItems) {
        if (applied.has(item.id)) continue;
        const score = scoreLineAgainstItem(parsed.text, item.normalized);
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { ...item, score };
        }
      }

      if (!bestMatch) continue;

      const itemTokens = bestMatch.normalized.split(' ').filter(Boolean).length;
      const threshold = Math.max(3, itemTokens * 2);
      if (bestMatch.score < threshold) continue;

      applied.add(bestMatch.id);
      matches.push({
        id: bestMatch.id,
        content: bestMatch.content,
        amount: parsed.amount,
        score: bestMatch.score
      });
    }

    return {
      matches,
      score: matches.reduce((total, match) => total + match.score, 0)
    };
  }

  function getDarknessRatios(canvas: HTMLCanvasElement, xStartRatio = 0.04, xEndRatio = 0.96) {
    const context = canvas.getContext('2d');
    if (!context) return [] as number[];

    const { width, height } = canvas;
    const xStart = Math.max(0, Math.floor(width * xStartRatio));
    const xEnd = Math.min(width, Math.ceil(width * xEndRatio));
    const rowWidth = Math.max(1, xEnd - xStart);
    const imageData = context.getImageData(xStart, 0, rowWidth, height).data;
    const ratios: number[] = [];

    for (let y = 0; y < height; y++) {
      let darkPixels = 0;
      for (let x = 0; x < rowWidth; x++) {
        const offset = (y * rowWidth + x) * 4;
        const brightness = (imageData[offset] + imageData[offset + 1] + imageData[offset + 2]) / 3;
        if (brightness < 155) darkPixels += 1;
      }
      ratios.push(darkPixels / rowWidth);
    }

    return ratios;
  }

  function detectHorizontalLines(canvas: HTMLCanvasElement) {
    const ratios = getDarknessRatios(canvas);
    const lines: number[] = [];
    let start = -1;

    for (let y = 0; y < ratios.length; y++) {
      if (ratios[y] >= 0.24) {
        if (start === -1) start = y;
      } else if (start !== -1) {
        lines.push(Math.round((start + y - 1) / 2));
        start = -1;
      }
    }

    if (start !== -1) {
      lines.push(Math.round((start + ratios.length - 1) / 2));
    }

    return lines;
  }

  function getSegmentDarkness(canvas: HTMLCanvasElement, top: number, bottom: number) {
    const context = canvas.getContext('2d');
    if (!context) return 0;

    const height = Math.max(1, bottom - top);
    const width = canvas.width;
    const imageData = context.getImageData(0, top, width, height).data;
    let darkPixels = 0;
    const pixelCount = width * height;

    for (let index = 0; index < pixelCount; index++) {
      const offset = index * 4;
      const brightness = (imageData[offset] + imageData[offset + 1] + imageData[offset + 2]) / 3;
      if (brightness < 155) darkPixels += 1;
    }

    return darkPixels / Math.max(1, pixelCount);
  }

  function cropCanvas(
    source: HTMLCanvasElement,
    {
      x,
      y,
      width,
      height,
      scale = 2.4
    }: { x: number; y: number; width: number; height: number; scale?: number }
  ) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));

    const context = canvas.getContext('2d');
    if (!context) return canvas;

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = false;
    context.filter = 'grayscale(1) contrast(1.45) brightness(1.08)';
    context.drawImage(source, x, y, width, height, 0, 0, canvas.width, canvas.height);

    return canvas;
  }

  async function readCropText(
    Tesseract: typeof import('tesseract.js'),
    canvas: HTMLCanvasElement,
    psm: number
  ) {
    const blob = await canvasToBlob(canvas);
    const result = await Tesseract.recognize(blob ?? canvas, 'eng', {
      tessedit_pageseg_mode: String(psm)
    } as Record<string, string>);
    return (result.data.text ?? '').trim();
  }

  async function buildOrderedSingleColumnMatchesFromCanvas(
    Tesseract: typeof import('tesseract.js'),
    canvas: HTMLCanvasElement
  ) {
    const horizontalLines = detectHorizontalLines(canvas);
    if (horizontalLines.length < 4) {
      return { matches: [] as OcrMatch[], score: 0 };
    }

    const rowBands: Array<{ top: number; bottom: number }> = [];
    for (let index = 0; index < horizontalLines.length - 1; index++) {
      const top = horizontalLines[index];
      const bottom = horizontalLines[index + 1];
      const height = bottom - top;
      if (height < 24 || height > 140) continue;

      const darkness = getSegmentDarkness(canvas, top, bottom);
      if (darkness > 0.42) break;

      rowBands.push({ top, bottom });
    }

    if (rowBands.length === 0) {
      return { matches: [] as OcrMatch[], score: 0 };
    }

    const titleX = Math.floor(canvas.width * 0.06);
    const titleWidth = Math.floor(canvas.width * 0.44);
    const countX = Math.floor(canvas.width * 0.78);
    const countWidth = Math.floor(canvas.width * 0.17);

    const scoredBands: Array<{
      band: { top: number; bottom: number };
      text: string;
      bestScore: number;
      itemIndex: number;
    }> = [];

    for (const band of rowBands) {
      const height = Math.max(1, band.bottom - band.top - 4);
      const titleCrop = cropCanvas(canvas, {
        x: titleX,
        y: band.top + 2,
        width: titleWidth,
        height,
        scale: 2.6
      });
      const titleText = normalizeText(await readCropText(Tesseract, titleCrop, 7));

      let bestScore = 0;
      let itemIndex = -1;

      for (let index = 0; index < items.length; index++) {
        const score = scoreLineAgainstItem(titleText, normalizeText(items[index].content));
        if (score > bestScore) {
          bestScore = score;
          itemIndex = index;
        }
      }

      scoredBands.push({ band, text: titleText, bestScore, itemIndex });
    }

    const firstMatch = scoredBands.find(
      (entry) =>
        entry.itemIndex === 0 &&
        entry.bestScore >= Math.max(3, normalizeText(items[0]?.content ?? '').split(' ').length * 2)
    );

    const startIndex = firstMatch ? scoredBands.indexOf(firstMatch) : 0;
    const matches: OcrMatch[] = [];

    for (let index = 0; index < items.length && startIndex + index < scoredBands.length; index++) {
      const band = scoredBands[startIndex + index].band;
      const height = Math.max(1, band.bottom - band.top - 4);
      const countCrop = cropCanvas(canvas, {
        x: countX,
        y: band.top + 2,
        width: countWidth,
        height,
        scale: 3.1
      });
      const amount = parseCountFromRowText(await readCropText(Tesseract, countCrop, 7));
      if (amount === null) continue;

      matches.push({
        id: items[index].id,
        content: items[index].content,
        amount,
        score: 10
      });
    }

    return {
      matches,
      score: matches.length * 10
    };
  }

  function buildOcrWords(
    rawWords: Array<{ text?: string; bbox?: { x0?: number; y0?: number; x1?: number; y1?: number } }>
  ) {
    return rawWords
      .map((word) => {
        const text = `${word.text ?? ''}`.trim();
        const x0 = Number(word.bbox?.x0 ?? 0);
        const y0 = Number(word.bbox?.y0 ?? 0);
        const x1 = Number(word.bbox?.x1 ?? 0);
        const y1 = Number(word.bbox?.y1 ?? 0);

        return {
          text,
          x0,
          y0,
          x1,
          y1,
          cy: (y0 + y1) / 2,
          height: Math.max(1, y1 - y0)
        } satisfies OcrWord;
      })
      .filter((word) => word.text.length > 0 && word.x1 > word.x0 && word.y1 > word.y0);
  }

  function median(values: number[]) {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
  }

  function buildRowsFromWords(words: OcrWord[]) {
    if (words.length === 0) return [] as OcrRow[];

    const tolerance = Math.max(14, median(words.map((word) => word.height)) * 0.9);
    const sortedWords = [...words].sort((a, b) => (a.cy === b.cy ? a.x0 - b.x0 : a.cy - b.cy));
    const rows: OcrRow[] = [];
    let currentRow: OcrRow | null = null;

    for (const word of sortedWords) {
      if (!currentRow || Math.abs(word.cy - currentRow.midY) > tolerance) {
        currentRow = {
          words: [word],
          top: word.y0,
          bottom: word.y1,
          left: word.x0,
          right: word.x1,
          midY: word.cy
        };
        rows.push(currentRow);
        continue;
      }

      currentRow.words.push(word);
      currentRow.top = Math.min(currentRow.top, word.y0);
      currentRow.bottom = Math.max(currentRow.bottom, word.y1);
      currentRow.left = Math.min(currentRow.left, word.x0);
      currentRow.right = Math.max(currentRow.right, word.x1);
      currentRow.midY =
        currentRow.words.reduce((sum, rowWord) => sum + rowWord.cy, 0) / currentRow.words.length;
    }

    for (const row of rows) {
      row.words.sort((a, b) => a.x0 - b.x0);
    }

    return rows.sort((a, b) => a.top - b.top);
  }

  function parseCountFromRowText(text: string) {
    const normalized = text.trim();
    if (!normalized) return null;
    if (/^[-–—_=~]+$/.test(normalized)) return '0';

    const mixedFraction = normalized.match(/(\d+)\s*1\/2/);
    if (mixedFraction) return String(Number(mixedFraction[1]) + 0.5);

    const digits = [...normalized.matchAll(/\d+(?:\.\d+)?/g)];
    const last = digits.at(-1);
    return last?.[0] ?? null;
  }

  function buildOrderedSingleColumnMatches(
    rawWords: Array<{ text?: string; bbox?: { x0?: number; y0?: number; x1?: number; y1?: number } }>
  ) {
    const words = buildOcrWords(rawWords);
    const rows = buildRowsFromWords(words);

    if (rows.length === 0) {
      return { matches: [] as OcrMatch[], score: 0 };
    }

    const pageLeft = Math.min(...words.map((word) => word.x0));
    const pageRight = Math.max(...words.map((word) => word.x1));
    const countBoundary = pageLeft + (pageRight - pageLeft) * 0.73;
    const rowHeights = rows.map((row) => row.bottom - row.top);
    const typicalHeight = median(rowHeights) || 24;
    const candidateRows = rows.filter((row) => row.words.some((word) => word.x0 <= countBoundary));
    const contiguousRows: OcrRow[] = [];

    for (let index = 0; index < candidateRows.length; index++) {
      const row = candidateRows[index];
      if (index > 0) {
        const previous = candidateRows[index - 1];
        const gap = row.top - previous.bottom;
        if (gap > typicalHeight * 1.8) break;
      }

      contiguousRows.push(row);
    }

    const matches: OcrMatch[] = [];

    for (let index = 0; index < Math.min(contiguousRows.length, items.length); index++) {
      const row = contiguousRows[index];
      const countWords = row.words.filter((word) => word.x0 >= countBoundary);
      const countText = countWords.map((word) => word.text).join(' ');
      const amount = parseCountFromRowText(countText);
      if (amount === null) continue;

      matches.push({
        id: items[index].id,
        content: items[index].content,
        amount,
        score: 10
      });
    }

    return {
      matches,
      score: matches.length * 10
    };
  }

  async function preprocessImage(file: File): Promise<HTMLCanvasElement> {
    const bitmap = await createImageBitmap(file);
    const longestEdge = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(2.2, 2200 / longestEdge);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));

    const context = canvas.getContext('2d');
    if (!context) return canvas;

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.filter = 'grayscale(1) contrast(1.35) brightness(1.08)';
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    bitmap.close();
    return canvas;
  }

  function rotateCanvas(source: HTMLCanvasElement, degrees: 0 | 90 | -90) {
    if (degrees === 0) return source;

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return source;

    canvas.width = source.height;
    canvas.height = source.width;

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    if (degrees === 90) {
      context.translate(canvas.width, 0);
      context.rotate(Math.PI / 2);
    } else {
      context.translate(0, canvas.height);
      context.rotate(-Math.PI / 2);
    }

    context.drawImage(source, 0, 0);
    return canvas;
  }

  async function canvasToBlob(canvas: HTMLCanvasElement) {
    return (
      (await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/png', 1);
      })) ?? null
    );
  }

  function updateAmount(id: string, value: string) {
    amountDrafts = {
      ...amountDrafts,
      [id]: value
    };
  }

  async function handlePictureChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    ocrBusy = true;
    ocrError = '';
    ocrStatus = 'Reading list image...';
    ocrMatches = [];

    try {
      const Tesseract = await import('tesseract.js');
      const processedCanvas = await preprocessImage(file);
      const variants = [
        { label: 'original', canvas: rotateCanvas(processedCanvas, 0) },
        { label: 'clockwise', canvas: rotateCanvas(processedCanvas, 90) },
        { label: 'counterclockwise', canvas: rotateCanvas(processedCanvas, -90) }
      ];

      let bestResult: { matches: OcrMatch[]; score: number } | null = null;

      for (const variant of variants) {
        ocrStatus = `Reading list image (${variant.label})...`;
        const parsed = await (
          pictureParseMode === 'ordered-single-column'
            ? await buildOrderedSingleColumnMatchesFromCanvas(Tesseract, variant.canvas)
            : (() => {
                return (async () => {
                  const blob = await canvasToBlob(variant.canvas);
                  const result = await Tesseract.recognize(blob ?? file, 'eng');
                  return buildTextMatches(result.data.text ?? '');
                })();
              })()
        );

        if (
          !bestResult ||
          parsed.matches.length > bestResult.matches.length ||
          (parsed.matches.length === bestResult.matches.length && parsed.score > bestResult.score)
        ) {
          bestResult = parsed;
        }
      }

      const matches = bestResult?.matches ?? [];
      if (matches.length === 0) {
        ocrStatus = 'No clear prep counts were matched. Try a straighter, brighter photo.';
        return;
      }

      const nextDrafts = { ...amountDrafts };
      for (const match of matches) {
        nextDrafts[match.id] = match.amount;
      }

      amountDrafts = nextDrafts;
      ocrMatches = matches.map(({ content, amount }) => ({ content, amount }));
      ocrStatus = `Filled ${matches.length} prep ${matches.length === 1 ? 'slot' : 'slots'}. Review and submit when ready.`;
    } catch (error) {
      console.error(error);
      ocrError =
        error instanceof Error && error.message
          ? error.message
          : 'Picture parsing failed. Please try another photo.';
      ocrStatus = '';
      ocrMatches = [];
    } finally {
      ocrBusy = false;
      input.value = '';
    }
  }
</script>

<Layout>
  <PageHeader {title} {subtitle} />

  {#if items.length === 0}
    <p class="empty">No prep items found yet.</p>
  {:else}
    <section class="sheet">
      <div class="sheet-header">
        <span>Done</span>
        <span>Item</span>
        <span>Prep</span>
        <span>Par</span>
      </div>

      <form id="prep-batch-form" method="POST" action="?/submit_prep_counts" class="batch-form">
        {#each items as item}
          <div class="sheet-row" class:done={isDone(item)}>
            <button
              type="submit"
              class="check-btn"
              aria-label={`Toggle ${item.content} complete`}
              form="prep-batch-form"
              formaction="?/toggle_checked"
              formmethod="POST"
              formnovalidate
              name="id"
              value={item.id}
            >
              {#if isDone(item)}X{:else}O{/if}
            </button>
            <input type="hidden" name={`is_checked_${item.id}`} value={isDone(item) ? 0 : 1} />

            <div class="item-cell">{item.content}</div>

            <div class="number-form">
              <span class="field-tag">{valueLabel.toUpperCase()}:</span>
              <input
                id={`amount-${item.id}`}
                name={`amount_${item.id}`}
                type="number"
                min="0"
                step="0.1"
                value={amountDrafts[item.id] ?? String(item.amount)}
                on:input={(event) => updateAmount(item.id, (event.currentTarget as HTMLInputElement).value)}
                required
                class="number-input"
              />
            </div>

            <div class="par-readonly">
              <span class="field-tag">PAR:</span>
              <span>{item.par_count}</span>
            </div>
          </div>
        {/each}
        <div class="actions-row">
          {#if enablePictureSubmit}
            <input
              bind:this={fileInput}
              type="file"
              accept="image/*"
              capture="environment"
              class="sr-only"
              on:change={handlePictureChange}
            />
            <button
              type="button"
              class="submit-btn subtle-btn"
              on:click={() => fileInput?.click()}
              disabled={ocrBusy}
            >
              {#if ocrBusy}Reading Picture...{:else}Submit Picture Of List{/if}
            </button>
          {/if}
          <button type="submit" class="submit-btn">{submitLabel}</button>
        </div>
        {#if enablePictureSubmit && (ocrStatus || ocrError)}
          <p class:ocr-status={!!ocrStatus} class:ocr-error={!!ocrError} aria-live="polite">
            {ocrError || ocrStatus}
          </p>
        {/if}
        {#if enablePictureSubmit && ocrMatches.length > 0}
          <div class="ocr-match-list">
            {#each ocrMatches as match}
              <span class="ocr-match-chip">{match.content}: {match.amount}</span>
            {/each}
          </div>
        {/if}
      </form>

      <div class="actions-row reset-row">
        <form method="POST" action="?/new_prep_list">
          <button type="submit" class="submit-btn subtle-btn">{resetLabel}</button>
        </form>
      </div>

      {#if isAdmin}
        <details class="admin-par">
          <summary>{adminSummaryLabel}</summary>
          <form method="POST" action="?/save_par_levels" class="admin-par-form">
            {#each items as item}
              <label class="par-edit-row" for={`par-${item.id}`}>
                <span>{item.content}</span>
                <div class="number-form">
                  <span class="field-tag">PAR:</span>
                  <input
                    id={`par-${item.id}`}
                    name={`par_${item.id}`}
                    type="number"
                    min="0"
                    step="0.1"
                    value={item.par_count}
                    required
                    class="number-input"
                  />
                </div>
              </label>
            {/each}
            <button type="submit" class="mini-btn subtle">Save Par Levels</button>
          </form>
        </details>
      {/if}
    </section>
  {/if}
</Layout>

<style>
  .sheet {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.25rem 0 0.15rem;
  }

  .sheet-header,
  .sheet-row {
    display: grid;
    grid-template-columns: 58px minmax(180px, 1.7fr) minmax(140px, 1fr) minmax(120px, 0.9fr);
    gap: 0.65rem;
    align-items: center;
  }

  .sheet-header {
    padding: 0.2rem 0.8rem;
    font-size: 0.74rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .batch-form {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
  }

  .sheet-row {
    position: relative;
    padding: 0.78rem 0.8rem;
    border-radius: var(--radius-lg);
    border: 1px solid rgba(255,255,255,0.08);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.008) 42%, rgba(255,255,255,0)),
      color-mix(in srgb, var(--color-surface) 95%, black 5%);
    box-shadow: 0 18px 36px rgba(4, 5, 7, 0.14);
    transition: background 140ms ease, border-color 140ms ease, box-shadow 140ms ease;
  }

  .sheet-row::before {
    content: '';
    position: absolute;
    inset: 0 auto 0 0;
    width: 4px;
    border-radius: var(--radius-lg) 0 0 var(--radius-lg);
    background: linear-gradient(180deg, rgba(195, 32, 43, 0.88), rgba(195, 32, 43, 0.2));
  }

  .sheet-row.done {
    border-color: rgba(22, 163, 74, 0.2);
    background:
      linear-gradient(180deg, rgba(22, 163, 74, 0.12), rgba(22, 163, 74, 0.03)),
      color-mix(in srgb, var(--color-surface) 92%, black 8%);
    box-shadow: 0 18px 36px rgba(4, 5, 7, 0.16);
  }

  .sheet-row.done::before {
    background: linear-gradient(180deg, rgba(22, 163, 74, 0.92), rgba(22, 163, 74, 0.2));
  }

  .number-form {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .check-btn {
    width: 2.2rem;
    height: 2.2rem;
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.08);
    background: color-mix(in srgb, var(--color-surface-alt) 92%, black 8%);
    color: var(--color-primary-contrast);
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
    font-weight: var(--weight-semibold);
  }

  .item-cell {
    font-size: 0.95rem;
    color: var(--color-text);
    font-weight: var(--weight-medium);
  }

  .number-input {
    width: 100%;
    min-width: 0;
    padding: 0.5rem 0.58rem;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.08);
    background: color-mix(in srgb, var(--color-surface-alt) 92%, black 8%);
    color: var(--color-text);
  }

  .actions-row {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 0.35rem;
    flex-wrap: wrap;
  }

  .reset-row {
    margin-top: 0.5rem;
  }

  .submit-btn {
    min-height: 2.75rem;
    padding: 0.72rem 1rem;
    border-radius: 10px;
    border: 1px solid rgba(195, 32, 43, 0.22);
    background: linear-gradient(180deg, rgba(195, 32, 43, 0.22), rgba(195, 32, 43, 0.08));
    color: var(--color-primary-contrast);
    cursor: pointer;
    font-size: 0.84rem;
    font-weight: var(--weight-semibold);
  }

  .submit-btn:disabled {
    opacity: 0.7;
    cursor: wait;
  }

  .subtle-btn {
    opacity: 0.88;
  }

  .admin-par {
    margin-top: 0.55rem;
  }

  .admin-par summary {
    cursor: pointer;
    width: fit-content;
    padding: 0.28rem 0.55rem;
    border: 1px dashed rgba(195, 32, 43, 0.24);
    border-radius: 10px;
    color: var(--color-text-muted);
    font-size: 0.8rem;
    background: rgba(255,255,255,0.018);
  }

  .admin-par-form {
    margin-top: 0.55rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .par-edit-row {
    display: grid;
    grid-template-columns: 1fr minmax(100px, 140px);
    gap: 0.5rem;
    align-items: center;
  }

  .mini-btn {
    width: fit-content;
    min-height: 2.35rem;
    padding: 0.55rem 0.72rem;
    border-radius: 10px;
    border: 1px solid rgba(195, 32, 43, 0.22);
    background: linear-gradient(180deg, rgba(195, 32, 43, 0.18), rgba(195, 32, 43, 0.06));
    color: var(--color-primary-contrast);
    cursor: pointer;
    font-size: 0.8rem;
  }

  .subtle {
    opacity: 0.85;
  }

  .par-readonly {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.95rem;
    color: var(--color-text);
    padding: 0.3rem 0.4rem;
    border-radius: 10px;
    background: rgba(255,255,255,0.02);
  }

  .field-tag {
    font-size: 0.7rem;
    letter-spacing: 0.08em;
    color: var(--color-text-muted);
    white-space: nowrap;
  }

  .empty {
    padding: 1rem 0.1rem;
    color: var(--color-text-muted);
  }

  .ocr-status,
  .ocr-error {
    margin: 0.15rem 0 0;
    font-size: 0.82rem;
    line-height: 1.45;
  }

  .ocr-status {
    color: var(--color-text-muted);
  }

  .ocr-error {
    color: #fca5a5;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .ocr-match-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
    margin-top: 0.2rem;
  }

  .ocr-match-chip {
    padding: 0.36rem 0.56rem;
    border-radius: 999px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.08);
    color: var(--color-text-muted);
    font-size: 0.78rem;
    line-height: 1.2;
  }

  @media (max-width: 760px) {
    .sheet-header {
      display: none;
    }

    .sheet-row {
      grid-template-columns: 50px 1fr;
      gap: 0.65rem;
      padding: 0.8rem 0.75rem;
    }

    .number-form,
    .par-readonly {
      grid-column: 2 / -1;
    }

    .actions-row > * {
      width: 100%;
    }

    .actions-row button,
    .actions-row .submit-btn {
      width: 100%;
    }
  }
</style>
