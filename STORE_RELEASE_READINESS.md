# Crimini Store Release Readiness

Last updated: May 11, 2026

## Current Goal

Prepare Crimini for Apple App Store and Google Play review with real native billing, clear privacy/account deletion flows, production backend readiness, and no placeholder purchase paths.

## Completed

- Capacitor production URL points to `https://criminiops.com`.
- Capacitor allowed navigation is limited to `criminiops.com` and `www.criminiops.com`.
- Native app id / bundle id is `com.nexusnorthsystems.crimini`.
- Store setup guide exists at `docs/store-billing-setup.md`.
- Billing status endpoint exists at `/api/billing/status`.
- Cloudflare production checklist exists at `docs/cloudflare-production-checklist.md`.
- Cloudflare readiness check exists at `npm run test:cloudflare-readiness`.
- Global production security headers are set and checked by `npm run test:security-headers`.
- Migration scripts target the active `DB` binding.
- Android cleartext traffic is disabled.
- Android app backup is disabled.
- Public `/privacy` page exists.
- Public `/account-deletion` page exists.
- In-app Settings links to Account Deletion.
- Account deletion requests save to D1 through `account_deletion_requests`.
- Migration `0058_account_deletion_requests.sql` applied locally and remotely.
- Store product, entitlement, purchase event, and webhook event tables are defined in `0059_store_entitlements.sql`.
- Migration `0059_store_entitlements.sql` applied locally and remotely.
- Native billing product lookup endpoint exists at `/api/billing/products`.
- Native purchase submission endpoint exists at `/api/billing/native-purchase`.
- Native purchase submissions are verified against Apple/Google when store credentials are configured.
- Native purchase submissions stay pending and do not unlock paid access when store verification is not configured.
- App Store Server Notification endpoint exists at `/api/billing/app-store-notifications`.
- Google Play RTDN endpoint exists at `/api/billing/google-play-notifications`.
- Android native billing bridge exists through Google Play Billing Library.
- iOS native billing bridge exists through StoreKit.
- `npm run check` passes.
- `npm run build` passes.
- `node ./scripts/mobile-release-check.mjs` passes.
- `node ./scripts/android-release-pass.mjs` completes.
- Native release prerequisite report exists at `npm run native:prereq`.

## Highest Review Risks

1. Store product IDs must exist in App Store Connect and Google Play Console before sandbox testing.
2. Cloudflare production secrets must be added before live billing can verify.
3. Android/iOS native projects still need signed release builds tested on real store sandbox accounts.
4. The submitted native app needs demo credentials and a live backend for review.
5. Privacy labels/Data Safety answers must match actual collected data.
6. Screenshots, support URL, privacy URL, and deletion URL must be live and final.

## Native Billing Architecture

### Store Products

Use one subscription product group/family with monthly tiers:

- `crimini_small_monthly`
- `crimini_medium_monthly`
- `crimini_large_monthly`

Optional add-ons:

- `crimini_temp_monitoring_monthly`
- `crimini_camera_monitoring_monthly`

Large tier includes temp and camera in app logic, but the store product setup still needs to represent that clearly.

### App Flow

1. User creates workspace through onboarding.
2. User chooses plan.
3. Native app starts StoreKit or Google Play Billing purchase flow.
4. Native app receives transaction/purchase token.
5. App posts receipt/token to backend.
6. Backend verifies with Apple/Google.
7. Backend writes entitlement and updates `business_trials` / business status.
8. App unlocks workspace only after verified entitlement.

### Backend Tables

- `store_products`
- `store_purchase_events`
- `business_store_entitlements`
- `store_webhook_events`

The backend can now store products, pending purchase submissions, and entitlement rows. Pending rows do not activate a workspace. Activation should only happen after Apple/Google verification calls `activateVerifiedStoreEntitlement()` and `applyVerifiedEntitlementsToBusiness()`.

### Required Cloudflare Secrets

- `APP_STORE_BUNDLE_ID`
- `APP_STORE_ISSUER_ID`
- `APP_STORE_KEY_ID`
- `APP_STORE_PRIVATE_KEY`
- `APP_STORE_ENVIRONMENT` (`sandbox` or `production`)
- `GOOGLE_PLAY_PACKAGE_NAME`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`
- `BILLING_WEBHOOK_TOKEN`

## Apple Requirements To Implement

- StoreKit 2 purchase flow.
- Product lookup by App Store Connect product IDs.
- Restore purchases.
- Server-side verification using App Store Server API.
- App Store Server Notifications endpoint.
- Manage subscription link or system subscription management path.

## Google Requirements To Implement

- Google Play Billing Library integration.
- ProductDetails lookup.
- `launchBillingFlow()`.
- `onPurchasesUpdated()` handling.
- `queryPurchasesAsync()` restore path.
- Purchase token sent to backend.
- Backend verification through Google Play Developer API.
- Purchase acknowledgement after verification.
- Real-time Developer Notifications endpoint.
- Manage subscription deep link.

## Remaining Store Submission Tasks

- Decide final package/bundle ID before first upload.
- Create subscription products in App Store Connect.
- Create subscription products in Google Play Console.
- Add sandbox/license testers.
- Prepare demo reviewer account.
- Finalize privacy policy language with exact support/contact details.
- Complete Apple privacy nutrition labels.
- Complete Google Play Data Safety form.
- Generate final native app icons/splash assets.
- Build signed Android App Bundle.
- Build signed iOS archive.
- Run TestFlight and Play internal testing.
