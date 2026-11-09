export function normalizeInvitationCode(value: string | null | undefined) {
  const code = String(value ?? '').trim().toUpperCase();
  return code.length <= 160 ? code : '';
}

export function invitationRegistrationPath(code: string) {
  return `/register?invite=${encodeURIComponent(code)}`;
}

export function invitationLoginPath(code: string) {
  return `/login?invite=${encodeURIComponent(code)}`;
}
