# Approved Sportline booking experience

The owner's supplied dark design is retained, with a swipeable service carousel. No automatic movement or photos. Arrows, dots, keyboard controls and reduced-motion preferences are supported.

- Customer: /book/
- Counter: /book/staff.html
- Private status: /book/status.html#t=TOKEN (old /pilot/track.html links remain valid)
- Existing customer and staff URLs redirect through vercel.json; query parameters are retained.

Follow db/MIGRATIONS.md. Production already has loyalty changes; do not reapply pilot-booking-v3.sql or the supplied v2_slots_payments_shoe.sql over them.

Twenty half-hour badminton slots run from 10:30 to 21:00, excluding the 14:00–14:30 break. A slot's end is its ready-by time. Drop-off must reach the 6th Avenue bench before its start. 5th Avenue transfers and custom colours need staff confirmation. Earliest-available urgent bookings cost ₹25 and count within the same daily capacity. They cannot displace existing reservations. Next-day bookings open when today is closed/full. Availability uses India time and a 15-minute booking lead time.

Payments are staff-recorded money received, not online charges. An intended customer advance is not a payment. Staff may take an advance against a known estimate; inspection quotes need acceptance first. Payment retry keys prevent double recording, overpayments are rejected, acceptance cannot lower the bill below money received, and collection requires a fully paid agreed total. Refunds/corrections need a separate controlled workflow.

WhatsApp is review-and-send, as agreed for the trial. Nothing is sent automatically. Ready messages include balance and private status link. Staff confirm marketing consent separately; withdrawals are available by job or phone number. Supabase remains on Free; do not upgrade for the paid leaked-password protection toggle.

Staff sessions persist in this browser until sign-out; use a shop-controlled device. Sign-out clears the displayed queue and slip. Keep real-device and RP326 print checks in the shop acceptance test.

Verification: tests/pilot-booking-v3.mjs checks actual PostgreSQL rules; tests/book-browser.mjs checks the full browser workflow against an isolated local database. No test sends real messages or creates production orders.

The guided string assistant uses active, priced catalogue entries; no LLM API is required. It does not read physical stock quantities. Staff must confirm stock, colour and suitability for the racket. Printed frame limits constrain suggested tension.

The counter groups active jobs into New, In progress and Ready. Payment and next-step actions stay visible; specifications, WhatsApp and printing expand on demand. Credit balances are staff-only because booking phone numbers are not verified. Existing loyalty rules award 5% on collection and a one-time ₹20 for a staff-confirmed offers opt-in. Credit expiry/phone retention still needs an owner decision; repair anonymisation does not forfeit outstanding credit.
