import { WORKSPACE_HEADER, WORKSPACE_PARAM, WORKSPACE_CONFLICT_HEADER, isWorkspaceRequest } from '#lib/workspaceIntent.ts';

export function installWorkspaceIntent(getBusinessId: () => string | null | undefined, onConflict: () => void) {
  const previousFetch = window.fetch;
  let businessId = getBusinessId() || null;
  let conflictShown = false;
  let authenticationNavigation = false;
  const current = () => {
    if (authenticationNavigation) return null;
    const id = getBusinessId();
    if (!id) businessId = null;
    else if (!businessId) businessId = id;
    return businessId;
  };
  const localUrl = (input: string) => {
    const url = new URL(input, window.location.href);
    const local = new URL(window.location.href);
    const native = (window as typeof window & { __CRIMINI_NATIVE__?: boolean }).__CRIMINI_NATIVE__;
    return !url.username && !url.password &&
      (url.protocol === local.protocol && url.host === local.host || (native && url.origin === 'https://criminiops.com')) &&
      isWorkspaceRequest(url.pathname) ? url : null;
  };
  const guardedFetch: typeof fetch = async (input, init) => {
    const id = current();
    const url = localUrl(input instanceof Request ? input.url : String(input));
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    let options = init;
    if (id && url && (method !== 'GET' && method !== 'HEAD' || url.pathname.startsWith('/api/') || url.pathname.endsWith('/__data.json'))) {
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      headers.set(WORKSPACE_HEADER, id);
      options = { ...init, headers };
    }
    const response = await previousFetch.call(window, input, options);
    if (response.headers.get(WORKSPACE_CONFLICT_HEADER) === '1' && !conflictShown) {
      conflictShown = true;
      onConflict();
    }
    return response;
  };
  const handleSubmit = (event: Event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    const submitter = (event as SubmitEvent).submitter as HTMLButtonElement | HTMLInputElement | null;
    const method = submitter?.getAttribute('formmethod') ?? form.getAttribute('method') ?? 'GET';
    const id = current();
    if (!id || method.toUpperCase() !== 'POST') return;
    const action = submitter?.getAttribute('formaction') ?? form.getAttribute('action') ?? window.location.href;
    const url = localUrl(action);
    if (!url) return;
    url.searchParams.set(WORKSPACE_PARAM, id);
    if (submitter?.hasAttribute('formaction')) submitter.setAttribute('formaction', url.href);
    else form.setAttribute('action', url.href);
  };
  window.fetch = guardedFetch;
  document.addEventListener('submit', handleSubmit, true);
  const dispose = () => {
    if (window.fetch === guardedFetch) window.fetch = previousFetch;
    document.removeEventListener('submit', handleSubmit, true);
  };
  return Object.assign(dispose, {
    beginAuthenticationNavigation() { authenticationNavigation = true; },
    finishAuthenticationNavigation() {
      if (!authenticationNavigation) return;
      businessId = getBusinessId() || null;
      conflictShown = false;
      authenticationNavigation = false;
    }
  });
}
