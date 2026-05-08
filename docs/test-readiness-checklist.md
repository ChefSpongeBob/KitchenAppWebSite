# Test Readiness Checklist

Use this before big feature passes, GitHub pushes, and launch deploys.

## Automated Gates
- [ ] `npm run check`
- [ ] `npm run build`
- [ ] `npm run mobile:check`
- [ ] `npm run smoke:local`
- [ ] `npm run smoke:prod` after deployment

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

## Tenant Isolation
- [ ] Admin data belongs to current business only
- [ ] Employees from another business are not visible
- [ ] Lists/docs/recipes/schedule rows are scoped by `business_id`
- [ ] Trial/billing state applies only to its business

## Mobile
- [ ] Marketing pages fit phone width
- [ ] Register onboarding fits phone width
- [ ] App sidebar/hamburger works on phone
- [ ] Admin schedule builder remains usable on phone
- [ ] Cards/images do not overflow horizontally

## Release Notes
- Record failed route/action, timestamp, and exact visible error before fixing.
- Prefer local smoke before remote DB or production smoke.
