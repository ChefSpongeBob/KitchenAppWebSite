import { pushToast } from '#lib/client/toasts.ts';

export function nativeRestaurantSwitch(form: HTMLFormElement) {
  let pending = false;
  const submit = async (event: SubmitEvent) => {
    if (!(window as typeof window & { __CRIMINI_NATIVE__?: boolean }).__CRIMINI_NATIVE__) return;
    event.preventDefault();
    if (pending) return;
    pending = true;
    form.setAttribute('aria-busy', 'true');
    try {
      const response = await fetch('/workspace/switch', {
        method: 'POST', headers: { accept: 'application/json' }, body: new FormData(form), credentials: 'include'
      });
      if (!response.ok) throw new Error('Restaurant unavailable');
      const result = await response.json();
      if (!['/app', '/settings?onboarding=1'].includes(result.location)) throw new Error('Invalid destination');
      // Reload the local app shell so old restaurant permissions and workspace intent cannot persist.
      window.location.assign(result.location);
    } catch {
      pushToast('Could not switch restaurants. Refresh and try again.', 'error');
    } finally {
      pending = false;
      form.removeAttribute('aria-busy');
    }
  };
  form.addEventListener('submit', submit);
  return { destroy() { form.removeEventListener('submit', submit); } };
}
