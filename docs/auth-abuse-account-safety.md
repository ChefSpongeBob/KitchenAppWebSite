# Auth Abuse And Account Safety

Phase 8 adds server-side controls for account abuse and recovery safety.

## Completed
- Login attempts are rate-limited by IP and email.
- Password reset requests are rate-limited by IP and email.
- Signup attempts are rate-limited by IP and email.
- Invite creation is rate-limited by business, admin, and invitee email.
- Security audit logs record login failures, successful login, password reset requests/completions, signup events, invite events, access changes, and session revocation.
- Password reset completion revokes existing sessions and devices.
- Users can revoke active sessions in Profile & Settings.
- Admins can revoke an employee's active sessions from the employee profile.
- Production schema readiness now requires the auth safety tables.

## Data Handling
- Audit logs store hashed email, IP, and user-agent values instead of raw identifiers.
- Rate-limit keys are hashed before storage.
- Session controls update `sessions.revoked_at`; device revocation is reserved for stronger flows like password reset or full access removal.

## Launch Notes
- Apply `migrations/0054_auth_abuse_account_safety.sql` before production traffic.
- Keep `SMOKE_INTERNAL_TOKEN` set so schema readiness can verify the security tables.
- Review login/reset thresholds after real traffic begins.
