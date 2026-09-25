# Cloudflare Workers deployment

This app is static HTML, CSS and JavaScript. The build script copies only the
public booking pages and their runtime assets into `cloudflare-dist/`; database
SQL, tests and project notes are not included.

Prepare the assets locally:

```sh
node scripts/build-cloudflare.mjs
```

For a Git connected Worker, use `node scripts/build-cloudflare.mjs` as the build
command and `npx wrangler deploy` as the deploy command. The Worker configuration
in `wrangler.jsonc` serves `cloudflare-dist/`. The `_redirects` file in that
directory keeps the current booking routes and legacy redirects.

Set the custom domain in Cloudflare after the zone is active there. Keep the
current host available until you have checked customer booking, staff login,
private status links and the Supabase connection on the Cloudflare URL.
