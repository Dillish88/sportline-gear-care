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

For database installation and updates, follow [db/MIGRATIONS.md](db/MIGRATIONS.md). Do not replay older booking/payment functions over the current loyalty installation.

Customer QR parameters: shop=6th or 5th, src=counter-6th (or another source),
sport=badminton or cricket; legacy svc=string or bat is also accepted.
QR links use /book/?shop=6th&src=counter-6th. Confirm domain ownership,
renewal and mobile-data access before printing; localhost links cannot work for customers.

The landing page uses the owner-supplied rotating V2 carousel with no photos.
