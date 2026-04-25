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
  return createListPage('preplists', section, `${toTitle(section)} Prep`, {
    subtitle: 'Submit prep counts together. Admins can adjust par levels in admin tools.',
    valueLabel: 'Prep',
    submitLabel: 'Submit Prep Counts',
    resetLabel: 'New Prep List (Reset to 0)',
    adminSummaryLabel: '+ Admin Par Levels',
    valueType: 'text'
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
