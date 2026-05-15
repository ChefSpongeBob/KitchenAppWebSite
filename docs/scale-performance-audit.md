# Scale Performance Audit

Phase 7 focuses on keeping normal tenant traffic fast as restaurant count and sensor/camera volume grow.

## Completed
- Added compound indexes for high-traffic tenant reads in `migrations/0053_scale_performance_indexes.sql`.
- Covered homepage/admin dashboard paths for todos, temps, documents, recipes, whiteboard, lists, scheduling, onboarding, camera media, and business users.
- Batched temp retention cleanup to avoid deleting unlimited rows in one ingest request.
- Batched camera retention cleanup to avoid loading/deleting unlimited event rows in one pass.
- Batched old ToDo cleanup and throttled rejected-whiteboard cleanup during normal page requests.
- Consolidated admin dashboard ToDo analytics into aggregate queries instead of several separate count reads.
- Removed production request-time schema repair/verification from hot paths; production now relies on migrations plus schema-readiness checks.
- Removed production `PRAGMA` introspection from list/admin paths that already have migration-backed columns.
- Streamed document and camera media responses from R2 instead of loading whole files into Worker memory.
- Added hard size limits to camera still/clip uploads before storing media.
- Added `npm run test:scale-performance` as a static guard for the scale migration and retention limits.

## Query Areas Reviewed
- Admin dashboard analytics:
  - schedule coverage by business/date
  - todo created/completed windows
  - temp anomaly windows
  - active staff counts
- App homepage:
  - assigned/open todos
  - recent temps
  - menu documents
  - top whiteboard ideas
- Schedule:
  - week/date/user schedule reads
  - open shift requests
  - team ordering
  - availability and time-off reads
- Media/security:
  - document file lookup
  - camera media lookup by image/clip URL
  - onboarding file/source lookup
- Retention:
  - temp cleanup
  - camera media cleanup

## Next Scale Notes
- D1 should be fine for launch-scale relational data if all migrations are applied before deploy.
- Keep schema changes migration-only in production. Local dev can still use schema helpers, but production routes should not run `CREATE`, `ALTER`, index repair, or repeated table introspection.
- Temps and camera events are the first candidates for separate storage or Durable Object partitioning if write volume becomes noisy.
- Keep dashboard analytics date-windowed; avoid all-time aggregations on request paths.
- Keep media object deletion batched; never delete an unlimited camera/temp backlog during a user-facing request.
- Keep cleanup work batched on user/admin page loads; move heavier maintenance to scheduled jobs once traffic grows.
- Keep user/admin uploads capped and stream R2 objects when serving media.
