# Cloudflare Workers preview

The Cloudflare build serves an allowlist of the existing `/book/` static assets and routes all browser data requests through `worker/index.js`. It adapts the live `pilot_*` RPCs and does not create replacement order tables.

## Configure a preview

1. Create a Cloudflare Worker from this repository using `wrangler.jsonc`.
2. Add `SUPABASE_URL` and `SUPABASE_ANON_KEY` as Worker secrets. Use the Supabase project's URL and publishable key. Do not use the service-role key.
3. Build the asset directory with `node scripts/build-cloudflare.mjs`.
4. Run `npx wrangler dev` for a local Worker preview or `npx wrangler deploy --dry-run` to validate the deployment bundle.
5. Deploy to a preview Worker and verify `/api/health`, booking, status links, staff sign-in, and WhatsApp handoff before routing production traffic.

The daily Cron Trigger runs at 04:30 UTC and invokes the same small catalogue RPC used by `/api/health`. Production traffic and the existing Vercel deployment should remain on their current host until the preview is accepted.
