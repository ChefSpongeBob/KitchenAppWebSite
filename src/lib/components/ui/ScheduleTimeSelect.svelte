<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let value = '';
  export let includeSpecialOptions: string[] = [];
  export let specialPlaceholder = 'Timed End';
  const dispatch = createEventDispatcher<{ commit: { value: string }; cancel: void }>();

  const hourOptions = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
  const minuteOptions = ['00', '15', '30', '45'];
  const periodOptions = ['AM', 'PM'];

  let draftValue = '';
  let selectedSpecial = '';
  let selectedHour = '12';
  let selectedMinute = '00';
  let selectedPeriod = 'AM';

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
    dispatch('cancel');
  }

  function handleOk() {
    value = selectedSpecial || timeValueFromParts();
    draftValue = value;
    dispatch('commit', { value });
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
</div>

<style>
  .picker {
    display: grid;
    gap: 0.5rem;
    padding: 0.6rem 0;
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
    background: transparent;
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
    min-height: 2.25rem;
    border: 0;
    border-bottom: 1px solid var(--color-divider);
    border-radius: 0;
    background: transparent;
    color: var(--color-text);
    font-size: 0.92rem;
    font-weight: var(--weight-semibold);
  }

  .period-box {
    color: var(--color-text-soft);
    font-weight: var(--weight-medium);
  }

  .arrow-btn,
  .special-btn,
  .cancel-btn,
  .ok-btn {
    border: 0;
    border-bottom: 1px solid var(--color-divider);
    border-radius: 0;
    background: transparent;
    color: var(--color-text);
    cursor: pointer;
    font-size: 0.72rem;
    font-weight: var(--weight-semibold);
  }

  .arrow-btn {
    min-height: 1.55rem;
    color: var(--color-text-muted);
  }

  .arrow-btn:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .special-btn {
    min-height: 1.85rem;
    padding: 0.32rem 0.6rem;
    color: var(--color-text-soft);
  }

  .special-btn.selected {
    color: var(--color-text);
    border-bottom-color: var(--color-text);
    font-weight: var(--weight-bold);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.45rem;
  }

  .cancel-btn,
  .ok-btn {
    min-height: 1.85rem;
    padding: 0.3rem 0.65rem;
  }

  .cancel-btn {
    color: var(--color-text-soft);
  }

  .ok-btn {
    border-bottom-color: var(--color-text);
    color: var(--color-text);
  }
</style>
