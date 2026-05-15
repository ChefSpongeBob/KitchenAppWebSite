# Test Readiness Checklist

Use this before big feature passes, GitHub pushes, and launch deploys.

## Automated Gates
- [ ] `npm run check`
- [ ] `npm run build`
- [ ] `npm run mobile:check`
- [ ] `npm run test:tenant-authority`
- [ ] `npm run test:tenant-isolation`
- [ ] `npm run test:iot-device-auth`
- [ ] `npm run test:media-access`
- [ ] `npm run test:production-schema`
- [ ] `npm run test:scale-performance`
- [ ] `npm run test:auth-abuse`
- [ ] `npm run test:billing-lifecycle`
- [ ] `npm run test:store-release`
- [ ] `npm run test:cloudflare-readiness`
- [ ] `npm run test:security-headers`
- [ ] `npm run test:observability`
- [ ] `npm run smoke:local`
- [ ] `npm run smoke:prod` after deployment

## Cloudflare Baseline
- [ ] D1 production binding is `DB = crimini-production`
- [ ] R2 document binding is `DOC_MEDIA = crimini-doc-media`
- [ ] R2 camera binding is `CAMERA_MEDIA = crimini-camera-media`
- [ ] `APP_BASE_URL=https://criminiops.com`
- [ ] `SMOKE_INTERNAL_TOKEN` is set for schema and smoke checks
- [ ] `npm run schema:readiness:prod` passes
- [ ] Latest required migrations through `0063_employee_compliance_onboarding_link.sql` are applied

## Local Smoke Setup
Start the local dev server first:

```sh
npm run dev
```

Then run the smoke check in a second terminal:

```sh
npm run smoke:local
```

Authenticated route checks need one of these:

```sh
$env:SMOKE_INTERNAL_TOKEN='local-token'
$env:SMOKE_EMAIL='localadmin@softwarekitchennns.test'
npm run smoke:local
```

or:

```sh
$env:SMOKE_EMAIL='localadmin@softwarekitchennns.test'
$env:SMOKE_PASSWORD='your-local-password'
npm run smoke:local
```

## Public Marketing
- [ ] `/`
- [ ] `/features`
- [ ] `/how-it-works`
- [ ] `/pricing`
- [ ] `/about`
- [ ] `/register`
- [ ] App store/download badges visible where expected
- [ ] Register/free trial/create workspace routes land in the full-screen onboarding flow
- [ ] Mobile layout does not overflow horizontally

## Auth
- [ ] `/login` opens
- [ ] Existing-session continue works
- [ ] `Not you?` clears session
- [ ] Wrong password shows a page error, not a 500
- [ ] Successful login lands in `/app`
- [ ] Logout clears session
- [ ] Forgot password page opens

## App Shell
- [ ] Marketing pages use only top marketing nav
- [ ] App pages use app/sidebar navigation
- [ ] Admin user sees admin navigation
- [ ] User account does not see admin-only controls
- [ ] Light mode and dark mode text/icon contrast are readable

## Admin Core
- [ ] `/admin`
- [ ] `/admin/app-editor`
- [ ] `/admin/creator`
- [ ] `/admin/lists`
- [ ] `/admin/documents`
- [ ] `/admin/recipes`
- [ ] `/admin/users`
- [ ] Feature hide/restrict/show modes behave correctly
- [ ] Business registry expands/collapses correctly

## Employee Invites And Onboarding
- [ ] Admin creates an invite with role and employment details
- [ ] Invite acceptance ties the user to the correct business
- [ ] Invite acceptance creates/updates the employee employment record
- [ ] Required onboarding package is created for the employee
- [ ] Employee sees onboarding under Profile & Settings
- [ ] Employee submits personal information
- [ ] Employee submits emergency contact
- [ ] Employee submits payroll setup item
- [ ] Employee submits employment eligibility item
- [ ] Employee submits tax withholding item
- [ ] Employee acknowledges handbook/policy item
- [ ] Admin approves an onboarding item
- [ ] Admin sends an item back for changes
- [ ] Approved package changes employment status to active
- [ ] Compliance document rows exist for onboarding items
- [ ] Sensitive vault placeholders exist only for tax, bank, and identity buckets
- [ ] Normal users cannot access admin onboarding review
- [ ] Admin cannot see another business onboarding records

## Scheduling
- [ ] `/admin/schedule` loads
- [ ] Add employee to week
- [ ] Create shift
- [ ] Duplicate shift to another day
- [ ] Save draft
- [ ] Copy previous week
- [ ] Publish week
- [ ] `/schedule` shows only published schedule
- [ ] `/my-schedule` shows assigned shifts
- [ ] Offer shift
- [ ] Request offered shift
- [ ] Manager approve/decline offer
- [ ] Availability warning appears when appropriate
- [ ] Time-off warning appears when appropriate

## Lists And Creator
- [ ] Create list/preplist/order/inventory category in admin creator
- [ ] Created category appears in matching app page
- [ ] Add item
- [ ] Edit item
- [ ] Delete item
- [ ] Submit prep counts
- [ ] Toggle checklist item
- [ ] Reset checklist

## Documents
- [ ] Create document category
- [ ] Empty category appears in `/docs`
- [ ] Upload document
- [ ] Open document
- [ ] Delete document

## Menus
- [ ] Upload menu from `/admin/menus`
- [ ] Menu title is editable
- [ ] Replace uploaded menu file
- [ ] `/menu` shows uploaded menus
- [ ] App homepage menu tile reflects uploaded menus

## Recipes
- [ ] Create recipe category
- [ ] Add recipe
- [ ] Open recipe category
- [ ] Edit recipe
- [ ] Delete recipe

## Operations Pages
- [ ] `/todo`
- [ ] `/whiteboard`
- [ ] `/temper`
- [ ] `/meeting-notes`
- [ ] `/menu`
- [ ] `/specials`
- [ ] API polling does not spike requests while tab is hidden

## Temperature Sensors
- [ ] Admin provisions a sensor device in Camera & Sensors
- [ ] Device key is shown only once
- [ ] Test device POSTs to `/api/temps` with `x-device-id` and `x-device-key`
- [ ] `/temper` displays the new reading
- [ ] App homepage temperature card reflects the latest reading
- [ ] Revoked device key cannot post readings

## Camera Monitoring
- [ ] `PUBLIC_CAMERA_BETA_ENABLED` is intentionally set for the test environment
- [ ] Admin provisions a camera device
- [ ] Test camera posts activity
- [ ] Test camera uploads still image or clip within size limits
- [ ] Admin camera page displays the event
- [ ] Camera media is private and business-scoped

## Email And Store Billing
- [ ] Invite works manually when email secrets are not configured
- [ ] If enabled, `RESEND_API_KEY` and `RESEND_FROM_EMAIL` send invite email
- [ ] Password reset email works when email secrets are configured
- [ ] Store product IDs match App Store Connect and Google Play Console
- [ ] Billing secrets are set before real purchase testing
- [ ] Native purchase stays pending if store verification is not configured
- [ ] Restore purchase path works on a real device after store setup

## Tenant Isolation
- [ ] Admin data belongs to current business only
- [ ] Employees from another business are not visible
- [ ] Lists/docs/recipes/schedule rows are scoped by `business_id`
- [ ] Trial/billing state applies only to its business
- [ ] Employee onboarding data belongs only to its business
- [ ] Employee compliance records belong only to their business
- [ ] R2 document, onboarding, and camera keys use business-scoped prefixes

## Mobile
- [ ] Marketing pages fit phone width
- [ ] Register onboarding fits phone width
- [ ] App sidebar/hamburger works on phone
- [ ] Admin schedule builder remains usable on phone
- [ ] Cards/images do not overflow horizontally

## Release Notes
- Record failed route/action, timestamp, and exact visible error before fixing.
- Prefer local smoke before remote DB or production smoke.
