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

## Production rollout — Cloudflare Worker, staged and approval required

The selected production request path is the existing Phase 1 Cloudflare Worker. This is a runbook only: do not merge, change production settings, alter DNS, apply live SQL, or redirect live traffic until the owner approves that specific step. Keep Vercel and direct `pilot_create_booking_v2` access available until the Worker and old-link routing have been verified.

### 1. Merge and verify the Vercel safety changes

Merge `codex/phase-1-backend-foundation` to `main`, including the Worker-compatible Vercel fallback, `.vercelignore` hardening, legacy booking-client cleanup, updated v2 tracker, and these notes. Wait for Vercel's production deployment. Verify that the site loads, an existing live tracking link works, and `/db/pilot-staff.sql` returns 404.

**Rollback:** promote the prior known-good Vercel deployment or revert the merge on `main`, then verify the live site and tracking again. Do not proceed to Part A until these checks pass.

### 2. Apply live privilege migration Part A

Only after Step 1 passes and the owner separately approves the live database change, apply `20260927_production_privileges_part_a.sql` to the live project. Before applying, save a read-only snapshot of effective EXECUTE access for the functions and roles changed by the migration. The migration checks that the staff functions still contain `pilot_is_staff()`, revokes the obsolete v1 booking/tracking wrappers, and leaves direct Vercel calls to `pilot_create_booking_v2` enabled. Retest a live booking and tracking link on Vercel.

**Rollback:** if either Vercel flow fails, restore the pre-change effective EXECUTE grants from the saved snapshot (including any v1 wrapper grants that were present), then retest. If code also needs rollback, restore Vercel first and then restore the saved grants. Do not apply Part B as part of this rollback.

### 3. Configure production credentials in Cloudflare

In the `sportline-gear-care-phase1` Worker dashboard, under **Settings → Variables and Secrets → Production**, add `SUPABASE_URL` and `SUPABASE_ANON_KEY` as runtime Text variables and `SUPABASE_SERVICE_ROLE_KEY` as an encrypted Secret. Copy values directly from the live Supabase project in the dashboard; never put the service-role key in GitHub, `wrangler.jsonc`, browser code, or chat. Preview must continue to use only the `sportline-test` project.

**Rollback:** remove or restore only the Production values added for this cutover and roll back the Worker deployment if needed. Vercel remains live and Part B remains unapplied, so its current direct booking path stays available.

### 4. Bring up and test the production Worker address

The selected production address is `https://care.sportlinestores.in`. Before changing nameservers, export the existing DNS records and verify that Cloudflare imported them correctly, especially current MX/TXT mail and domain-verification records. Change nameservers at the registrar only after approval and only once the required records are present. Wait until Cloudflare reports the zone Active. Do not edit or delete MX/TXT records in this step.

After Production variables are in place, attach `care.sportlinestores.in` as a Custom Domain on the Production Worker. Cloudflare requires an active zone and creates the Worker DNS record and certificate. Check for an existing DNS record on `care` first; resolve any conflict only after approval. Test booking, tracking, staff login, and payment using an explicitly marked test booking. Confirm the resulting database records and cancel the test booking. Do not use a real customer's details. Keep the Vercel site serving customers throughout this step.

**Rollback:** stop directing users to the Worker and roll back the Worker version or detach the custom hostname, restoring any DNS record that existed before the change. Vercel remains available and Part B is still unapplied. If a test payment creates an irreversible ledger entry, stop before recording it and get approval for a reversible test method.

Once `care` is working, add Cloudflare redirects for only `sportlinestores.in` and `www.sportlinestores.in` to `https://care.sportlinestores.in`, preserving the original path and query string (enable **Preserve query string**). Use separate exact-host matches (or one rule matching only those two hosts); do not wildcard all subdomains, because that could catch `care` and loop. Both source hosts need proxied DNS records for Cloudflare Redirect Rules. If DNS review confirms the apex and `www` have no real web origin that must be retained, the prepared placeholder records for approval are:

| Type | Name | IPv4 address | Proxy |
| --- | --- | --- | --- |
| A | `@` | `192.0.2.0` | Proxied (orange cloud) |
| A | `www` | `192.0.2.0` | Proxied (orange cloud) |

Cloudflare documents `192.0.2.0` as a placeholder for originless proxied redirect hosts. Do not create these records until the owner approves and the imported DNS records have been reviewed. Test with a temporary 307 first; after confirming path/query preservation, the owner may approve a permanent redirect. Leave MX/TXT records unchanged. This keeps the apex and `www` available for a future shop site by removing these redirects when that site is ready.

**Rollback:** remove/disable the apex and `www` redirect rules. If those hosts had an existing website before this move, restore its prior DNS targets from the saved DNS snapshot. Do not change mail records as part of this rollback.

### 5. Test old links through a Vercel redirect

First deploy a **temporary 307** catch-all redirect from `sportline-gear-care.vercel.app` to `https://care.sportlinestores.in`, preserving `/:path*` and the query string. Vercel `vercel.json` redirects pass query strings through by default; include the wildcard path in the destination. Test an old QR prefill URL and an existing tracking URL and confirm both reach the matching page and retain their query values. Keep the redirect temporary during the verification period.

After the 307 checks pass, and only with separate approval, change the redirect to a permanent 308. Permanent redirects can be cached by browsers, so reverting `vercel.json` may not return every previously visiting browser to Vercel. Keep the Worker available and healthy after the 308 cutover.

**Rollback:** during 307 testing, remove the catch-all redirect and redeploy Vercel; the old Vercel site and direct booking path remain available. If a 308 has already been issued, remove the redirect for new requests but do not assume cached clients will return to Vercel; restore service on the Worker address while resolving the issue.

### 6. Apply live privilege migration Part B last

Only after Steps 1–5 pass and the owner separately approves, apply `20260927_production_privileges_part_b.sql` to live. It revokes direct `anon` and `authenticated` EXECUTE on `pilot_create_booking_v2` and leaves the Worker service-role call available. Verify that a direct browser RPC call using the publishable key fails and a Worker booking succeeds.

**Rollback:** if the Worker is unhealthy, remove the Vercel catch-all redirect so the Vercel site serves pages again. Direct Vercel booking will remain blocked until the database grant is restored. Then explicitly grant EXECUTE on `public.pilot_create_booking_v2(jsonb,uuid)` to `anon` and `authenticated`, and verify bookings and tracking. Record that this restores public RPC access; re-apply Part B only after the Worker path is healthy and approved.

The test-only migration `20260925_phase1_worker_booking_privileges.sql` locks `pilot_create_booking_v2` for the Preview Worker. Do not replay it on production; production uses the staged Part A and Part B files above.

## Open policy

Repair details are anonymised after 12 months following collection/cancellation. Loyalty wallets and their phone-keyed ledger are separate and currently retained. The owner must decide credit expiry and corresponding phone retention; do not silently delete or forfeit outstanding credit. Public wallet display requires verified phone ownership before it can be enabled.
