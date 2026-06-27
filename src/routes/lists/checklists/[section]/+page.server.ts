import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createChecklistPage } from '$lib/server/checklists';

function toTitle(value: string) {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function requireSection(value: string | undefined) {
  if (!value) throw error(404, 'Checklist not found.');
  return value;
}

function handlersFor(section: string) {
  return createChecklistPage(section, toTitle(section), {
    subtitle: '',
    resetLabel: 'Reset Checklist',
    defaults: []
  });
}

export const load: PageServerLoad = async (event) => {
  const section = requireSection(event.params.section);
  return handlersFor(section).load(event);
};

export const actions: Actions = {
  toggle_checked: async (event) => {
    const section = requireSection(event.params.section);
    return handlersFor(section).actions.toggle_checked(event);
  },
  reset_checklist: async (event) => {
    const section = requireSection(event.params.section);
    return handlersFor(section).actions.reset_checklist(event);
  }
};
