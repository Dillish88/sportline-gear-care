# Local verification

Use tests/pilot-database.mjs and tests/pilot-browser.mjs. Set PILOT_PGLITE to the installed PGlite dist/index.js and NODE_PATH to the Playwright modules directory. Tests use an isolated PostgreSQL database and test-only Auth, never live customer records. The canonical customer path is /pilot/. Root redirects there locally; Vercel redirects retired routes too.
