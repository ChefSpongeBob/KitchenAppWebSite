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

function handlersFor(section: string, shift: string) {
  const sectionSlug = shift === section ? section : `${section}-${shift}`;
  const title = shift === section ? toTitle(section) : `${toTitle(section)} ${toTitle(shift)}`;

  return createChecklistPage(sectionSlug, title, {
    subtitle: 'Work through the checklist and reset when needed.',
    resetLabel: 'Reset Checklist',
    defaults: []
  });
}

function requireParam(value: string | undefined, label: string) {
  if (!value) {
    throw error(404, `Checklist ${label} not found.`);
  }
  return value;
}

export const load: PageServerLoad = async (event) => {
  const section = requireParam(event.params.section, 'section');
  const shift = requireParam(event.params.shift, 'shift');
  return handlersFor(section, shift).load(event);
};

export const actions: Actions = {
  toggle_checked: async (event) => {
    const section = requireParam(event.params.section, 'section');
    const shift = requireParam(event.params.shift, 'shift');
    return handlersFor(section, shift).actions.toggle_checked(event);
  },
  reset_checklist: async (event) => {
    const section = requireParam(event.params.section, 'section');
    const shift = requireParam(event.params.shift, 'shift');
    return handlersFor(section, shift).actions.reset_checklist(event);
  }
};
