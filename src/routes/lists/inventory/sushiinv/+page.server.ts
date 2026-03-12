import type { Actions, PageServerLoad } from './$types';
import { createListPage } from '$lib/server/preplist';

const handlers = createListPage('inventory', 'sushi', 'Sushi Inventory', {
  subtitle: 'Track sushi-bar stock counts and reset for a fresh count cycle.',
  valueLabel: 'Count',
  submitLabel: 'Submit Inventory Counts',
  resetLabel: 'Reset Inventory Count',
  adminSummaryLabel: '+ Admin Par Levels',
  defaults: [
    { content: 'Nori packs', par_count: 12 },
    { content: 'Masago tubs', par_count: 6 },
    { content: 'Spicy mayo bottles', par_count: 8 },
    { content: 'Eel sauce bottles', par_count: 8 },
    { content: 'Sushi rice bins', par_count: 5 }
  ]
});

export const load: PageServerLoad = handlers.load;
export const actions: Actions = handlers.actions;
