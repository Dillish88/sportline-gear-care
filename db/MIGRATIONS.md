# Shared database migration record

## Existing production — 24 September 2026

Read-only inspection verified another builder had already installed loyalty tables, collection trigger, redemption RPC and urgent fee INR 25. Preserve these changes; do not replay pilot-booking-v3.sql against production.

Applied pilot-loyalty-hardening.sql on 24 September 2026; Supabase returned Success. No rows returned. This patch restores staff queue status links, serializes the one-time welcome credit and requires confirmed marketing consent, and restricts wallet lookup to allowlisted staff. It does not alter booking/payment functions or existing balances.

pilot-loyalty-baseline.sql is a clean-rebuild snapshot of the inspected loyalty implementation, not a production upgrade. It includes the current INR 25 urgent setting. Do not run it against the existing installation.

## Clean installation order only

1. pilot.sql
2. pilot-catalogue.sql
3. pilot-staff.sql (configure the intended staff identity)
4. pilot-maintenance.sql
5. pilot-booking-v3.sql
6. pilot-loyalty-baseline.sql
7. pilot-loyalty-hardening.sql
8. pilot-retention-schedule.sql (Supabase cron)

Before any future change, inspect the live definitions of affected functions and compare them with this record. Add a dated migration; do not silently overwrite another builder's booking, payment or loyalty changes. Test in an isolated database before applying.

Validation: tests/pilot-loyalty.mjs and tests/book-browser.mjs use local PostgreSQL via PGlite, not production customers. Real-device and RP326 checks remain with the shop.

## Open policy

Repair details are anonymised after 12 months following collection/cancellation. Loyalty wallets and their phone-keyed ledger are separate and currently retained. The owner must decide credit expiry and corresponding phone retention; do not silently delete or forfeit outstanding credit. Public wallet display requires verified phone ownership before it can be enabled.
