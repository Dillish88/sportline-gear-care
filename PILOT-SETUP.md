# Current release — 24 September 2026

Use /book/ and /book/staff.html. Apply db/pilot-booking-v3.sql last after the migrations below; it contains the final slot and retry-safe payment functions. Old public booking APIs enforce the same slot rules. Existing links keep working. Staff sessions now persist on the shop browser until sign-out. Tests: tests/pilot-booking-v3.mjs and tests/book-browser.mjs. See book/README.md for current behavior. Historical setup below predates the approved version.

# Current maintenance update

Production maintenance was applied on 20 September 2026. The four legacy tables
and their two functions were removed after verifying empty job/event/stock tables
and the default bench configuration, with the owner's confirmation. The guarded
removal is recorded in `db/retire-legacy.sql`; do not rerun it on a retired schema.
Supabase remains on Free as requested. Leaked-password protection is unavailable
on that plan and remains off. The repository is private; Vercel deployment was verified.
`book.sportlinestores.com` has no DNS record as of that date; the registry expiry
is 2 November 2026. Account ownership/renewal still require the domain holder.

The sole customer application is `/pilot/`. Retired routes redirect on Vercel. Apply `db/pilot-maintenance.sql` before deploying this update, followed by `db/pilot-retention-schedule.sql`. The latter schedules anonymisation daily at 03:00 India time. Inspect cron.job and cron.job_run_details to verify execution.

Personal repair details (including the original request JSON) are removed 12 months after collection/cancellation; numeric job totals and statuses remain. Private tracker tokens are rotated. Active jobs are retained for staff review. Database backups and staff WhatsApp copies have separate retention; this job only covers live database records.

Offer requests are optional and unchecked by default. Staff must confirm the customer at the counter before saving consent. Marketing contacts expire after 12 months; the staff screen can withdraw permission by mobile number even when the job is no longer in the queue. Do not import existing bookings as marketing opt-ins.

Staff can review the WhatsApp note and open WhatsApp to send it. No message is automatic and no delivery status is recorded.

Exbolt 68 is seeded at the supplied SPEC price of ₹1,100. Eleven missing strings are inactive pending prices. After approval, set price, colours and active in pilot_catalogue; the form reads this live.

Set `qrOrigin` in pilot/config.js only after ownership, renewal and DNS/HTTPS have been verified for the chosen permanent address. Until then QR printing is disabled.

---

# Counter self-booking pilot

The sole customer booking surface is `/pilot/`. Booking is enabled after the
completed live pilot test. For a new installation, disable booking until its
setup is verified. Never paste a localhost QR in the shop.

## Activation

Designated staff email: **sportlinegear@gmail.com**. This must be a verified
Supabase Auth user in the existing project; creating the Gmail inbox alone does
not create the app login. The owner continues to manage Supabase and Vercel using
the accounts that already own those projects.

1. In the existing Supabase project, review and run `db/pilot.sql`, followed by
   `db/pilot-catalogue.sql`. These create separate pilot tables and RPC functions.
   Existing rows are preserved. The migration revokes the older schema's broad
   anon/authenticated privileges and its code-only public tracking function.
   The retired standalone WhatsApp pages have been removed.
2. Create or identify the staff member's Supabase Auth user. The user enters
   their own password. Do not put a password or service-role key in these files.
3. After the owner approves that staff identity, run (replace the UUID):

   For the designated email above, `db/pilot-staff.sql` performs the lookup and
   refuses to grant access unless the verified Auth user exists. Alternatively:

       insert into public.pilot_staff(user_id) values ('APPROVED-AUTH-USER-UUID')
       on conflict(user_id) do update set enabled=true;

4. Check a signed-out request cannot read orders and an unapproved signed-in user
   cannot call `pilot_queue`. Confirm the approved staff member can sign in.
5. Set `enabled` to `true` in `pilot/config.js` and publish the static repository
   to the existing Vercel project. The file contains only the supplied public
   project URL/key. Database security, not key secrecy, controls access.
6. Run one clearly named test job on the published site, using an approved test
   phone. Verify receipt, queue, agreement, payment and collection. Keep the test
   record for the audit or cancel it; do not silently delete live data.
7. Open `/pilot/print-qr.html` on the final HTTPS address and print the two posters.
   Each code selects a shop and records `counter-6th` or `counter-5th` as source.
   Scan the physical codes on both Android and iPhone/mobile data before use.

## Daily counter process

- Keep `/pilot/staff.html` open on a staff device. Sign in with an approved account.
- Ask the customer to scan, complete the form, save, and show the job number.
- Verify their mobile, physical gear, stock, frame limits, services and due time.
- Enter the final agreed price (inspection jobs require an explicit amount).
  Accept the job and print its slip. Attach the slip securely to the correct gear.
- Start work, mark ready, record payment only after money is received, then mark
  handed back only after checking the job number and customer mobile.
- The queue refreshes every 15 seconds while visible, except while editing fields.
  Use Refresh if returning to the tablet. It shows active jobs and completed or
  cancelled jobs updated in the last day, up to 300 rows.
- Keep a manual fallback at the counter for connectivity problems. Never tell a
  customer a request was saved unless a job number appears.

## Implemented boundaries

- Prices are calculated from the server catalogue; customer-supplied totals and
  statuses are ignored. Prices include the source's stated tax-inclusive amount.
- One item per request. Both drop-off counters supported; no rider service.
- A saved request is not staff acceptance or a guarantee of stock/time.
- UUID idempotency keys survive retries within a browser tab. The key and a hash
  of the form are stored, not the contact details. If a connection fails after
  saving, retry without changing details to retrieve the same job.
- Private status links use random tokens in the URL fragment; they expose no
  customer name, phone or notes. They still contain job status and prices: share
  only with the customer. Do not put those private links into public posters.
- Staff sessions stay in memory, refresh while open, and clear on sign-out/reload.
  Every write verifies the staff allowlist and records the acting account.
- Cancellation is limited to unpaid, unstarted jobs. Refunds, price corrections
  after acceptance, automated WhatsApp, invoicing and tax calculations are outside
  this initial pilot. A payment preference is not a payment transaction.
- There are phone-based request limits (2/minute, 10/day), but no phone ownership
  verification. Staff must check the customer physically. Broader public promotion
  should add gateway/IP abuse controls and a stronger phone verification flow.
- Retention is implemented by the maintenance migration and scheduled job described above.

## Validation

`tests/pilot-database.mjs` runs the actual SQL using a local PGlite PostgreSQL engine,
including pricing, repeat submission, access restrictions, state transitions,
payment-before-handover and audit identity. `tests/pilot-browser.mjs` exercises the
customer and staff UIs against that same local database with test-only Auth.
It deliberately loses the first save response and verifies only one job exists.

Both need `PILOT_PGLITE` pointing to PGlite's `dist/index.js`. Browser testing also
requires Playwright and Microsoft Edge. No test contacts the live Supabase project.

QR library: qrcode-generator 2.0.4 by Kazuhiko Arase, MIT licensed; the copyright
and license notice are retained in `pilot/vendor/qrcode.js`.
