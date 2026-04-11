<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let value = '';
  export let includeSpecialOptions: string[] = [];
  export let specialPlaceholder = 'Timed End';
  const dispatch = createEventDispatcher<{ commit: { value: string } }>();

  const hourOptions = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
  const minuteOptions = ['00', '15', '30', '45'];
  const periodOptions = ['AM', 'PM'];

  let draftValue = '';
  let selectedSpecial = '';
  let selectedHour = '12';
  let selectedMinute = '00';
  let selectedPeriod = 'AM';
  let confirmationText = '';
  let confirmationTimer: ReturnType<typeof setTimeout> | null = null;

  function pad2(nextValue: number) {
    return String(nextValue).padStart(2, '0');
  }

  function wrapIndex(current: number, delta: number, length: number) {
    return (current + delta + length) % length;
  }

  function syncFromValue(nextValue: string) {
    draftValue = nextValue;

    if (includeSpecialOptions.includes(nextValue)) {
      selectedSpecial = nextValue;
      return;
    }

    selectedSpecial = '';
    const match = /^(\d{2}):(\d{2})$/.exec(nextValue);
    if (!match) {
      selectedHour = '12';
      selectedMinute = '00';
      selectedPeriod = 'AM';
      return;
    }

    const hours24 = Number(match[1]);
    const minutes = match[2];
    const hours12 = hours24 % 12 || 12;
    selectedHour = String(hours12);
    selectedMinute = minuteOptions.includes(minutes) ? minutes : '00';
    selectedPeriod = hours24 >= 12 ? 'PM' : 'AM';
  }

  function timeValueFromParts() {
    let hours24 = Number(selectedHour) % 12;
    if (selectedPeriod === 'PM') hours24 += 12;
    return `${pad2(hours24)}:${selectedMinute}`;
  }

  function setSpecial(option: string) {
    selectedSpecial = selectedSpecial === option ? '' : option;
  }

  function stepHour(delta: number) {
    selectedSpecial = '';
    const index = hourOptions.indexOf(selectedHour);
    selectedHour = hourOptions[wrapIndex(index >= 0 ? index : 0, delta, hourOptions.length)];
  }

  function stepMinute(delta: number) {
    selectedSpecial = '';
    const index = minuteOptions.indexOf(selectedMinute);
    selectedMinute = minuteOptions[wrapIndex(index >= 0 ? index : 0, delta, minuteOptions.length)];
  }

  function stepPeriod(delta: number) {
    selectedSpecial = '';
    const index = periodOptions.indexOf(selectedPeriod);
    selectedPeriod = periodOptions[wrapIndex(index >= 0 ? index : 0, delta, periodOptions.length)];
  }

  function handleCancel() {
    syncFromValue(value);
  }

  function handleOk() {
    value = selectedSpecial || timeValueFromParts();
    draftValue = value;
    dispatch('commit', { value });
    confirmationText = selectedSpecial
      ? `${selectedSpecial} set`
      : `${selectedHour}:${selectedMinute} ${selectedPeriod} set`;

    if (confirmationTimer) clearTimeout(confirmationTimer);
    confirmationTimer = setTimeout(() => {
      confirmationText = '';
      confirmationTimer = null;
    }, 1400);
  }

  $: if (value !== draftValue) {
    syncFromValue(value);
  }
</script>

<div class="picker">
  {#if includeSpecialOptions.length > 0}
    <div class="specials">
      <span class="special-label">{specialPlaceholder}</span>
      <div class="special-buttons">
        {#each includeSpecialOptions as option}
          <button
            type="button"
            class:selected={selectedSpecial === option}
            class="special-btn"
            on:click={() => setSpecial(option)}
          >
            {option}
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <div class:dimmed={selectedSpecial.length > 0} class="picker-panel">
    <button type="button" class="arrow-btn" disabled={selectedSpecial.length > 0} on:click={() => stepHour(-1)}>^</button>
    <button type="button" class="arrow-btn" disabled={selectedSpecial.length > 0} on:click={() => stepMinute(-1)}>^</button>
    <button type="button" class="arrow-btn" disabled={selectedSpecial.length > 0} on:click={() => stepPeriod(-1)}>^</button>

    <div class="value-box">{selectedHour}</div>
    <div class="value-box">{selectedMinute}</div>
    <div class="value-box period-box">{selectedPeriod}</div>

    <button type="button" class="arrow-btn" disabled={selectedSpecial.length > 0} on:click={() => stepHour(1)}>v</button>
    <button type="button" class="arrow-btn" disabled={selectedSpecial.length > 0} on:click={() => stepMinute(1)}>v</button>
    <button type="button" class="arrow-btn" disabled={selectedSpecial.length > 0} on:click={() => stepPeriod(1)}>v</button>
  </div>

  <div class="actions">
    <button type="button" class="cancel-btn" on:click={handleCancel}>Cancel</button>
    <button type="button" class="ok-btn" on:click={handleOk}>OK</button>
  </div>

  {#if confirmationText}
    <p class="confirmation">{confirmationText}</p>
  {/if}
</div>

<style>
  .picker {
    display: grid;
    gap: 0.55rem;
    padding: 0.65rem;
    border: 1px solid color-mix(in srgb, var(--color-border) 78%, transparent);
    border-radius: 12px;
    background:
      linear-gradient(180deg, color-mix(in srgb, var(--color-primary) 8%, transparent), transparent 38%),
      color-mix(in srgb, var(--color-surface-alt) 94%, black 6%);
  }

  .specials {
    display: grid;
    gap: 0.35rem;
  }

  .special-label {
    color: var(--color-text-muted);
    font-size: 0.72rem;
  }

  .special-buttons {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .picker-panel {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.45rem;
    align-items: center;
  }

  .picker-panel.dimmed {
    opacity: 0.5;
  }

  .value-box {
    display: grid;
    place-items: center;
    min-height: 2.5rem;
    border-radius: 8px;
    border: 1px solid color-mix(in srgb, var(--color-border) 72%, transparent);
    background:
      linear-gradient(180deg, color-mix(in srgb, var(--color-primary) 10%, transparent), transparent 55%),
      color-mix(in srgb, var(--color-surface) 92%, black 8%);
    color: var(--color-text);
    font-size: 1rem;
    font-weight: var(--weight-semibold);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
  }

  .period-box {
    color: var(--color-text-soft);
    font-weight: var(--weight-medium);
  }

  .arrow-btn,
  .special-btn,
  .cancel-btn,
  .ok-btn {
    border-radius: 8px;
    border: 1px solid color-mix(in srgb, var(--color-border) 72%, transparent);
    cursor: pointer;
    font-size: 0.8rem;
  }

  .arrow-btn {
    min-height: 1.8rem;
    background: color-mix(in srgb, var(--color-surface) 88%, black 12%);
    color: color-mix(in srgb, var(--color-primary) 75%, white 25%);
    font-weight: var(--weight-semibold);
  }

  .arrow-btn:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .special-btn {
    min-height: 2rem;
    padding: 0.4rem 0.7rem;
    background: color-mix(in srgb, var(--color-surface) 88%, black 12%);
    color: var(--color-text-soft);
  }

  .special-btn.selected {
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--color-primary) 28%, transparent),
      color-mix(in srgb, var(--color-primary) 14%, transparent)
    );
    color: var(--color-text);
    border-color: color-mix(in srgb, var(--color-primary) 42%, transparent);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.45rem;
  }

  .confirmation {
    margin: 0;
    color: #bbf7d0;
    font-size: 0.74rem;
    text-align: right;
  }

  .cancel-btn,
  .ok-btn {
    min-height: 2rem;
    padding: 0.42rem 0.8rem;
  }

  .cancel-btn {
    background: color-mix(in srgb, var(--color-surface) 90%, black 10%);
    color: var(--color-text-soft);
  }

  .ok-btn {
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--color-primary) 42%, transparent),
      color-mix(in srgb, var(--color-primary) 22%, transparent)
    );
    color: var(--color-primary-contrast);
    border-color: color-mix(in srgb, var(--color-primary) 38%, transparent);
  }
</style>
