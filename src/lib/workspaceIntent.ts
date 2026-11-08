export const WORKSPACE_HEADER = 'x-crimini-workspace';
export const WORKSPACE_PARAM = '__workspace';
export const WORKSPACE_CONFLICT_HEADER = 'x-crimini-workspace-conflict';
export const WORKSPACE_CHANGED_MESSAGE = 'Restaurant changed. Refresh this page before saving.';

export function isWorkspaceRequest(pathname: string) {
  if (/^\/(?:login|logout|register|forgot-password|reset-password|staff|workspace)(?:\/|$)/.test(pathname)) return false;
  if (/^\/api\/(?:internal|billing\/(?:app-store-notifications|google-play-notifications))(?:\/|$)/.test(pathname)) return false;
  return true;
}
