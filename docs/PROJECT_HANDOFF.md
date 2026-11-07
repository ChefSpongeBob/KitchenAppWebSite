# Crimini Completion Checklist

Updated: 2026-11-07. This is the ONE active completion list for the entire product: website, restaurant web app, Android/iOS apps, Cloudflare backend, HR, billing, email, temperature equipment, and Crimini Staff operations. It replaces the overlapping launch, Staff, phone, and manual-validation lists formerly in this file. `docs/DB_ROUTE_INVENTORY.md` remains the schema/routing reference, not another backlog. Git history preserves superseded checkpoints.

## Current Position

**Next task: 00.02.** The initial baseline assessment is recorded at 00.01; its small control-state corrections belong to 00.03. UI/workflow refinement remains open; this is not merely final testing. The framework migration and Staff sign-in correction are deployed; do not restart them. Work this list in order, repair failed checks under their owning task, and return to the cursor after interruptions.

Unchecked means remaining work OR remaining proof, not necessarily broken code. A build, source check or HTTP 200 cannot complete a workflow. This consolidation authorizes no new features, production data changes, hardware flashing or phone installation.

Labels:
- **ASSESS:** inspect implementation/data and agree on behavioral changes before editing.
- **BUILD:** missing or approved implementation remains; include tests in the same task.
- **VERIFY:** existing foundations need behavioral, visual, device or production evidence; repair demonstrated defects within scope.
- **OWNER:** product, visual, wording or policy decision required.
- **EXTERNAL:** provider, store, legal, hardware or infrastructure action required.
- **DEFERRED:** explicitly postponed, NOT permission to implement. Before launch, complete an approved pass or explicitly exclude the capability and its claims.

Within phases, work top to bottom. Park blockers only with owner, dependency and return task recorded here; continue independent work instead of silently completing blocked items. Security, isolation and data-loss blockers override visual work. Completion needs dated commit/environment/role/tenant/action/result evidence and coverage limits. Discovered defects stay in their owning phase, not another document.

## Established Baseline

Recorded results, not a fresh audit or blanket production certification:
- Framework rollout complete: SvelteKit 3.1.1, Svelte 5.57.3, Vite 8.3.5/plugin 7.3.1, TypeScript 6.0.3, adapters Cloudflare 8.0.2/static 4.0.1, Node 22.23.4, Wrangler 4.156.0, Capacitor 8.4.3, PDF.js 6.4.299. Preserve separate web/native outputs and transport compatibility.
- Latest application release: `902e1166a4049ae2e098d2e170a17fdfaafdf8b7`, Pages deployment `5b616c86-513b-4b46-b906-914dc65ac9a0`, 2026-11-07. Staff password sign-in auto-sends OTP; no second password/resend arrow; console still gated. Owner subsequently reported the correction looked good.
- Full static/type/real-SQL/action/Staff/support/email/PDF/native-transport checks and web/native builds passed for that release, zero type errors/warnings. Live schema readiness, restaurant smoke, Staff code issuance/console denial/logout passed. Not inbox, device, workflow, two-tenant or visual clearance.
- Migrations through `0114_staff_operations_support.sql` recorded applied; recheck before releasing. Last Staff sign-in correction required none. Never mutate applied migrations or casually rerun old seed/repair scripts.
- Membership, private media, encrypted HR, creator, schedule autosave/published snapshots, reports, email, ingest, billing and Staff diagnostic/support foundations have automated coverage; open acceptance is below.
- Scale/performance static checks pass for the recorded release, not measured throughput or unlimited Workers/D1 capacity.
- Last audit: nine affected packages, zero high/critical; unresolved low/moderate Capacitor CLI `rimraf/glob/minimatch` and Vite `deepmerge` chains. Call-site/bundle review supported build-configuration-only exposure for that build, NOT patched/risk-free packages. Fresh review/disposition remains open.
- Staff dashboard/support/roles/reservations/emailed OTP implemented. Infrastructure CPU/D1 integration, customer intervention powers and sole-owner recovery policy remain open.
- Native push registration foundation only: registration/revocation/preferences exist. Server-side APNs/FCM delivery is not implemented. Notification delivery is deferred by explicit user decision; SMS also unimplemented.

## Scope And Rules

- Preserve user workflows: no unsolicited reopen actions, automatic Opening/Midday/Closing checklists, fake preview routes, unapproved production fixtures, replacement authentication or invented features.
- Crimini is BOTH website/web app AND production Android/iOS apps. URL shortcuts are not native release validation.
- Keep public signup closed and approved pilot billing exception intact. No marketing access-key gate, account deletion or credential changes without approval.
- Restaurant authority derives from active business membership/positions/capabilities, not global role. Explicit platform Staff membership is separate; allowlists/billing exceptions never grant it.
- Reference ACTUAL `/app` and corrected `/admin`: cream/white/charcoal, existing mushrooms, sharp edges, faded dividers, restrained surfaces, compact underlined word buttons, bold active/regular inactive toggles. No universal gray panels, rounded floating cards, knives or improvised brand SVGs. Marketing light; app theme persists; Staff approved dark SaaS.
- UI copy short/useful; preserve necessary legal/consent/safety instructions. Sensitive HR belongs to dedicated packets/employee records, not freely editable bank/tax/ID fields on Profile. Owner packets optional; HR cannot trap normal navigation.
- Cameras and meeting notes removed, not pending restoration. Full POS/payroll, expanded contractor analytics, manufacturing automation and custom boards are future scope, not implied launch commitments.
- Staff interventions, delivery ledger, deferred pricing, hardware/eFuse changes, flashing or phone installs need separate approval. No secret viewer, SQL UI, impersonation, tenant deletion or billing override by assumption.
- Approved releases include needed compatible migrations after backup/rehearsal and exact deployment verification. This documentation task requires no migration.

## Runtime And Evidence Reference

- Repo `https://github.com/ChefSpongeBob/KitchenAppWebSite`; production `https://criminiops.com`; alias `https://criminikitchenappwebsite.pages.dev`. Never silently switch test targets.
- Pages `criminikitchenappwebsite`; Wrangler app `criminikitchenapp`; D1 `DB` -> `crimini-production`; R2 `DOC_MEDIA` -> `crimini-doc-media`. No camera binding. Native app id / bundle id: `com.nexusnorthsystems.crimini`.
- Core wiring: `src/hooks.server.ts`, `src/lib/auth/roles.ts`, `src/lib/server/permissions.ts`, `business.ts`, `tenant.ts`, `appFeatures.ts`, `admin.ts`, `schedules.ts`, `iotIngest.ts`, `sensitive.ts`; `src/lib/navigation/managerNavigation.ts`; private media endpoint below. Check actual files/schema, never inferred copied-app names.
- Cloudflare Secrets/config names, NEVER values here: `SMOKE_INTERNAL_TOKEN`, `SENSITIVE_DATA_KEY`, `SENSITIVE_DATA_KEY_VERSION`, `PASSWORD_PEPPER`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_REPLY_TO_EMAIL`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `BILLING_WEBHOOK_TOKEN`, and actual store requirements including `APP_STORE_PRIVATE_KEY`, `APP_STORE_BUNDLE_ID`, `APP_STORE_ENVIRONMENT`, `GOOGLE_PLAY_PACKAGE_NAME`, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`.
- Private test config: `APP_BASE_URL=https://criminiops.com`, `PUBLIC_SIGNUP_ENABLED=false`, approved `OWNER_SIGNUP_ALLOWLIST`; smoke credentials ignored locally. `APP_STORE_DOWNLOAD_URL`/`GOOGLE_PLAY_DOWNLOAD_URL` must be real listings.
- Dispatcher: `workers/operational-email-dispatcher/wrangler.jsonc`, `crimini-operational-email-dispatcher`, every-minute cron, own DB/base URL/internal token. Successful observed runs are not proof of permanent uptime/inbox delivery.
- Inventory at consolidation: 76 rendered pages, 68 page-server files, 20 endpoints. Coverage includes layouts/hooks/actions, query tabs, server-only logout and intentional redirects. Reconcile inventory after changes.
- Local gates: `npm.cmd run test:static`, `npm.cmd run build:native`, `npm.cmd run mobile:check`, `npm.cmd run native:prereq`, `npm.cmd run android:release:check`, `npm.cmd run smoke:local`. Static includes type/web build, real SQL/workflow, Staff/support, email/worker, PDF, schema namespace and native transport tests.
- Live: `npm run schema:readiness:prod`, `npm.cmd run smoke:prod` with exact environment/ignored credentials; smoke covers only enumerated routes. Release checks include `npm run test:cloudflare-readiness`, `npm run test:production-schema`, audit and platform builds. Remote inspection uses e.g. `d1 execute DB --remote`; writes need approved scope.

## Remaining Launch Work

### 0. UI And Workflow Reconciliation

Complete remaining approved refinement before another full restaurant-entry exercise. This is not permission for a new design. Domain behavior is proven in its owning phase; final UI regression is phase 15.

- [x] **00.01 ASSESS** Establish the current `/app`, corrected `/admin` and approved dark Staff baseline against recorded decisions; catalog demonstrated defects without replacing accepted designs. Evidence 2026-11-07: production restaurant sign-in, isolated desktop 1440px/phone-sized 390px browser inspection, app/manager light and dark, ordinary return visits without tour, visible mushrooms, transparent zero-radius manager panels and no horizontal page overflow. Anonymous Staff sign-in remained dark/nav-free after logout; authenticated Staff visual review stays open at 00.17 and was not bypassed. Source inspection plus cloned actual-button styling proved selected moderation could render weight 400 instead of 700; shared CSS also overrode destructive manager tone, and inactive range links were 600 rather than 400. Repairs are tracked at 00.03. No restaurant records, OTP, firmware or phone installation changed; inspection sessions were revoked. This is assessment completion, not visual signoff of all screens.
- [ ] **00.02 ASSESS** Walk all pages, manager dropdown, sidebar, query tabs, creators, overlays and footers. Flag blank/orphaned/redundant/inaccessible pages and misplaced editors before proposing consolidation/removal; preserve intentional `/welcome` and auth redirects.
  Progress 2026-11-07: source inventory resolved 238 literal internal destinations against 98 distinct page/endpoint/server-only route patterns with no missing target. Dynamic destinations, rendered discovery/permissions, overlays and full page-by-page visual review remain open; this is not proof every linked workflow works.
- [ ] **00.03 VERIFY** Global controls use compact underlined word buttons, sharp edges, faded separators and bold active toggles. Check component-scoped CSS, not just global rules; preserve labels, semantics, selection and destructive confirmation.
  First correction 2026-11-07: shared word-button rules now recognize existing `active-action`/`danger-text`; manager moderation exposes pressed state; inactive chart ranges use regular weight and selected range exposes current state. No server action, route, form payload, persistence, permission, layout or database change. Focused UI and manager-navigation checks pass; broader control/accessibility audit and final release evidence remain open.
- [ ] **00.04 VERIFY** Desktop sidebar reaches every option at short/narrow desktop sizes; mobile scroll stays natural. Borderless mushroom hamburger/business logo, compact name/header spacing, Tools group and bottom theme control stay visible; theme persists across routes.
- [ ] **00.05 VERIFY** `/app` daypart greeting, display name, actual restaurant name, dividers, single specials area, spotlight star, conversions/Tools placement, Today/schedule, whiteboard, temps, menus, announcements and stacked lower quick links match the accepted layout without moving rounded cards.
- [ ] **00.06 VERIFY** `/admin` retains approved Ops overview, temperature/scheduling summaries, related People/schedule controls, announcement/reminder blocks, simple idea moderation, task assignment/open tasks, history and lower large quick-access areas. No duplicate feeds, universal gray fills or full editors spread over the overview.
- [ ] **00.07 ASSESS** Review each privileged surface: `/admin/app-editor`, `/admin/business-registry`, `/admin/feature-matrix`, `/admin/creator`, `/admin/vendors`, `/admin/sensors`, `/admin/schedule`, `/admin/onboarding`, `/admin/users`, `/admin/users/[id]`, `/billing`, `/reports`, `/todo/log`, permission-restricted `/vendors`. Use useful readouts then expandable editors where appropriate.
- [ ] **00.08 VERIFY** Business Registry shows saved business details before Edit; no Storefront/title collision. Billing stays discoverable in business context. Registry/Feature Matrix remain separate pages; branding/name uploads show saved results, not technical API banners.
- [ ] **00.09 ASSESS** People & HR exposes Overview, Team Directory, Invitations, Onboarding Packets, Forms & Policies, HR & Compliance and Roles & Access in-workspace and appropriate navigation. Keep search, compact summaries and employee-record links; no session/debug clutter.
- [ ] **00.10 VERIFY** Schedule groups builder, approvals/availability, open shifts, labor, templates and settings/roles/departments. Current-style time picker closes on OK/cancel. Add Shift overlays the grid without footer overlap; duplicate selection is bold. Check 7-day/100-person and phone layouts.
- [ ] **00.11 VERIFY** Creator categories have purposeful icons/dividers, obvious item entry above saved items, collapsed recipe-add controls and real Create category links. Names/descriptions use available width; successful adds clear only their editor and update visible counts/items immediately.
- [ ] **00.12 VERIFY** `/lists`, every checklist/prep/inventory/order index/detail, `/docs`, `/docs/[slug]`, `/recipes`, `/recipes/[category]`, `/menu`, vendor and report surfaces follow approved open-ended sections, not old card stacks. No redundant OPEN labels or buried essential controls.
- [ ] **00.13 VERIFY** Whiteboard clouds remain WHITE with BLACK text in both themes. Full text is centered in the main bubble with dynamic fitting, no ellipsis despite space. Preserve the approved sourced cloud, not a new concept.
- [ ] **00.14 VERIFY** `/temper` and `/admin/sensors` separate readings/setup, use assigned names/freshness and collapse secondary sections. Approved Wi-Fi guide lives in Registered Equipment. No camera cleanup, raw URL setup, customer keys or node-ID input.
- [ ] **00.15 OWNER** Review employee/purchaser logo transitions, background mushrooms, margins, image placement, Continue, retained fields, state/country dropdowns, consent, skip controls and branded welcome/login/download. Preserve agreed flows, not an improvised slideshow.
- [ ] **00.16 VERIFY** `/settings`, `/onboarding`, `/todo`, `/todo/log`, `/specials`, `/conversions`, `/tools/food-cost`, `/tools/safety-healthcode`, `/tools/waste` use current typography/controls/contrast/states. Remove broken icon-font subheaders without deleting necessary legal/safety text.
- [ ] **00.17 OWNER** Review `/staff`, `/staff/businesses`, `/staff/businesses/[id]`, `/staff/support`, `/staff/support/[id]`, `/staff/equipment`, `/staff/health`, `/staff/team`, `/staff/activity`, `/staff/security` in DuckDuckGo desktop/mobile. Preserve dark overview/charts, lower Quick Access, authenticated sidebar/menu and nav-free sign-in/OTP.
- [ ] **00.18 VERIFY** `/welcome/admin`, `/welcome/user` and `/app`/`/admin` tours anchor to real widgets/sidebar, explain creators/scheduling/People onboarding, avoid redundant feature-matrix/registry steps, and stay completed after navigation/relogin. Replay must be deliberate.
- [ ] **00.19 ASSESS** Review public/auth/footer routes individually: `/`, `/about`, `/features`, `/how-it-works`, `/pricing`, `/privacy`, `/terms`, `/billing-terms`, `/support`, `/account-deletion`, `/login`, `/forgot-password`, `/reset-password/[token]`, `/register`, `/register/welcome`, `/app/about`. Existence is not visual/legal acceptance.
- [ ] **00.20 VERIFY** App loading uses mushroom-only Prepping; marketing its logo, not removed splash/business-logo loading. Selects, green/red states, delete buttons, modals and disabled controls stay legible in both themes; mushroom background remains visible on small screens.

### 1. Cloudflare private validation setup

Required before real customer/SPPI entry or production writes. Security blockers take priority over the visual cursor.

- [ ] **01.01 VERIFY** Confirm exact Git/deployed commit, Pages domain/alias, Node pin, build command/output, compatibility flags and bindings. Local/remote targets must be explicit; no copied-app resources or dev fallback to production.
- [ ] **01.02 VERIFY** Keep public signup closed, approved owner allowlist, active-tenant invites and paid/test-tenant gates server-enforced. Preserve the current pilot owner/restaurant exception; ordinary accounts cannot manufacture one. No marketing access-key gate.
- [ ] **01.03 VERIFY** Check secret/config NAMES against Pages/dispatcher code and minimal token scopes. Scan Git, logs, assets, docs and native bundles for exposed values; local configuration stays ignored. Missing integrations fail safely without silent bypass.
- [ ] **01.04 VERIFY** Create/confirm backup before migrations or real-data loading. Record D1 export/migration state, integrity/foreign keys, R2 recovery reference, restricted storage and restore target. No tenant reset as a testing shortcut.
- [ ] **01.05 VERIFY** Run live schema readiness and authenticated smoke on the exact deployment. Verify logout revocation/reset-provider result; identify uncovered routes and actual inbox limitations.
- [ ] **01.06 ASSESS** Re-audit full/production dependency trees and vendor advisories against actual call sites/bundles. Resolve compatible fixes or obtain explicit residual-risk disposition. Keep findings visible; no forced downgrade, suppression or assumption devDependencies cannot matter.
- [ ] **01.07 OWNER** Agree testing scope, controlled emails, fake-versus-real HR policy, sandbox billing and traffic limits. No real sensitive employee data before isolation/security and qualified HR/privacy gates are accepted.

### 2. Private multi-tenant validation

Establish fixtures/schema/authority here; prove domain workflows in phases 3-16 and integrated acceptance in phase 17.

- [ ] **02.01 VERIFY** Read-only inventory current tenants/users/memberships, devices, content, schedules, forms and entitlement exceptions. Distinguish pilot from test records. Preserve current restaurant/owner; obtain approval before deletion/recreation.
- [ ] **02.02 OWNER** Select at least two independent validation businesses, optionally three for the pilot. Use controlled aliases/mailboxes where supported, not dozens of new accounts, invented deliverable emails or fake preview routes. Fixture creation requires approval.
- [ ] **02.03 VERIFY** Include owners, multiple manager levels, employees and scoped HR/consultant/contractor cases. Use similar names/identical slugs across businesses to expose uniqueness/join mistakes; email is not a business membership key.
- [ ] **02.04 VERIFY** Reconcile EVERY table/column/variable mapping/key/index/constraint/trigger/migration with actual loaders/actions/helpers and live metadata using `docs/DB_ROUTE_INVENTORY.md`. Update that reference for demonstrated drift, not guesses.
- [ ] **02.05 VERIFY** Prove direct tenant scope or scoped parent ownership for business data; classify global/system/root tables. Test composite foreign keys/uniqueness, nullable scope, orphans, membership joins and equal names across tenants.
- [ ] **02.06 VERIFY** All reads/writes/upserts/deletes, joins, dynamic SQL identifiers, sorting and pagination use server-derived scope and parameter/identifier allowlists. Client IDs cannot select another business/user/file/device/week. Ordinary production requests cannot repair schema.
- [ ] **02.07 VERIFY** Test defaults, tenant positions, individual capabilities, owner authority and manager limits against server actions. Permission changes invalidate stale authority; hiding controls is not security.
- [ ] **02.08 VERIFY** `/workspace/switch`, multi-membership, concurrent tabs, revocation and no-active-workspace cases resolve server-authorized tenant context. A cookie/form-selected business is never sufficient authority.
- [ ] **02.09 VERIFY** All 16 feature controls agree across dashboard, APP sidebar, dropdown, direct pages/actions/APIs: scheduling, ToDo, whiteboard, temps, announcements, spotlight, specials, lists, recipes, docs, menus, vendors, conversions, food cost, safety and waste; test all/management/off.
- [ ] **02.10 ASSESS** Measure query counts/rows/payloads and plans for schedule, People/HR, settings, creator, docs, reports, ingest and Staff. Fix demonstrated N+1/full scans/redundant loaders/missing tenant-first indexes without removing features.
- [ ] **02.11 VERIFY** Inventory polling/invalidation/subscriptions/service-worker caches. Hidden/offline/background/unmounted pages stop/back off, navigation cannot multiply timers, edits refresh without loops, private data never crosses users/tenants through caches.
- [ ] **02.12 VERIFY** Test double taps, retries, stale revisions, simultaneous managers and atomic multi-table writes. Inject DB/R2/provider failures safely; success cannot conceal partial saves/duplicate history.
- [ ] **02.13 ASSESS** Inventory retention, replacement, deletion/purge and scheduled cleanup across histories, HR, memberships, queues and R2. Bound/index jobs; preserve other tenants/required records; distinguish soft deletion from removal.
- [ ] **02.14 OWNER** Approve retention/deletion per class: raw temperatures versus weekly reports, two-week prep history, long schedule history, accepted HR, support, audits and cancellation snapshots. Requested history is not automatically statutory retention.
- [ ] **02.15 VERIFY** Audit scripts/routes/assets/modules using references AND navigation. Remove only proven dead material with coverage; preserve migrations/system tables. No camera/meeting-note/private-gate remnants, hardcoded restaurants or unused test bypasses.

### 3. Email and operational events

- [ ] **03.01 ASSESS** Confirm permitted email matrix: invites, account-created confirmation versus actual ownership verification, packets, department-authorized submission notices, acceptance/corrections, reset, deletion and critical-update wiring. Review existing schedule/list/billing messages rather than enabling every event.
- [ ] **03.02 VERIFY** Verify real Resend inbox delivery for invites and approved messages with controlled mailboxes. Check `send.criminiops.com`, sender/reply-to, SPF/DKIM/DMARC, branding, escaping, plain text and mobile display. Acceptance is not inbox delivery.
- [ ] **03.03 VERIFY** Invite links retain tenant/token through browser/native login and proper role flow; only real configured store URLs. No employee purchase screen/manual invite code.
- [ ] **03.04 VERIFY** Purchaser confirmation reflects saved restaurant, name/title and current plan/features. Do not call confirmation verified identity without an actual ownership-verification action; assess missing required flow before adding one.
- [ ] **03.05 VERIFY** Packet/send/submit/correction/acceptance/replacement emails identify correct business/person/reviewer. Never email tax/bank/ID contents or sensitive attachments; no raw message bodies in logs.
- [ ] **03.06 VERIFY** Process operational events and confirm recipients are correct, tenant/department/capability scoped, deduped and consent/status aware. No cross-business names, recipient exposure, deleted-user sends or duplicate approvals.
- [ ] **03.07 VERIFY** Dispatcher delays/retries/expiry/concurrent processing cannot duplicate actions or create unbounded history. Preserve direct-email/queue differences; failure states hide raw provider errors.
- [ ] **03.08 VERIFY** Workers sender timeout, redirect rejection, acceptance ID, idempotency and recovery work in real runtime tests; safely exercise invalid/rotated credentials. Empty successful cron batches are not delivery proof.
- [ ] **03.09 VERIFY** Observe scheduled processing/cleanup with a real approved event and controlled failure/recovery. Sustained failures reach the owner; queue metadata is not uptime.
- [ ] **03.10 OWNER** Temperatures NEVER send email. Approve critical-update/bulk-mail scope and retention before unsolicited sends or unnecessary delivery data.
- [ ] **03.11 VERIFY** Reset/deletion notices and destinations avoid enumeration. Expired/reused links fail safely; successful actions return to correct app/login state.

### 4. Native push notifications (deferred; separate approved pass)

Missing delivery implementation, not a credential-only task. Explicitly resume or exclude from launch claims.

- [ ] **04.01 DEFERRED** Obtain approval for APNs/FCM sender, event/channel policy, bounded retry/deduplication, cleanup and minimum metadata. The proposed per-event/device delivery ledger was NOT approved; do not introduce it silently.
- [ ] **04.02 BUILD** After approval, connect real Apple/Google delivery to token/preferences/revoke foundation with private server credentials and tenant/user/device targeting. Separate provider acceptance from device presentation.
- [ ] **04.03 OWNER** Agree events: sustained high temps, offline/recovery where approved, shift offers/swaps/approvals, schedule publication/changes, time off/availability, assignments and prep/list completion. Define urgency, departments, cooldown/quiet hours without floods.
- [ ] **04.04 VERIFY** High-temperature notification follows requested one-hour duration above 42 F with assigned name/temperature. Handle interrupted/stale readings, disabled rules and recovery; old stored data cannot produce a falsely current alert.
- [ ] **04.05 EXTERNAL** Configure real APNs/FCM projects, keys/environments/entitlements for the app ID. Test physical Android/iOS permission grant/denial, token refresh, reinstall, logout, revoked membership and multiple devices.
- [ ] **04.06 VERIFY** Test foreground/background/terminated delivery, safe lock-screen content, deep links, repeated events, provider outage, expired tokens, preference changes/account switching. No duplicate/cross-tenant push, tokens or HR contents in logs/messages.
- [ ] **04.07 DEFERRED** SMS needs separately approved provider, manager opt-in, separate consent/withdrawal, STOP/HELP, country/cost/abuse controls and qualified legal review. Consent storage does not implement delivery.
- [ ] **04.08 OWNER** Launch requires functioning approved alert scope or explicit removal of unsupported claims/expectations. Never present unimplemented notifications as sole food-safety protection.

### 5. Temperature hardware

Temperature hardware uses separate Arduino sketches: `firmware/arduino/CriminiTempNode/CriminiTempNode.ino` and `firmware/arduino/CriminiTempGateway/CriminiTempGateway.ino`. Firmware README is instructions, not a second checklist. Phase 5 hardware pass and Phase 5 remaining needs are tracked here.

- [ ] **05.01 VERIFY** Inventory actual firmware/API versions on bench/field devices. Preserve ESP32-C6 node/gateway targets, AHT20 temp/humidity only (no pressure), SDA18/SCL19, user-assigned serials, raw IEEE 802.15.4 and approved radio/antenna settings. No speculative protocol/board replacement.
- [ ] **05.02 VERIFY** Factory inventory, gateway credential hash, kit radio secret, serial reservation and tenant claim agree. Customer enters serial/name only. Distinguish missing factory inventory from subscription denial; credentials never appear in customer views.
- [ ] **05.03 VERIFY** `/staff/equipment` reservation/release and `/admin/sensors` claims are atomic/audited. Two tenants/concurrent claims cannot acquire one device. Test registered/revoked/unclaimed/reserved devices, new sensor expansion and wrong gateway association.
- [ ] **05.04 VERIFY** Gateway registration opens/focuses Wi-Fi guide in Registered Equipment: Connect to Gateway, Set Restaurant Wi-Fi, Check Connection. Owner reviews wording/layout on desktop/phone; no Bluetooth or developer-only credential setup.
- [ ] **05.05 VERIFY** Real protected gateway setup network/local browser page accepts 2.4 GHz SSID/password, tests before committing, and completes only after fresh authenticated cloud contact. Test incorrect password, hidden SSID, captive/isolation networks, interrupted setup/retry and returning phone/computer to normal Wi-Fi.
- [ ] **05.06 VERIFY** Saved-network failure follows documented ten-minute retry/setup fallback, preserves old credentials until success, closes setup correctly and resumes radio receive. API/TLS/time failures alone cannot open setup or expose credentials.
- [ ] **05.07 VERIFY** Wi-Fi credentials never enter D1/R2, Cloudflare/audit logs, email, browser storage or app bundles. Assess setup-network access/physical threat model without creating another customer key workflow.
- [ ] **05.08 VERIFY** Gateway uses real production `/api/temps`, verified TLS, bounded batches/requests, credential revocation and time sync. Actual sensor ingest reaches the registered business; 200/201 with accepted zero is not a reading-success signal.
- [ ] **05.09 VERIFY** Reject wrong tenant/gateway, unknown/revoked nodes, tampered/oversized packets, replay/out-of-order sequence, invalid timestamps/units/humidity/JSON. Node battery restart/sequence reservation and legitimate retransmission totals stay consistent.
- [ ] **05.10 VERIFY** Gateway keeps only bounded latest transient reading per node, not persistent history. Router/WAN/DNS/TLS/API/clock failures recover without manual power cycling. Idle gateway heartbeat cannot insert temperatures or freshen node timestamps.
- [ ] **05.11 VERIFY** Deep sleep and brief five-minute randomized authenticated bursts retain approved transmit power/retry limits. Test collisions at 16 nodes/planned 25 ceiling, duplicates and packet loss; no unbounded awake/retry path or claim power alone guarantees delivery.
- [ ] **05.12 VERIFY** USB upload/serial/debug remains consistently accessible on approved dev boards. Compile first; flashing requires permission. Never disable USB, impose recovery windows, erase flash or change eFuses as power optimization.
- [ ] **05.13 EXTERNAL** Measure actual assembled sleep/awake current, energy budget and battery life. Use user-selected hardware; converter/component redesign and custom boards are outside this pass, not an excuse for unapproved changes.
- [ ] **05.14 EXTERNAL** Real walk-in/freezer/wall/RF-interference tests use independent thermometer/calibration/placement checks and actual enclosure. Validate accuracy/suitability across requested roughly -15 to 100 F conditions; code cannot certify hardware range.
- [ ] **05.15 VERIFY** `/temper`, `/app`, `/admin`, `/admin/sensors`, Staff health/reports agree on names, latest temperature/humidity, timestamps and offline states. Ten-minute online UI cannot be freshened by gateway-only contact; old readings are historical, not current exceptions.
- [ ] **05.16 ASSESS** Resolve distinction between UI 30-41 F normal band, default 42 F high/32 F low rules, ten-minute online window and separate processor stale/offline timings. Confirm F/C conversion/wording with owner before changing defaults.
- [ ] **05.17 VERIFY** No acknowledgement workflow returns. Check approved offline warning, blue cold/green in-range/red hot indicator, high/low/offline/recovered states, one-hour high duration and cooldown without excessive retained events.
- [ ] **05.18 ASSESS** Raw readings currently have three-day cleanup eligibility. Verify hourly/daily/weekly rollups support requested reports; agree bounded aggregation/retention before promising weekly completeness or extending raw storage. Test missing hours/late data/cleanup.
- [ ] **05.19 VERIFY** Run 24+ hour bench/restaurant soaks through overnight router restart, gateway reboot, WAN outage, cold/range, quiet nodes and all-node bursts. Record real loss/recovery/current draw and tenant isolation, not manual-reset success.
- [ ] **05.20 EXTERNAL** Review actual shipped module/antenna/enclosure FCC obligations and production security. No source-only compliance/battery/encryption claims. Secure boot/flash encryption requires separate risk, USB/recovery and approval review.

### 6. Scheduling validation

- [ ] **06.01 VERIFY** `/admin/schedule?tool=builder` loads correct business/week/time zone; autosaved unpublished edits survive navigation/reload/relaunch. No Save Draft prerequisite or departure data loss.
- [ ] **06.02 VERIFY** Publish on newly edited week atomically validates/shares one version without manual save or 500. Employees keep prior published snapshot during editing; republish updates only intended week/version.
- [ ] **06.03 VERIFY** Double-click/retry/stale tab/concurrent manager cannot duplicate weeks/shifts or overwrite silently. Revision conflicts require safe reload handling; actual persisted history and employee view agree with builder.
- [ ] **06.04 VERIFY** Owners/managers are schedulable with clear department assignments. Tenant departments/schedule roles/positions are distinct from security permissions; selected assignments visibly persist and eligible managers can work their departments.
- [ ] **06.05 VERIFY** `/admin/schedule?tool=setup` supports tenant roles/departments, edit/delete/reference protection and permissions. No FOH/BOH-only hardcoding or old restaurant defaults; changing a label preserves shifts.
- [ ] **06.06 VERIFY** Department-scoped managers edit/review only allowed people/departments, including eligible managers. Deny unauthorized full-week publish, copied IDs and stale capabilities server-side.
- [ ] **06.07 VERIFY** `/schedule`, `/my-schedule`, Today/week cards show correct published employee shifts, dates and boundaries. Test owner-as-worker, no shifts, multiple departments and loader failures.
- [ ] **06.08 VERIFY** `/admin/schedule?tool=approvals` receives correct time-off/availability/person/department; authorized decisions affect employee views/warnings. Open/limited/unavailable corner colors and conflicts agree with saved availability.
- [ ] **06.09 VERIFY** Duplicate mode visibly enters/exits, copies only selected destination days in intended week, NEVER all future weeks. Disabled autofill remains disabled; copy-week/template effects are deliberate/bounded.
- [ ] **06.10 VERIFY** `/admin/schedule?tool=templates` saves/applies/replaces safely; `/admin/schedule?tool=labor` calculates rates/targets within scope. No bypass of conflicts/publish or false payroll/time-clock claims.
- [ ] **06.11 VERIFY** `/admin/schedule?tool=open-shifts` and employee pool cover offer/swap/bid/take/withdraw, competing claims, approval/rejection and assignment. No double booking or accepting outdated unauthorized shifts.
- [ ] **06.12 VERIFY** Overnight/midnight/week boundaries, DST, restaurant/device time zones, breaks, duplication arithmetic and inactive employees stay correct. Configurable warnings are not certified nationwide labor-law enforcement.
- [ ] **06.13 VERIFY** Picker/keyboard/phone back/cancel, large-grid overflow, modal stacking and footer clearance work. Time selection closes after commit; saved/published status reflects actual request completion.
- [ ] **06.14 VERIFY** Approved events/emails, dashboard, requests, labor totals, history, monthly requests and weekly exports reconcile after publish/correction/cancel. Phone delivery remains gated by phase 4.

### 7. Lists, docs, menus, recipes, and tools

Create, edit, delete, submit, upload, replace, attach, and export real data in each validation business. Confirm feature hiding, permissions, immediate UI updates, CSV safety, and tenant scoping. Source checks cannot substitute for acceptance.

- [ ] **07.01 VERIFY** `/admin/creator` is coherent editor for categories/lists/recipes/docs/menus/attachments. Empty categories link to actual creation; in-category edits default there rather than ambiguously asking again.
- [ ] **07.02 VERIFY** Names accept punctuation including parentheses; stable safe slugs avoid raw technical errors. Business-scoped uniqueness permits same names in different tenants; rename preserves child references.
- [ ] **07.03 VERIFY** Add/edit/delete persists, updates counts/items immediately, clears only successful editor and preserves fields on failure. Expanded descriptions, collapsed recipe addition and newest-item placement are usable.
- [ ] **07.04 VERIFY** `/lists`, `/lists/checklists`, `/lists/checklists/[section]` contain ONLY intended created checklists. No Opening/Midday/Closing expansion, duplicate titles/tabs, legacy redirects or unrequested reopen action.
- [ ] **07.05 VERIFY** `/lists/preplists`, `/lists/preplists/[section]` preserve amounts/notes/completion/submission and submitter/executor. Multiple editors cannot lose changes or duplicate submission batches.
- [ ] **07.06 VERIFY** `/lists/inventory`, `/lists/inventory/[section]`, `/lists/orders`, `/lists/orders/[section]` preserve units/amounts/snapshots/dates and tenant scope. Submission is one history entry, not multiplied lists/categories.
- [ ] **07.07 VERIFY** Requested two-week list/prep history captures submitter/executor and immutable contents efficiently. Renaming/deleting source items cannot corrupt history; longer retention needs approval.
- [ ] **07.08 VERIFY** Attach recipe/doc from both supported ends using category then record, replace/remove safely. Clicking item NAME reveals attached content directly without second recipe-title click; no wrong-business/hidden/private content leak.
- [ ] **07.09 VERIFY** `/recipes`, `/recipes/[category]` show saved recipes/category counts, ingredients/instructions and attachments. Save/parsing/units cannot silently drop content or choose wrong category.
- [ ] **07.10 VERIFY** `/docs`, `/docs/[slug]` support SOP/handbook/policy categories as implemented, upload/source preview/replace/download/delete and authenticated private media. No local-filesystem assumption causing serverless 500.
- [ ] **07.11 VERIFY** `/menu` and dashboard menu links show intended tenant uploads/order/visibility; replacements update immediately. PDFs/images work browser/native without public R2 exposure.
- [ ] **07.12 VERIFY** `/todo` assignment/completion and `/todo/log` preserve employees, overdue styling and allowed history. Keep original completion workflow; no reopen/uncomplete lifecycle added because of this PROJECT checklist.
- [ ] **07.13 VERIFY** `/whiteboard` submit/vote/one-vote rules/concurrent taps/order/moderation are attributed and scoped. Full clouds readable; no unrelated employee details exposed.
- [ ] **07.14 VERIFY** `/specials` replaces Highlights user-facing wording, single dashboard area and delegated non-manager posting. Defaults/individual grants agree; editing remains here, not duplicated elsewhere.
- [ ] **07.15 VERIFY** Announcements edit in manager area with allowed delegation/history/intended nine-month-or-delete retention; correct author/current content. Spotlight uses star/correct person; reminders have compact manager editor.
- [ ] **07.16 VERIFY** `/vendors` restricted read directory and `/admin/vendors` editor retain add/remove/edit navigation and add form below summary. Validate URLs/phones/details; confirm unwanted hidden-vendor workflow removed, no split-screen browsing.
- [ ] **07.17 VERIFY** `/conversions` and Tools use accurate cooking volume/weight units, fractions/rounding/decimals/input validation. No mass-to-volume conversion without density or confused US/other unit systems.
- [ ] **07.18 VERIFY** `/tools/food-cost` handles many ingredients, purchase size/price, compatible portion units, sale price, totals and explicit food-cost percentage/gross margin. Zero/negative/invalid data safe; gross margin is not net profit.
- [ ] **07.19 VERIFY** `/tools/safety-healthcode` has readable sourced cooking/holding/sanitation/handwashing guidance, no broken icon title. Recheck authoritative sources/local-code limitations before launch; no universal health-code guarantee.
- [ ] **07.20 VERIFY** `/tools/waste` enabled for ordinary users by default, records product/amount/unit/reason/actor/time safely, prevents double submit. Downloadable Waste Logs belong in Reports, not entry page.
- [ ] **07.21 VERIFY** All/management/off settings agree across creator, operational pages, sidebar/dashboard and actions. Vendors/reports restricted; disabling does not leave mutations active or delete history.
- [ ] **07.22 VERIFY** Refresh/relogin/second-device views show persisted data for every feature. Test deletion references, failures, copied IDs, abandoned forms and simultaneous users without overpolling/stale success banners.

### 8. Reports and exports

- [ ] **08.01 VERIFY** `/reports` exposes only authorized Prep/Checklist/Inventory/Orders/Waste/Schedule/Requests/Onboarding/Temperature/ToDo history. Managers/HR/consultants have intended scope; ordinary users cannot open privileged links directly.
- [ ] **08.02 VERIFY** `/reports/lists`, `/reports/lists.csv` group every list domain by full submission/batch with actor/executor/date and whole-entry export. Renamed/deleted source items cannot rewrite snapshots.
- [ ] **08.03 VERIFY** `/reports/schedule`, `/reports/schedule.csv` present published WEEKS/versions, not unreadable shift-entry stream. Readable exports include full intended week; requested roughly 18-month history needs explicit retention/legal policy, not assumed universal law.
- [ ] **08.04 VERIFY** `/reports/requests`, `/reports/requests.csv` give monthly request status/department scope; `/reports/onboarding`, `/reports/onboarding.csv` give monthly packet status without bank/tax/ID payloads.
- [ ] **08.05 VERIFY** `/reports/waste`, `/reports/waste.csv` preserve submission/date range/units/author/reason. Orders weekly; prep/checklist/inventory grouped by submission.
- [ ] **08.06 VERIFY** `/reports/temperature`, `/reports/temperature.csv` give hourly per-node averages/daily-weekly grouping/units/missing samples. Close phase 5 rollup/raw-retention decision before claiming weekly completeness.
- [ ] **08.07 VERIFY** Native previews equal full CSV filters/totals/headers/order/versions/time zones. 100-row display cap is not export cap; bounded/streamed large ranges cannot exhaust Worker resources.
- [ ] **08.08 VERIFY** All outputs are spreadsheet-safe CSVs: formula protection, quotes/newlines/Unicode, readable dates/units/filenames and validated filters. No hidden secrets/HR or crossed tenants through joins.
- [ ] **08.09 VERIFY** Browser/Android/iOS preview/share/download/back/loading/empty/error states work. Revocation removes report/media access and private cache content.

### 9. Invite, onboarding, and HR

Legal/payroll review is still required. A functioning packet workflow is not legal certification or a full payroll service.

- [ ] **09.01 VERIFY** Test owner, manager, employee, consultant, and contractor invite flows: permissions/departments/classification/expiry/revoke/resend/single-use/concurrency. Existing accounts/memberships must not duplicate identities or merge businesses.
- [ ] **09.02 VERIFY** Confirm employee/manager invite registration skips business pricing/manual codes and retains inviting business/role. Optional owner packet and contractor exemption are deliberate choices, not one mandatory worker packet for all.
- [ ] **09.03 VERIFY** Employee flow is logo Welcome, Let's get started, name/birthday, address, contact/password/consent and final welcome/download/browser options. Every applicable slide has Continue; state/country selectors and desktop/mobile layout match approved light theme.
- [ ] **09.04 VERIFY** Validation stays on its slide, preserves completed information and clears unsafe/password fields only as needed. Ten-character password failure cannot restart onboarding/repeat on every slide; personal email/phone/password remain usable credentials.
- [ ] **09.05 VERIFY** Personal details hydrate correct profile and applicable packet status, not Pending despite completed submission. Map actual name/birthday/address/contact and collected emergency data/consent to schema; never mark uncollected emergency information complete.
- [ ] **09.06 VERIFY** Purchaser follows agreed personal slides then business name/address/logo, contact/optional SOP-handbook-doc uploads, menu, necessary business configuration and platform options. Optional personal/business uploads skippable; required account/consent/billing eligibility not bypassed.
- [ ] **09.07 VERIFY** Individual name/title/contact/credentials versus business address/logo/contact/time zone persist to correct records and confirmation email. Owner personal/HR optional; tenant-defined departments replace forced restaurant defaults.
- [ ] **09.08 VERIFY** Successful registration has branded welcome, proper sign-in/session destination and approved one-time tour. No empty Create Account page, marketing bounce, duplicate-login 500, repeated tour or profile trap. Interrupted/reused invite recoverable.
- [ ] **09.09 VERIFY** Invited users with active packet receive nonblocking Profile & Settings prompt/email link to `/onboarding`; without packet enter normally. HR completion never prevents otherwise authorized feature access.
- [ ] **09.10 VERIFY** `/admin/onboarding?view=invites`, `/admin/onboarding?view=packets`, `/admin/onboarding?view=forms`, `/admin/users?view=hr` form coherent employer workspace. Concise Forms wording distinguishes uploaded sources from employee submissions and permits active-form preview.
- [ ] **09.11 VERIFY** Employer configures applicable federal/state forms, policies and custom items; tenant preferences override defaults. No claim automatically supplied government PDFs are current/legal for every employee based only on restaurant state.
- [ ] **09.12 VERIFY** Packets support send, completion/upload/signature as implemented, submission, review, corrections/resubmission and acceptance. Accepted version saved to employee record; later sensitive changes require replacement packet, not free edits on Profile.
- [ ] **09.13 ASSESS** Confirm exactly which forms are fillable/signable in-app versus official PDFs completed/uploaded. Complete both user paths without claiming unsupported PDF autofill/e-signature or adding unexplained extra manual steps.
- [ ] **09.14 EXTERNAL** Qualified nationwide/state HR/legal review covers I-9 employee/employer duties, permitted examination/copy procedures, current W-4/state forms, electronic signatures, identity documents, deposit authorization and retention. Do not encode an incorrect universal physical-copy requirement.
- [ ] **09.15 VERIFY** Bank/tax/ID fields/media use private authenticated encrypted storage, versioned keys and audited need-to-know access. Test employee self, authorized HR, manager without HR, consultant/contractor, removed person and crossed file IDs. No sensitive payload in ordinary directory/reports/platform Staff.
- [ ] **09.16 VERIFY** `/admin/users?view=overview`, `/admin/users?view=team`, `/admin/users?view=access`, `/admin/users/[id]` provide search/details/departments/positions/clear permissions. No duplicate editors, vague Restrict Access or session debug listings.
- [ ] **09.17 VERIFY** Tenant positions/presets override defaults and allow individual changes. Managers get ordinary operational authority; owner controls higher access. Explicit `manage_managers` and required approval protect removal of managers/final owner; no silent self-promotion.
- [ ] **09.18 VERIFY** Invite/manage/review/sensitive-read/billing/schedule/report remain separate capabilities. Exercise grants/restrictions, same-business changes, delegated announcement/special access, scoped contractors/HR and stale sessions.
- [ ] **09.19 VERIFY** Email/SMS choices initially unselected, separate Yes/No, refusal allowed. Store disclosure version/source/time and changes; withdrawal excludes optional delivery immediately. Counsel approves text/essential-email distinctions; phase 4 still gates SMS.
- [ ] **09.20 VERIFY** Employee remove/deactivate/delete/invite-revoke cannot 500, bounce to marketing or delete another membership. Access ends immediately, history/HR retention follows policy, consumed links cannot recreate unintended accounts.

### 10. Authentication and account lifecycle

- [ ] **10.01 VERIFY** `/login`, `/logout`, `/forgot-password`, `/reset-password/[token]`, `/register`, `/register/welcome`: browser/native valid/invalid credentials, already signed-in/duplicate login, alternate account, correct redirects/tenant and expired cookies. No silent tap or success-then-500.
- [ ] **10.02 VERIFY** Login attempts are rate-limited; reset/invite/signup limits allow reasonable shared restaurant-IP use and useful cooldown/recovery. Configured Turnstile server validation fails closed and works on native origins; do not remove protection for one tester.
- [ ] **10.03 VERIFY** Current password hashing/pepper versions create/verify/reset/upgrade supported legacy accounts within Workers limits. No bulk reset, weakened KDF, exposed pepper or scheme replacement based on one login error.
- [ ] **10.04 VERIFY** Session cookies/expiry/rotation/revocation, logout, inactive accounts, password/membership changes and switching enforced on SSR/data/action/API. Native cookies, browser Back and cached content cannot revive revoked access.
- [ ] **10.05 VERIFY** Reset/invite/signup tokens have correct purpose/expiry/binding/reuse denial; responses avoid enumeration. Allowlist redirect origins; preserve link context without referrer/analytics/log leakage.
- [ ] **10.06 VERIFY** `/login?staff=1` asks password once/auto-sends OTP, then gates ALL Staff reads/actions at `/staff/security`. No internal nav/restaurant metadata before verification; resend no password/arrow or recipient tampering.
- [ ] **10.07 VERIFY** Staff OTP expiry/attempt cap/cooldown/rate, provider failure, resend/replay/cross-session denial, membership/password/email changes, rotation/audit rollback work. Password/email allowlist alone cannot open console.
- [ ] **10.08 VERIFY** Staff eight-hour reads/fifteen-minute sensitive writes, fresh proof/signout/revoked tabs/devices/direct GET/POST/data work in DuckDuckGo desktop/mobile. Do not restore dual-password or passkey/authenticator design.
- [ ] **10.09 VERIFY** Staff email change requires recent OTP/password/new-mailbox code, old notice and proof invalidation. Operator change uses confirmed identity/address/revision/audit and approval, not restaurant-email modification or bypass.
- [ ] **10.10 OWNER** Approve/rehearse independent sole-owner Staff recovery/compromise response for lost mailbox/session or revoked account. No hidden public reset, unaudited SQL shortcut or platform self-enrollment.
- [ ] **10.11 VERIFY** Web/in-app deletion request/confirmation covers identity, owner transfer, subscription notice, legal retention, revocation, media cleanup/completion email. Account deletion, tenant removal and cancellation are different operations.
- [ ] **10.12 VERIFY** Sensitive vault authenticated AES-GCM, nonce uniqueness, key versions, authorization and restore/rotation work without plaintext exposure. Wrong/missing key fails safely; pepper/key loss has approved recovery plan.
- [ ] **10.13 VERIFY** SQL injection/stored-reflected-DOM XSS review includes every field class, search/rich text/filename/URL/CSV/Staff/support. Prove SQL parameters/identifier allowlists, escaping and any HTML sanitization with hostile inputs and actual rendering.
- [ ] **10.14 VERIFY** OWASP-relevant IDOR/function-level auth/mass assignment/CSRF/native origins/CORS/open redirects/SSRF/upload/session fixation/headers/CSP/info disclosure are assessed. Preserve necessary native/service paths; WAF/encryption alone do not prove safety.
- [ ] **10.15 VERIFY** Private media reads/writes/replacements/deletes enforce business/HR purpose, MIME/size/path checks, safe content headers/no-store. Safely test malformed/encrypted PDF/images and external-resource parsing behavior.
- [ ] **10.16 VERIFY** Audit logs store hashed email/IP/user-agent identifiers where appropriate and safe allowlisted metadata, never passwords/tokens/HR/raw provider errors. Access/retention approved; anonymous probes cannot force unbounded telemetry writes.

### 11. Billing and store subscriptions

Current implemented prices: Small $29, Medium $49, Large $69/month; monitoring optional $17/month includes 12 active sensors, $2 each above 12. Requested Large $79/included-monitoring and calculated catalog changes remain deferred until tenant testing finishes; no silent pricing edits during cleanup.

- [ ] **11.01 VERIFY** `/billing`, business links/roles/server entitlements agree. Only billing-authorized users buy/manage; invited employees do not pay again. Client plan/role/count cannot grant access.
- [ ] **11.02 EXTERNAL** Configure actual Apple/Google accounts, banking/tax agreements, app IDs/catalog. Existing products include `crimini.plan.small.monthly`, `crimini.plan.medium.monthly`, `crimini.plan.large.monthly`, `crimini.addon.temps.monthly`; credentials private.
- [ ] **11.03 VERIFY** Purchase stays pending until provider verifies correct app/environment/product/customer. Test forged/reused/other-tenant receipts and concurrent activation; successful client callback is not entitlement.
- [ ] **11.04 VERIFY** Renew/restore/upgrade/downgrade/cancel/expire/refund/revoke/grace/hold/past-due and repeated/out-of-order webhooks reconcile access without lost data/duplicate events.
- [ ] **11.05 VERIFY** `/api/billing/products`, `/api/billing/status`, `/api/billing/native-purchase`, `/api/billing/app-store-notifications`, `/api/billing/google-play-notifications` enforce correct session/token/provider validation and limits. Reject replay/cross-tenant/invalid environment/signature without token leakage.
- [ ] **11.06 VERIFY** Unpaid/expired tenant blocked from operational pages/actions/media/APIs except intended billing/recovery/legal surfaces. Paid-tenant invites/pilot exception work. Public store installation is not operational access; cannot promise stores prevent every noncustomer download.
- [ ] **11.07 VERIFY** Public trial disabled; future trial separately approved at requested seven days, never thirty. Trial identity claims prevent reuse where retained; verify privacy basis rather than deleting anti-abuse protection accidentally.
- [ ] **11.08 DEFERRED** After testing/owner confirmation: Large $79 includes 12-sensor monitoring; Small $29/Medium $49 optional $17 monitoring. All base features follow approved size tiers; no obsolete mid/high-only sensor rule.
- [ ] **11.09 DEFERRED** Self-service quote 1-12 sensors, 13-25 add $2 each above 12, 25/location ceiling; larger requests contact support for equipment/gateway placement/possible onsite review. Show hardware/install separately from recurring software.
- [ ] **11.10 DEFERRED** Approved Apple/Google variants/server mapping yield ONE selected monthly total, not dozens of visible options. Receipt determines entitlements; count changes/downgrades supported without arbitrary client-defined store pricing.
- [ ] **11.11 VERIFY** Before revised pricing activation, align onboarding quote/pricing/features/FAQ/legal/native/receipts/limits/support and store price-change rules/existing subscribers. No marketing-only price change.
- [ ] **11.12 VERIFY** Cancellation/deletion has approved pre-purge snapshot/notices/recovery/retention. Store cancel is not account deletion; expiry cannot erase retained HR/history or other tenants' shared identities.

### 12. Native app release

- [ ] **12.01 VERIFY** Actual packaged Android/iOS production clients/API transport, not temporary URL-only workaround. Rebuild matching assets; web Git deployment does not update installed binary.
- [ ] **12.02 EXTERNAL** JDK/JAVA_HOME, SDK/Gradle/target requirements, Android release signing/backup/app ID/version/build checked. No committed keys or phone installation without approval.
- [ ] **12.03 EXTERNAL** macOS/Xcode iOS distribution/provisioning/bundle ID/entitlements/version/build. Android/static iOS checks are not an iOS release build.
- [ ] **12.04 VERIFY** `.svelte-kit/cloudflare` and `mobile-dist`/`.svelte-kit/native` isolated through build/sync. Version mismatch/transient server/form errors recover without reload loops or overwriting web artifacts.
- [ ] **12.05 VERIFY** Physical Android/iOS: invalid/valid login, Turnstile, cookies/session/relaunch/logout/expiry/reset/invite/purchaser/profile/account switching. No silent tap or success-then-500.
- [ ] **12.06 VERIFY** Every visible sidebar/manager/report/Tools route/query tab: back/gesture/dialog/external/store links and roles/features/billing. Native/browser retain correct tenant/auth context.
- [ ] **12.07 VERIFY** Email/invite/reset/packet/support/notification deep links land safely after auth. Web fallback works without app; expired link recoverable, no token leakage or marketing/onboarding restart.
- [ ] **12.08 VERIFY** Supported file pickers/uploads, PDFs, document replacements, CSV downloads/share/app switching use correct permissions. File-camera picker does not restore surveillance subsystem.
- [ ] **12.09 VERIFY** Run content/list creation/submission, schedule/requests, specials/whiteboard/votes, ToDo/vendors/tools/reports/equipment/profile/HR on real phones. Compare persistence after kill/relaunch and second device.
- [ ] **12.10 VERIFY** Slow/offline/timeout/airplane/background/terminated/interrupted save-upload/double tap retain safe fields and recover without duplicate actions or fabricated offline save.
- [ ] **12.11 VERIFY** Keyboard/scroll/footer/safe areas/font scaling/orientation/fold on Razr/representative iOS; persisted theme, contrast and system-UI clearance.
- [ ] **12.12 VERIFY** Real purchase/restore/manage, push registration/approved delivery, deletion/support/privacy work on release-like physical builds. Debug compilation is not store clearance.
- [ ] **12.13 VERIFY** Navigation origins/TLS/bridge/native CSRF scope/WebView debug-release settings/permissions/backups/logs reviewed. Scan native assets for secrets and align disclosures.

### 13. Store submissions

- [ ] **13.01 EXTERNAL** Apple: app record, agreements/IAP, release binary, App Store Connect metadata, TestFlight, screenshots, privacy disclosures/manifests, required-purpose APIs, support/privacy/deletion URLs, review account/notes.
- [ ] **13.02 EXTERNAL** Google Play: app record, subscriptions, signed bundle, target/API policy, internal testing/required testing period, Data Safety, content rating/deletion URL, screenshots/metadata/review account/notes.
- [ ] **13.03 VERIFY** Check CURRENT official Apple/Google policies at submission for SaaS/IAP, account access/deletion/login, minimum functionality, permissions, workforce/HR data/hardware. No approval promise from old rules or assumed social-login mandate without applicability review.
- [ ] **13.04 VERIFY** Restricted review account uses authorized tenant/nonsensitive examples and explains paid/invite/hardware features. No platform Staff access, real HR, internal token or unlimited public billing bypass.
- [ ] **13.05 VERIFY** Store screenshots/features/pricing/privacy/permissions/notification claims match release. No camera or unsupported SMS/push/compliance claims unless completed/approved.
- [ ] **13.06 EXTERNAL** Real Apple/Google sandbox purchase/renewal/restore/refund/release-device tests; address review feedback with regressions. Owner controls signing/provider credentials/staged release/recovery.

### 14. Cloudflare edge security and observability

Includes remaining Staff maintenance work; existing dashboard/support does not authorize customer interventions.

- [ ] **14.01 EXTERNAL** Managed WAF rules/OWASP where available/auth rates/challenges/usage alerts configured. Cover login/register/reset/deletion without breaking shared restaurant networks or native login.
- [ ] **14.02 VERIFY** No browser challenges on billing webhooks, `/api/temps`, `/api/internal/schema-readiness`, `/api/internal/temperature-monitoring/process`, `/api/internal/operational-events/process`. Verify service auth/method/size/denial and no public internal diagnostics.
- [ ] **14.03 VERIFY** Structured Logs and Alert Targets include `schema_readiness_failed`, `tenant_access_denied`, `billing_conversion_failed`, `billing_cancel_failed`, repeated 500s, media/device-auth/provider/dispatcher/deploy failures. Alert watchlist has real thresholds/destinations/response owner, not just log statements.
- [ ] **14.04 VERIFY** Staff owner/support/equipment/nonstaff and direct route/actions enforce least privilege. Test revoked/inactive/stale membership, last-owner protection, audit rollback and devices/tabs. Restaurant manager is not platform Staff.
- [ ] **14.05 VERIFY** `/staff` remains aggregate overview, not per-restaurant task dump. Period/tenant filters, gapped issue-versus-tenant trends, gateway attention and Quick Access reflect observed data, not invented uptime/CPU/traffic.
- [ ] **14.06 VERIFY** Business search/cursors handle equal/non-ASCII names/new arrivals; `/staff/businesses/[id]` Overview/Application/Equipment/Security/Staff Activity load only authorized selected context. No unrelated names, HR, purchase tokens or device credentials.
- [ ] **14.07 VERIFY** `/staff/health` bounded readonly gateway/queue metadata/manual refresh; equipment-only role denied delivery details. Test empty/failed/retrying/expired/delayed jobs, future/never-connected contact. No raw bodies/recipients/retry buttons/dispatch triggers/polling.
- [ ] **14.08 VERIFY** Request Help on `/support`, Staff queue/detail, restaurant replies and staff-recorded phone/email requests handle allowed status/internal notes, stale revisions and duplicates. Test same-business different requesters; internal notes never leak. Check only actually supported attachments, not assumed upload functionality.
- [ ] **14.09 OWNER** Approve support visibility, retention/export/deletion, sensitive-content guidance and response process. Keep minimum necessary records without inventing legal retention or destroying required evidence.
- [ ] **14.10 VERIFY** Staff team/activity/equipment/security mutations require reason/recent proof/revision/atomic audit. Platform revocation cannot alter restaurant memberships/passwords/subscriptions/device assignments.
- [ ] **14.11 OWNER** Separately design lawful interventions: actor/customer authorization/purpose/minimum data/confirmation/audit/reversal/escalation. Suspension, tenant-session revocation, content takedown, entitlement override, impersonation and HR access NOT implemented or approved by this checklist.
- [ ] **14.12 VERIFY** Best-effort diagnostics cannot change app response/cookie/operation. Group/sample safely; no bodies/query values/raw errors/secrets, unbounded maps or per-anonymous-probe D1 writes; tenant deletion behaves correctly.
- [ ] **14.13 VERIFY** Observe hourly indexed bounded cleanup of seven-day metrics/fourteen-day inactive issues. Preserve account/Staff audits; failures safe, no endless batches/full tenant sweeps.
- [ ] **14.14 ASSESS** Measure many-business dashboard/search/queue/health query plans/row budgets/cursor stability. Bounded hourly buckets/tab-specific loaders, no tenant-content N+1/global scans. Logs/queue status are not independent monitoring.
- [ ] **14.15 DEFERRED** CPU/D1/R2/external monitoring integration needs scoped read-only credentials, cost/retention approval and real mappings. Missing infrastructure charts remain explicitly unavailable, not fabricated.
- [ ] **14.16 EXTERNAL** Backup And Restore: rehearse hosted D1 restore, R2 recovery, compatible app rollback/forward fix and secret recovery on approved isolated target. SQLite row-preserving rehearsal does not complete Cloudflare disaster recovery.
- [ ] **14.17 OWNER** Approve practical sole-owner recovery, Staff compromise/customer incident/breach response, credential rotation/revocation and audit access/export. Distinguish containment authority from unapproved interventions.
- [ ] **14.18 VERIFY** Set and monitor Worker/D1/R2/request/storage/provider cost/resource budgets for pilot/growth. Track errors/timeouts/row reads; scaling requires measurements, not clean-code claims.

### 15. UI and accessibility final pass

Phase 0 resolves design/workflow gaps first. This is final cross-product regression, not another redesign.

- [ ] **15.01 VERIFY** Every phase-0 route/query tab at desktop/small-desktop/mobile/large-font/fold sizes. Light/dark app, light-only marketing and dark Staff restore preferences without cross-shell contamination.
- [ ] **15.02 VERIFY** Keyboard/focus/labels/errors/screen-reader states/reduced motion/contrast/touch targets/disabled-loading states. Underlined word buttons keep semantics and clear destructive/active states.
- [ ] **15.03 VERIFY** Long names/ideas, empty/full histories, many staff/nodes/categories, dropdowns/modals/expanded forms don't clip. Footer clear of schedule, sidebar always reachable, direct/back navigation selected tabs correct.
- [ ] **15.04 VERIFY** Marketing logo is OWN carousel image slide, never overlay; no caption/CTA/dots on logo slide, approved clean controls/fades without dark artifacts/hard edges. Body logo/white background/matching header; no marketing dark toggle.
- [ ] **15.05 VERIFY** Features/how-it-works/pricing/onboarding previews/tour/FAQ/startup guide describe actual purchaser/invite/packet/features. Current real-app screenshots with consistent walkthrough sizing, no fake preview routes.
- [ ] **15.06 VERIFY** User's actual footer legal/about/support/privacy/terms/deletion destinations work with proper app/public context/theme; no redundant operational links or marketing-home bounce. Never expose private state.
- [ ] **15.07 VERIFY** Logos/favicons/app icons/mushroom backgrounds/loading/spotlight star and asset licenses correct. Remove only unused chicken-leg/fries/whisk/knife assets/references; no unapproved generated SVG replacements.
- [ ] **15.08 OWNER** Actual visual/copy acceptance of onboarding, all manager subpages, People/HR, reports, equipment Wi-Fi, Staff and footer/legal surfaces. Record remaining corrections here; automated checks cannot approve aesthetics.

### 16. Legal, public site, and business readiness

- [ ] **16.01 EXTERNAL** Complete trademark/LLC/copyright/business-ownership work and owner launch approval. Online-domain controlled testing permitted; public tenant creation remains closed until authorized.
- [ ] **16.02 EXTERNAL** Qualified review of privacy/terms/billing terms/account deletion/support contact, cancellation/refund/trial language, hardware/service limitations, data ownership/retention. Use actual company/contact data, no copied placeholders.
- [ ] **16.03 EXTERNAL** Nationwide/state-specific workforce/privacy/sensitive data/breach/retention/e-sign obligations matched to actual launch scope. Minimize protected data; future POS/payroll/payment-card services need separate compliance, not claims they exist now.
- [ ] **16.04 EXTERNAL** HR/payroll review accepts packet/I-9/W-4/state form/employer duties/access/retention before real SPPI. Uploaded PDFs/acknowledgements cannot be advertised as verification they do not perform.
- [ ] **16.05 EXTERNAL** Consent/transactional versus optional email/future SMS qualified review includes withdrawal/notices/service exceptions. Checkbox/email OTP is not proof of all legal/security compliance.
- [ ] **16.06 VERIFY** Public/store/docs match tested enabled scope. Temps not guaranteed regulatory compliance; safety guide defers to local code/labels; unavailable integrations clearly unavailable.
- [ ] **16.07 OWNER** Approve support/over-25-sensor equipment-placement/onsite-review/fulfillment/replacement/incident/service process. No promise of onsite service/legal advice/support the business cannot provide.
- [ ] **16.08 VERIFY** Privacy/Data Safety/store answers reflect actual D1/R2/email/push/diagnostic/support processing, permissions/subprocessors/retention/deletion, and restricted Staff access without unapproved HR access.

### 17. Launch candidate

No blocking security, isolation, data-loss or legal issue is closed by smoke alone. External/deferred items require completion or explicit scoped exclusion, never a false done status.

- [ ] **17.01 OWNER** Freeze features; classify every unchecked task as evidenced complete, blocker or approved post-launch exclusion. Explicit notification/pricing/Staff-intervention/infrastructure decisions; deferral is not implementation.
- [ ] **17.02 VERIFY** Full end-to-end with two controlled businesses then intended three-restaurant pilot: signup/invite/profile/packet, content/menus/lists, autosave/publish/requests, tools/waste/reports, devices, approved email/push, billing/removal.
- [ ] **17.03 VERIFY** Generate method/action coverage from ACTUAL 76 pages/68 page-server files/layouts/hooks/query tabs. Test anonymous/owner/manager/employee/HR/consultant/contractor/platform roles and direct data/filter/copied-ID isolation, not merely every visible menu link.
- [ ] **17.04 VERIFY** Fresh dependency/security review and hostile-input/authorization regression on exact release; resolve applicable high/critical and obtain residual-risk disposition. No zero-vulnerability or Toast-equivalent assurance without independent evidence.
- [ ] **17.05 VERIFY** Sweep all 20 endpoints: five billing; `/api/documents/media/[...key]`; three internal; `/api/push/register`, `/api/push/revoke`; `/api/temps`; `/api/whiteboard`; six CSV; `/workspace/switch`. Test allowed/denied methods/session/service auth/business/feature/entitlement/limits/errors. Include server-only `/logout` and intentional `/welcome` redirects.
- [ ] **17.06 VERIFY** Approved realistic load/concurrency: roughly 40 pilot users/multiple managers/growing tenants/content/16-25 nodes where applicable. Measure latency/Worker CPU-memory/D1 plans-rows/R2/polling/duplicates/errors; fix without dropping features or spamming providers.
- [ ] **17.07 VERIFY** Full static/local runtime/behavior gates, final web/native builds/sync/release checks and actual Android/iOS compile. Clean Linux-targeted npm install on pinned Node/npm/lock; reproduce Cloudflare install, not stale node_modules success.
- [ ] **17.08 VERIFY** Matching native/backend/service-worker cache isolation, no debug/secrets in artifacts, signing/version/permissions, upload/download/deep-link/error behavior. Phone install requires approval; web push alone doesn't update binaries.
- [ ] **17.09 VERIFY** Review full diff/untracked/generated/dependency/migration state. Backup/rehearse needed migrations, compatible app/worker/schema order, then verify foreign keys/counts. No unrelated files or destructive cleanup.
- [ ] **17.10 VERIFY** Push validated commit/deploy Pages and changed dispatcher/config; verify successful stages/hash/bindings/migrations/cron. No pending migrations, mismatched source or assumption installed native app auto-updates.
- [ ] **17.11 VERIFY** Exact-production live schema/smoke/logout and approved actual-message inbox checks plus role/tenant denial. Observe Staff/gateway/cron without retaining secrets or unnecessary raw logs.
- [ ] **17.12 VERIFY** Physical Android/iOS and actual deployed restaurant acceptance, second-tenant isolation, overnight gateway/outage soak, concurrent publishing/uploads/reports. Failed cases return to owning task before clearance.
- [ ] **17.13 OWNER** Approve limited pilot/lawful real-data entry/launch limits/eventual public-store release. Store approval/legal timing/public signup are separate decisions; no automatic signup/trial activation on successful deploy.
- [ ] **17.14 VERIFY** Owner can operate monitored alerts/backups/restore/rollback/provider-store ownership/support/incidents/ongoing patches/cleanup. Monitor pilot before expansion; retain this single active completion record.

## Task Evidence And Cursor

- Current cursor: **00.02 - page/navigation/workspace review**; finish validation/release of the demonstrated 00.03 control-state correction before expanding edits. Full Phase 0 and authenticated Staff owner review remain open.
- First UI batch, 2026-11-07: complete `test:static` and `build:native` passed on pinned Node 22.23.4, zero type errors/warnings; native build preserved web artifacts. Source diff is limited to manager control styling/accessible selected state and its regressions; no backend/SQL/migration/firmware change. The initial sandbox run was blocked at the isolated schema-runtime module resolver; the authorized unrestricted rerun passed the full suite without changing application logic. Push/deployment/live-control evidence must be recorded before declaring this correction released.
- Consolidation verified 2026-11-07: 241 unique sequential tasks in 18 ordered phases; all 76 rendered pages, 68 page-server files, 20 endpoints and manager navigation query tabs represented. All 15 documentation-dependent source-check scripts passed (382 assertions), plus the production-schema documentation assertion. Duplicate matrices/obsolete README gate-camera-smoke instructions removed; `git diff --check` passed. These checks validate documentation coverage/compatibility, not new runtime acceptance. No app rebuild, live smoke, production DB operation, credential change, firmware flash or phone installation was performed for this documentation-only pass.
- On completion, tick the owning task and append brief dated evidence there with commit/environment and limitations. Do not create another completion report, duplicate phone matrix, or silently renumber phases.
