# Sportline Gear Care

The approved customer booking page is **/book/**, with the matching counter at **/book/staff.html**. Root, /pilot/ and retired customer routes redirect to it. Existing private /pilot/track.html links keep working.

The owner-approved dark design includes a swipeable Badminton / Cricket / Shoe carousel, ready-by slots, partial payments and reviewed WhatsApp tickets. See [book/README.md](book/README.md) for current rules and verification. QR printing still awaits the permanent domain.

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
Existing installations also need db/pilot-booking-v3.sql. Apply it last; it supersedes previous booking/payment function definitions. Apply SQL before deploying
the catalogue-reading frontend. See setup instructions and migration tests.

Customer QR parameters: shop=6th or 5th, src=counter-6th (or another source),
sport=badminton or cricket; legacy svc=string or bat is also accepted.
QR links use /pilot/?shop=6th&src=counter-6th#booking. Confirm domain ownership,
renewal and mobile-data access before printing; localhost links cannot work for customers.

Photo: Glen Carrie / Unsplash, attribution retained in the customer footer.
