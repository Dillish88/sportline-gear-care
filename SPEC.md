# Gear Care — build spec

Merged from the two Claude Design explorations. This is the decision record and
the build list; the `.dc.html` files are sketches of it, not the codebase.

Companion to `README.md`, which documents the live booking page already deployed.

---

## The shape of it

Three lanes, one order record.

```
Customer   QR / link → service → details → who moves it → review → booked → track
Shop       bench queue → job card → print tag → advance stage → work-done message
Rider      run sheet → photo at pickup → delivered
```

Counter drop skips the rider lane entirely: same order, same tag, same tracking,
no delivery cost on either side.

---

## Decisions carried forward

### From the first version

**1. The order exists before WhatsApp opens.**
Today the page ends at "press send" — abandon there and you never learn someone
wanted a restring. Tapping the button writes the order, returns a job code
(`SL-2291`), *then* opens WhatsApp with that code in the message. Staff reply to
a job that already exists. This is the single most valuable change.

**2. Five statuses, each one a staff tap.**
Booked · Collected · At the bench · Ready · Returned. Nothing is true unless
someone touched a screen. The bench queue *is* the tracking backend. Anything
finer-grained is fiction and will rot.

**3. Counter drop is pushed hardest.**
Two legs at real Chennai fares can be ₹150–250 on a ₹550 restring. The app
offers the counter ticket *before* asking for an address. Pickup stays for
people who'll pay for it.

With a 30-minute bench this gets stronger: dropped at the 6th Avenue counter, a
racket can be back in the player's hands the same visit. No rider, no fare, no
damage exposure, best experience.

**4. The gear locker.**
Racket, string, tension, date strung. Forty days later: "Nanoray 800 is due a
restring", rebooking one tap at the string they already chose. Repeat revenue
with no poster, no ad, no discount. This is the compounding part of the product.

**5. UPI at "Ready", not at the door.**
Paid before the return leg means the rider carries no cash and nobody argues on
a doorstep. Cash on delivery stays as the fallback, one line below.

**6. QR parameters become deep links.**
`?svc ?shop ?area ?src` stay exactly as they are. A court poster opens on the
string chooser with the shop already set. `src` rides into the **order record**,
not just the message, so you can finally see which poster pays.

**7. Every price says "Estimate" until two numbers are settled.**
See Blocking below. The confirm screen says so out loud.

### From the shop floor — confirmed, and it changes the offer

**14. Turnaround is hours, not days.**
A restring takes 30 minutes. Three stringers, 20+ on a busy day, and one to two
hours is the *normal* turnaround, not the exception. The live page promises
"2–3 days", which undersells the one thing that genuinely beats Decathlon:
they make you leave it and come back.

**Promise same-day. Deliver in one to two hours.** The public promise has to
survive a packed Saturday, not describe a quiet Tuesday. Promise an hour and a
weekend queue turns it into a broken promise on a public page; promise same-day
and you beat it almost every time.

**15. Express is priority, not speed.**
Since normal is already an hour, the paid tier buys a **place at the front of
the queue** — which is only worth anything when a queue exists. Sell it on
weekends, and let the app hide it on a quiet weekday rather than charge for
something the customer would have got anyway. Around ₹100–150 on a ₹550
restring is the right order of magnitude: noticeable, not resented, and the
highest-margin line in the business — no rider, no fare, no transit risk.

**16. Load is lumpy: quiet weekdays, packed weekends.**
This shapes what the app pushes on which day.

- **Weekends** — bench is contended. Push counter drop and express. Pickup is
  the wrong thing to promote into a queue.
- **Weekdays** — spare bench capacity and better rider batching. Push pickup,
  and fire the locker's restring nudges Tuesday to Thursday so they land in the
  gap rather than on top of a Saturday rush.

Using the locker to *smooth demand into empty bench hours* is worth more than
using it to simply generate more demand.

**17. One bench, at 6th Avenue.**
Only 6th Avenue strings. So "Shop" in the app is a **drop and collect point**,
not a service point — 5th Avenue and (later) Purasaiwalkam are counters, and
gear moves to the bench from there. One bench queue, not three. Simplifies the
staff side considerably; the inter-shop hop needs to be a visible step, not an
assumption.

### From the second version

**8. The physical gear tag.**
50 × 25 mm thermal sticker: job code, service, spec, customer, QR. Looped
through the grip or the toe at collection. Scanned at every stage — that scan is
what prevents a mismatch. The tear-off half goes in the tray slot, so a racket
can only ever be handed back against its own code.

This is the part that makes the rest work. An app without it is a database of
jobs with no reliable link to the physical object.

**9. Academy and bulk jobs.**
One pickup, twelve rackets, one job code, a tag per item (`-01`, `-02`, `-03`)
under one collection. Optional GSTIN for a tax invoice.

**Treat this as the lead channel, not a side feature.** The delivery economics
that break on a single ₹550 restring work comfortably across twelve. Chennai has
plenty of academies and coaching centres.

**10. Voice note intake.**
"Send a voice note instead" — describe the job on WhatsApp, staff correct the
job card from it. Tags print from the card, never from the note. Genuinely
useful for an academy sending twelve rackets.

**11. Own rider free inside 3 km, offered first.**
Cheapest leg you control, shown above the partner options.

**12. No sign-in. The phone number is the identity.**
Guest until the confirm step. One OTP, once — then the phone is remembered and
the step disappears.

**13. Purasaiwalkam is parked.**
Two shops in the app until its address and number exist. Correct call.

---

## Screens to build

Ten screens. Build in this order; the first six are a working product on their own.

| # | Screen | Lane | Notes |
|---|---|---|---|
| 1 | Scan landing | Customer | Active job and counter-drop offer above the fold |
| 2 | Service picker | Customer | Restring · bat care · academy/bulk. "Same as last time" first for returning players |
| 3 | Details | Customer | Name, phone, area, shop, address, slot. Voice-note escape hatch |
| 4 | Who moves it | Customer | Counter drop · own rider · partner. Per-leg fare visible against each |
| 5 | Review + confirm | Customer | Live total, damage consent, OTP, then order written → WhatsApp opens |
| 6 | Bench queue | Staff | Three tabs, one action per card, 46px targets — usable with a mallet in hand |
| 7 | Job card + tag print | Staff | Advance stage, print tag, fire work-done message |
| 8 | Track | Customer | Five states, photo strip, UPI ask lands at Ready |
| 9 | Gear locker | Customer | String age as a wear bar; the restring nudge fires from here |
| 10 | Run sheet | Rider | Ordered stops, photo forced at pickup — also how you measure real per-leg cost |

Cut for now: damage-claim screen (handle on WhatsApp from the photo trail),
owner dashboard, retail catalogue, prepaid restring packs.

---

## Stack

Static frontend, as now — no framework needed. Supabase for orders, tags, photos
and the locker. Deployed on Vercel from the repo.

Tables, minimally: `orders`, `order_items` (bulk needs one row per racket),
`status_events` (every staff tap, append-only — this is your audit trail),
`photos`, `gear` (the locker).

Keep the live `index.html` as the public page. The app is a second surface
against the same database, not a rewrite of it.

---

## Rates

Confirmed with Shankar. Old board retained; his changes and additions applied on
top. **All service rates are inclusive of tax. Delivery is charged separately.**

**Stringing** — seventeen strings, ₹500 to ₹1,200, all in (string plus labour),
across Yonex, Victor, Li-Ning and Cosmio. Changes this round: BG80 up to ₹950,
Exbolt 65 and 68 down to ₹1,100, Aero Sonic up to ₹1,200.

**Bat work** — knocking-in ₹500 by hand, ₹800 by machine; oiling ₹100; toe guard
₹100; anti-scuff ₹150; fibre tape ₹150. Grip fitting free.

**New handles**, priced by type rather than quoted: cane ₹750, 6-piece ₹850,
9-piece ₹950, Singapore cane ₹1,200. This removes an inspection step for a
common job.

**Quoted after inspection** — weight reducing (depends on grams removed) and
crack binding.

Two to re-check with Shankar: BG80 is ₹950 while BG80 Power is still ₹850, and
machine knocking is priced 60% above hand.

Rates live in two places per page and must change in both: the string `<select>`
and the `BAT` array in the script, plus the price tables further down.

---

## What's missing

### Blocking — cannot launch publicly without these

**Real rider fares.** The ₹40–90 per-leg table is invented. Log five actual
trips across the shops. This is the number that decides whether pickup is a
business or a subsidy.

**Tax on services — decided.** Service rates are quoted **inclusive of tax**.
That is how the shop has always worked, and both customer pages now say so in
those words.

Two things still need doing for that statement to hold end to end:

- **The till must say the same.** Service lines should be marked tax-inclusive
  on the bill, matching the website. The till is in-house with no API, so this
  is a change for whoever maintains it — not something the web build can do.
- **The rate inside the rate.** “Inclusive of tax” means the tax sits inside the
  price rather than on top of it. Services are currently entered at 0% in the
  till, which makes that embedded amount zero. That may be right for the SAC
  code in use, or it may mean tax is being described as included without being
  broken out. Worth one conversation with whoever files the returns — more so
  once academy and bulk jobs start asking for invoices against a GSTIN.

Neither blocks launch. The first is a till task, the second an accounting check.

**Purasaiwalkam address and phone.** Parked in the app; still parked in reality.

### Operational — no design solves these

**String stock states.** Stock is answered but not designed. Each string needs
three states in the picker: in stock now (express eligible), arrange in a day
(godown or wholesaler), and unavailable. Staff need one screen to flip these.
Without it the app sells express on a string that isn't on the shelf.

**Who answers WhatsApp, on whose phone, during what hours.** Both designs assume
a coordinator exists. That is a staffing decision.

**String stock.** The app offers ten strings. If BG80 is out, the order still
books. No link to till stock, and no "unavailable" state.

**Payment reconciliation.** The till is in-house with no API. UPI collected at
Ready arrives outside it. Who keys it in, against what reference, and when.

**Customer not home.** Rider arrives, nobody there. Who absorbs that fare, and
what does the app do with the job.

**Label printer.** Specced as Zebra ZD230 or TSC TE200 class, 50 mm direct
thermal. Not bought. One per shop, or only at the bench shop?

### Policy — raised earlier, never answered

**Value cap on pickup.** Is there a price above which gear must be dropped in
person rather than ridden across town? This bounds your worst-case damage
exposure while volume is small.

**Damage remedy ladder.** Refund, restring, or replace — who decides, and at
what threshold does it go to the owner.

**Personal data.** Name, phone and address stored in Supabase. Worth a short
retention line under the DPDP Act, and worth not keeping addresses forever.

### Carried over from the page

**`og:image` is still unset.** WhatsApp shares show no preview picture. Needs a
real hosted 1200 × 630 file.

**Three visual systems now exist.** The live page (brass and neon), the older
light pages, and Modernist from the design exports. Pick one before building ten
screens in a fourth.

---

## Build order

1. Supabase schema and the order-write path — nothing else works without it
2. Screens 1–5, writing real orders, WhatsApp opening *after* the write
3. Screen 6–7, bench queue and tag printing, on real hardware
4. Log five rider trips; replace the fare table with real numbers
5. Screens 8–10

Stop after step 3 and run twenty real jobs before building anything else.
