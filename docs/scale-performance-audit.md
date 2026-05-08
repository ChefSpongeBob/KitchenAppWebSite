# Scale Performance Audit

Phase 7 focuses on keeping normal tenant traffic fast as restaurant count and sensor/camera volume grow.

## Completed
- Added compound indexes for high-traffic tenant reads in `migrations/0053_scale_performance_indexes.sql`.
- Covered homepage/admin dashboard paths for todos, temps, documents, recipes, whiteboard, lists, scheduling, onboarding, camera media, and business users.
- Batched temp retention cleanup to avoid deleting unlimited rows in one ingest request.
- Batched camera retention cleanup to avoid loading/deleting unlimited event rows in one pass.
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
- Temps and camera events are the first candidates for separate storage or Durable Object partitioning if write volume becomes noisy.
- Keep dashboard analytics date-windowed; avoid all-time aggregations on request paths.
- Keep media object deletion batched; never delete an unlimited camera/temp backlog during a user-facing request.
