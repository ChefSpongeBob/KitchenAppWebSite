import type { BeforeNavigate } from '$app/navigation';

export function createScheduleNavigationGuard(options: {
  state: () => { dirty: boolean; inFlight: Promise<boolean> | null; submitting: boolean };
  save: () => Promise<boolean>;
  navigate: (url: URL) => Promise<void>;
  history: (delta: number) => void;
  notify: (message: string) => void;
}) {
  let pending: Promise<void> | null = null;
  return (navigation: BeforeNavigate) => {
    if (navigation.to?.url.pathname === '/login') return;
    const state = options.state();
    if (!state.dirty && !state.inFlight && !state.submitting) return;
    navigation.cancel();
    if (navigation.willUnload) return;
    if (state.submitting) {
      options.notify('Wait for the schedule update to finish.');
      return;
    }
    if (pending || !navigation.to) return pending;
    const destination = navigation.to.url;
    pending = (async () => {
      if (state.inFlight && !(await state.inFlight)) {
        options.notify('The schedule could not be saved. Stay here and try again.');
        return;
      }
      if (options.state().dirty && !(await options.save())) {
        options.notify('The schedule could not be saved. Stay here and try again.');
        return;
      }
      if (navigation.type === 'popstate' && navigation.delta) options.history(navigation.delta);
      else await options.navigate(destination);
    })().catch(() => {
      options.notify('The schedule could not be saved. Stay here and try again.');
    }).finally(() => { pending = null; });
    return pending;
  };
}
