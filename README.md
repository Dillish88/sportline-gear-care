# Sportline Gear Care

The only customer booking page is **/pilot/**. It saves requests in Supabase.
The homepage, /concept/, /gear-care.html and /stringing.html redirect to it on Vercel.
The retired implementations are available in Git history.

- Customer: https://sportline-gear-care.vercel.app/pilot/
- Staff: /pilot/staff.html
- QR posters: /pilot/print-qr.html (printing awaits confirmed permanent domain)
- Operating constraints: [PROJECT.md](PROJECT.md)
- Database setup and workflow: [PILOT-SETUP.md](PILOT-SETUP.md)

One static application, no build step. Vercel deploys GitHub main; SQL changes must
also be applied in Supabase. Keep database files and PROJECT.md excluded from hosting.
The publishable Supabase key is public by design; tables are protected by RLS and
server functions, and staff must be allowlisted. Never commit service-role keys.

The form reads the public service catalogue from Supabase. Priced active strings
appear without redeploying. Missing-price strings stay inactive until approved.
WhatsApp is staff-reviewed and manually sent; this app cannot confirm delivery.
Personal repair details are anonymised 12 months after collection/cancellation.
Separate staff-confirmed offers opt-ins expire after 12 months or on withdrawal.

Run db/pilot.sql, db/pilot-catalogue.sql, db/pilot-staff.sql, then
db/pilot-maintenance.sql and db/pilot-retention-schedule.sql in Supabase.
Existing installations need the last two files only. Apply SQL before deploying
the catalogue-reading frontend. See setup instructions and migration tests.

Customer QR parameters: shop=6th or 5th, src=counter-6th (or another source),
sport=badminton or cricket; legacy svc=string or bat is also accepted.
QR links use /pilot/?shop=6th&src=counter-6th#booking. Confirm domain ownership,
renewal and mobile-data access before printing; localhost links cannot work for customers.

Photo: Glen Carrie / Unsplash, attribution retained in the customer footer.
