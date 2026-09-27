# Cloudflare Workers Phase 1

The Cloudflare build serves an allowlist of the existing `/book/` static assets and routes all browser data requests through `worker/index.js`. It adapts the live `pilot_*` RPCs and does not create replacement order tables. The root `.assetsignore` protects deployments that accidentally select the repository root as the static asset directory; the build also copies it into `cloudflare-dist/`, the configured asset directory.

## Configure the isolated Phase 1 Worker

1. In Workers & Pages, create a Worker by importing `Dillish88/sportline-gear-care` from branch `codex/phase-1-backend-foundation`.
2. Set the Worker name to `sportline-gear-care-phase1`, root directory to `/`, and build command to `node scripts/build-cloudflare.mjs`. Keep `wrangler.jsonc` as the Worker config and the deploy command as `npx wrangler deploy`.
3. Keep `main` as the production branch and enable builds for preview branches. The repository's `main` branch does not yet contain `wrangler.jsonc`, so its production build will fail until that branch includes the reviewed Worker config. Use `codex/phase-1-backend-foundation` for the Phase 1 preview build and validation.
4. In the Preview environment only, add the test project's `SUPABASE_URL` and `SUPABASE_ANON_KEY` as runtime variables, and `SUPABASE_SERVICE_ROLE_KEY` as an encrypted Secret. The Worker uses the publishable key for public reads and staff-authenticated calls; it uses the service-role key only for the validated booking RPC after the database revokes direct public access. Never put the service-role key in `wrangler.jsonc`, GitHub, or browser code. Until the production cutover is separately approved, keep all three values out of the Production environment.
5. Keep the Preview Worker on its `workers.dev` URL. Do not attach a production hostname or route production traffic to Preview.
6. Confirm the asset directory is `cloudflare-dist/`. The build script copies only the 12 allowlisted static files there, and `.assetsignore` excludes repository metadata, SQL, source code, tests, and environment files. `/db/pilot-staff.sql` should return an error page.
7. Review the Worker URL and verify `/api/health`, public catalogue/slot/status reads, booking validation and honeypot rejection, staff sign-in, and WhatsApp handoff before considering any production change.

The daily Cron Trigger runs at 04:30 UTC and invokes the same small catalogue RPC used by `/api/health`. The existing Vercel deployment remains the production site until the Phase 1 Worker has been reviewed and accepted.

## Production cutover — prepared, not authorized

The selected production backend is this Cloudflare Worker. Production remains on Vercel until each rollout step in `db/MIGRATIONS.md` is approved and verified. Do not put live Supabase values in Preview; Preview must stay connected to `sportline-test`.

For the production environment, the owner will add `SUPABASE_URL` (Text), `SUPABASE_ANON_KEY` (Text), and `SUPABASE_SERVICE_ROLE_KEY` (encrypted Secret) under **Workers & Pages → sportline-gear-care-phase1 → Settings → Variables and Secrets → Production**. Copy the values directly from the live Supabase dashboard. Never put the service-role key in GitHub, `wrangler.jsonc`, browser code, or chat.

The selected production hostname is `care.sportlinestores.in`. A Worker Custom Domain requires an active Cloudflare zone; Cloudflare then creates the Worker DNS record and certificate. Before changing the registrar's nameservers to Cloudflare, export the current DNS zone and review Cloudflare's imported records. Make sure every existing website, mail, verification, and service record is present in Cloudflare first. Changing nameservers without the needed records can take the domain or email offline. Do not modify existing MX/TXT records during this migration; later, add Zoho's records exactly as Zoho displays them, as DNS-only records.

After the zone is Active and production settings are in place, attach `care.sportlinestores.in` as a Custom Domain on the Production Worker. Redirect only `sportlinestores.in` and `www.sportlinestores.in` to `https://care.sportlinestores.in`, preserving path and enabling **Preserve query string**. Do not use a wildcard that could include `care`. The incoming apex and `www` hosts need Cloudflare-proxied DNS records for Redirect Rules to run. If the DNS review confirms there is no real web origin to preserve, the proposed placeholder records for approval are `A @ → 192.0.2.0 (Proxied)` and `A www → 192.0.2.0 (Proxied)`. Cloudflare documents `192.0.2.0` for originless proxied redirect hosts. Do not create them before approval and DNS review. Keep all mail MX/TXT records unchanged.

Keep the Vercel site live while the Worker is tested. Route the old Vercel hostname only after the production Worker passes the approved checks. Test a temporary 307 catch-all redirect first, preserving the full path and query string; promote it to a permanent 308 only after the old QR and tracking links work and the owner approves. Browsers can cache a 308, so keep the Worker healthy and do not assume removing the Vercel redirect will undo cached redirects.

See `db/MIGRATIONS.md` for the six-stage cutover and the rollback steps for each stage. No production merge, settings, DNS, database migration, or redirect is authorized by this preparation note.
