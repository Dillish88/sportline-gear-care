# Cloudflare Workers Phase 1

The Cloudflare build serves an allowlist of the existing `/book/` static assets and routes all browser data requests through `worker/index.js`. It adapts the live `pilot_*` RPCs and does not create replacement order tables. The root `.assetsignore` protects deployments that accidentally select the repository root as the static asset directory; the build also copies it into `cloudflare-dist/`, the configured asset directory.

## Configure the isolated Phase 1 Worker

1. In Workers & Pages, create a Worker by importing `Dillish88/sportline-gear-care` from branch `codex/phase-1-backend-foundation`.
2. Set the Worker name to `sportline-gear-care-phase1`, root directory to `/`, and build command to `node scripts/build-cloudflare.mjs`. Keep `wrangler.jsonc` as the Worker config and the deploy command as `npx wrangler deploy`.
3. The repository's `main` branch does not yet contain `wrangler.jsonc`. Keep this separate Worker connected to the Phase 1 branch for its first deployment. Do not set this Worker's production branch to `main` until that branch includes the reviewed Worker config; otherwise Cloudflare may auto-configure the project from the repository root.
4. Add `SUPABASE_URL` and `SUPABASE_ANON_KEY` as runtime secrets for this isolated Worker. Use the Supabase project's URL and publishable key. Never use the service-role key.
5. Keep this Worker on its `workers.dev` URL. Do not attach the production domain or route production traffic to it.
6. Confirm the asset directory is `cloudflare-dist/`. The build script copies only the 12 allowlisted static files there, and `.assetsignore` excludes repository metadata, SQL, source code, tests, and environment files. `/db/pilot-staff.sql` should return an error page.
7. Review the Worker URL and verify `/api/health`, the booking flow, status links, staff sign-in, and WhatsApp handoff before considering any production change.

The daily Cron Trigger runs at 04:30 UTC and invokes the same small catalogue RPC used by `/api/health`. The existing Vercel deployment remains the production site until the Phase 1 Worker has been reviewed and accepted.
