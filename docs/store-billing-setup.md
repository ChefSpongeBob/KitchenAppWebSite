# Crimini Store Billing Setup

Last updated: May 10, 2026

## App Identity

- App name: `Crimini`
- Bundle/package id: `com.nexusnorthsystems.crimini`
- Production URL: `https://criminiops.com`
- Privacy URL: `https://criminiops.com/privacy`
- Account deletion URL: `https://criminiops.com/account-deletion`

## Product IDs

Create the same product IDs in App Store Connect and Google Play Console.

| Product ID | Type | Price |
| --- | --- | --- |
| `crimini.plan.small.monthly` | Monthly subscription | `$50.00` |
| `crimini.plan.medium.monthly` | Monthly subscription | `$120.00` |
| `crimini.plan.large.monthly` | Monthly subscription | `$160.00` |
| `crimini.addon.temps.monthly` | Monthly subscription add-on | `$30.00` |
| `crimini.addon.cameras.monthly` | Monthly subscription add-on | `$30.00` |

Large includes temp and camera access in app logic.

## Cloudflare Secrets

Set these as production secrets, not public variables.

```txt
APP_STORE_BUNDLE_ID=com.nexusnorthsystems.crimini
APP_STORE_ISSUER_ID=
APP_STORE_KEY_ID=
APP_STORE_PRIVATE_KEY=
APP_STORE_ENVIRONMENT=production
GOOGLE_PLAY_PACKAGE_NAME=com.nexusnorthsystems.crimini
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON=
BILLING_WEBHOOK_TOKEN=
```

Use `APP_STORE_ENVIRONMENT=sandbox` only for sandbox testing.

## Backend URLs

- Product lookup: `https://criminiops.com/api/billing/products`
- Billing status: `https://criminiops.com/api/billing/status`
- Native purchase submit: `https://criminiops.com/api/billing/native-purchase`
- App Store notifications: `https://criminiops.com/api/billing/app-store-notifications?token=<BILLING_WEBHOOK_TOKEN>`
- Google Play RTDN push endpoint: `https://criminiops.com/api/billing/google-play-notifications?token=<BILLING_WEBHOOK_TOKEN>`

## Review Behavior

- Purchases must begin through native StoreKit or Google Play Billing.
- The app submits purchase details to `/api/billing/native-purchase`.
- The backend verifies the purchase with Apple or Google.
- The workspace is activated only after verification succeeds.
- If verification secrets are missing, the purchase is stored as pending and access stays locked.
- Restore uses native store restore/query APIs and submits restored purchases to the same backend endpoint.

## Before Upload

- Apply D1 migration `0059_store_entitlements.sql` to production.
- Confirm `store_products` contains all product IDs.
- Add all Cloudflare secrets.
- Create matching products in both stores.
- Add sandbox/license testers.
- Run real device purchase and restore tests.
- Provide reviewer demo credentials.
- Confirm Privacy and Account Deletion pages are live.
