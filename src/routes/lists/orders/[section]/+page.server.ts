import type { Actions, PageServerLoad } from './$types';
import { createListPage } from '$lib/server/preplist';

function toTitle(value: string) {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function handlersFor(section: string) {
  return createListPage('orders', section, toTitle(section), {
    subtitle: 'Order sheet with editable quantities and admin par targets.',
    valueLabel: 'Order',
    submitLabel: 'Submit Order Counts',
    resetLabel: 'Reset Order Sheet',
    adminSummaryLabel: '+ Admin Par Levels'
  });
}

export const load: PageServerLoad = async (event) => {
  return handlersFor(event.params.section).load(event);
};

export const actions: Actions = {
  submit_prep_counts: async (event) => handlersFor(event.params.section).actions.submit_prep_counts(event),
  new_prep_list: async (event) => handlersFor(event.params.section).actions.new_prep_list(event),
  toggle_checked: async (event) => handlersFor(event.params.section).actions.toggle_checked(event),
  save_par_levels: async (event) => handlersFor(event.params.section).actions.save_par_levels(event)
};
