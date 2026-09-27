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

## Test project only — 25 September 2026

20260925_phase1_worker_booking_privileges.sql restricts pilot_create_booking_v2 to service_role and revokes direct API access to the v1 booking and tracking wrappers. 20260925_phase1_lock_legacy_wrappers.sql also revokes the v1 wrappers from service_role, which the test project's default grants had allowed. Apply these on sportline-test only. The Phase 1 Worker must have the test project's SUPABASE_SERVICE_ROLE_KEY configured as an encrypted Preview Secret before booking requests can succeed.

The production Vercel site currently sends `/book` requests directly from the browser to Supabase RPCs, including `pilot_create_booking_v2`; it does not have server-side `/api/orders` or `/api/rpc/*` handlers. Keep the Vercel compatibility path in `book/index.js`, `book/staff.js`, `book/status.js`, and `pilot/api.js` until production traffic is routed through a Worker. Direct Supabase mode is limited to the exact production Vercel hostname; Vercel branch previews do not get live booking access. Vercel serves `pilot/config.js` with only the public Supabase URL and publishable key; the Cloudflare asset allowlist excludes that file, and the Worker returns a keyless config stub, so Cloudflare Preview uses its Worker API and test project.

The live database was checked read-only on 27 September 2026: `pilot_create_booking_v2`, `pilot_track_booking_v2`, and both v1 wrappers exist. The live Vercel booking page calls `pilot_create_booking_v2` directly. The v2 tracking function is callable by `anon` and returns status, timing, price, and service fields without a customer name, phone, or address. The live payment and loyalty redemption function definitions call `pilot_is_staff()`.

Vercel currently returns `404 NOT_FOUND` for `/db/pilot-staff.sql`; `.vercelignore` already excludes `db/`. Keep the expanded ignore entries for `worker/`, `scripts/`, `*.sql`, `wrangler.jsonc`, and `.assetsignore` in the merge. The legacy `/pilot/` route was also checked live: both Vercel and the Cloudflare Preview redirect it to `/book/`.

## Production rollout — staged, approval required

1. Merge the Worker-compatible Vercel fallback, `.vercelignore` hardening, legacy booking-client cleanup, updated v2 tracker, and these notes. Verify the site and a legacy tracking link on Vercel before touching live permissions.
2. After approval, apply `20260927_production_privileges_part_a.sql`. It checks that each staff function still contains `pilot_is_staff()`, removes v1 booking/tracking wrapper access, and preserves Vercel's current direct `pilot_create_booking_v2` access.
3. Choose and deploy the production request path: Cloudflare Worker or a Vercel server function. Test booking, staff access, and tracking through that server path.
4. Only after the live request path uses the server-side service-role credential, and after approval, apply `20260927_production_privileges_part_b.sql` to revoke direct `anon` and `authenticated` access to `pilot_create_booking_v2`.

The test-only migration `20260925_phase1_worker_booking_privileges.sql` still locks `pilot_create_booking_v2` for the Preview Worker. Do not replay it on production; production uses the staged Part A and Part B files above.

## Open policy

Repair details are anonymised after 12 months following collection/cancellation. Loyalty wallets and their phone-keyed ledger are separate and currently retained. The owner must decide credit expiry and corresponding phone retention; do not silently delete or forfeit outstanding credit. Public wallet display requires verified phone ownership before it can be enabled.
