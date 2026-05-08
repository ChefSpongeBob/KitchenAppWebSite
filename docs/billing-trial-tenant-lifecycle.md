# Billing Trial Tenant Lifecycle

Phase 9 hardens the business lifecycle around free trials, purchase conversion, and cancellation.

## Completed
- Trial identity claims are written when a free trial is granted.
- Duplicate free trials are blocked by email, device fingerprint, and business/IP pairing.
- Trial denial records are kept for purchase-only routing after cancellation, expiration, or abuse detection.
- Business lifecycle status now uses explicit states: `trialing`, `active`, `past_due`, `canceled`, and `suspended`.
- Paid conversion updates billing/trial status without deleting tenant data.
- Cancellation creates a pre-purge snapshot before deleting workspace-owned data.
- Workspace lookup allows billing-required states so the billing page can load while the app remains gated.

## Cancellation Safety
- Cancellation only targets rows tied to the canceled `business_id`.
- Trial denial and trial identity claim records are retained so a second free trial cannot be created immediately.
- Account audit logs and lifecycle snapshots are retained as security records.
- Users are only deleted when the canceled workspace was their last remaining business membership.

## Launch Notes
- Apply `migrations/0055_billing_trial_tenant_lifecycle.sql` before production traffic.
- Keep store billing as the activation source for production.
- Use lifecycle snapshots as the local safety record before adding a larger R2 export pipeline.
