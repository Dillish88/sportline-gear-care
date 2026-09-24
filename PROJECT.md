# Current pilot decisions — 24 September 2026

The original handoff brief follows, preserved as historical context. These current decisions take precedence where it differs.

- `/book/` is the only customer booking application; root and retired routes redirect to it.
- 6th Avenue is the bench; 5th Avenue is drop/collection only. No Purasaiwalkam or rider pickup.
- Customer repair details are anonymised 12 months after collection/cancellation. Open jobs require review, not silent deletion.
- Offers require a separate optional opt-in, confirmed by staff at the counter. Marketing contact permission lasts 12 months and can be withdrawn.
- Staff review and send WhatsApp updates manually. No automatic sending or delivery confirmation.
- 20 badminton slots per day, 10:30am–9pm with a 2:00–2:30pm break. Slot end is ready-by; racket must reach the bench before start. Urgent costs ₹100 for the earliest available slot within that capacity.
- Missing prices await Shankar; do not invent prices.
- Tax-inclusive service prices; split GST treatment awaits the CA. No financial saving is assumed.
- Domain control and renewal must be settled before printing permanent QR posters.

---

# Sportline Gear Care — project brief

Sportline is a sports retailer in Anna Nagar, Chennai. Three shops. This project
turns its racket stringing and cricket bat work into a bookable service with a
real order system behind it.

Read this before changing anything. Most of the decisions here were made against
constraints that are not obvious from the code.

---

## What we are trying to achieve

**For the customer.** Know the price before travelling. Know the string is on the
shelf before travelling. Say when they need the racket back and have that mean
something. Get told when it is ready without having to ring.

**For the shop.** Every job exists as a record rather than a conversation.
Staff see what is waiting without reading a chat thread. Work moves through
stages by tapping, not remembering. Physical gear is tied to a job code so the
right racket goes back to the right person.

**Commercially.** Capture the demand already walking in and being turned away,
charge properly for urgency, and stop guessing at margin.

**What this is not.** Not a marketplace, not an aggregator, not a delivery
platform. One shop, its own customers, its own bench.

---

## The shop, as it actually works

Everything in the design follows from these. They were established by asking,
and several of them overturned earlier assumptions.

**One bench, at 6th Avenue.** 5th Avenue takes drop-offs and hands finished gear
back; nothing is strung there. Purasaiwalkam is not in the app at all — no
address or phone yet. So "shop" in the UI means a drop-and-collect point, not a
service point.

**Two people string.** Illiyas, part-time, 10am–3pm, gets through 5–8 rackets
while also serving customers and handling stock. Shankar covers after 3pm —
alongside purchasing, supplier payments and phone calls. He is the constraint in
the business, not the machine.

**A restring takes about 30 minutes.** Normal turnaround is one to two hours.
The page promises **same day**, deliberately: the public promise has to survive
a packed Saturday, not describe a quiet Tuesday.

**Bat work happens 5–8am**, before the shop opens, and only Shankar does it.
Hand knocking-in is 6–8 hours, which is two or three entire mornings. Bat work is
therefore **never same-day**, and the customer is never asked to pick a time for
it — the page states what will happen based on what they selected.

**Load is lumpy.** Quiet weekdays, packed weekends. This is why priority pricing
is sold as a queue jump rather than as speed, and why it is hidden when there is
no queue to jump.

**Footfall is not the problem.** Customers have been turned away at 5th Avenue
because there is no bench there. That is demand already in the building, lost to
geography. Recovering it is the cheapest revenue available.

---

## What exists

```
index.html            the customer booking page
invoice-print.html    72mm GST tax invoice + job slip for the Rugtek RP326
print-qr.html         printable A4 counter posters with QR codes
db/schema.sql         Supabase schema, already applied
db/connection.md      credentials and the security model
SPEC.md               fuller decision record and screen list
assets/               header video, link-preview image
```

Hosted on Vercel from GitHub (`Dillish88/sportline-gear-care`), deployed on push.
Custom domain `book.sportlinestores.com` is claimed in Vercel but **the DNS
record has not been created**, so it does not resolve yet.

A staff prototype exists as a Claude artifact — bench queue, stage taps, tag
printing, stock toggles. It runs on artifact storage, not Supabase, and its PIN
gate is not real security.

### The booking page

Self-contained HTML. Fonts, logo and images embedded as base64; **zero external
requests**. About 103 KB, 64 KB over the wire. The header video is the one
exception and loads conditionally.

Entry is a choice of Badminton or Cricket bat. Picking one opens that flow only.
QR codes can skip the choice with `?sport=bad` or `?sport=cri`.

**Badminton** — brand, string, colour, tension (18–35, with separate mains and
crosses available), knots, pre-stretch, when needed, payment method. A tension
adviser asks four questions and recommends a tension and string.

**Cricket** — the jobs, a handle grade, and a statement about when it will be
ready rather than a time the customer picks.

Submitting opens WhatsApp with a monospace ticket. **This is the part being
replaced** — see below.

---

## Decisions already made

**Counter drop is pushed hardest.** Two delivery legs on a ₹550 restring is a
third of the bill. Collection exists for people who will pay for it.

**The order must exist before WhatsApp opens.** Today the flow ends at "press
send" — abandon there and the shop never learns someone wanted a restring.

**Five statuses, each a staff tap.** Booked · Collected · At the bench · Ready ·
Returned. Anything finer-grained is fiction and will rot.

**Pay at Ready, not at the door.** Rider carries no cash, nobody argues on a
doorstep.

**A physical tag on the gear.** Job code and QR, looped through the grip. Without
it the database has no reliable link to the object on the bench.

**Priority is queue position, not speed.** Normal is already an hour. Sell it
when there is a queue; hide it when there is not.

**Service rates are inclusive of tax.** This is how the shop has always worked.

**Never promise a time that cannot be met.** This is the rule behind the bat
timing, the same-day wording and the after-7pm behaviour.

---

## Money

Akbar's breakdown on a BG65 restring: string **₹425**, labour **₹125**, total
**₹550**. The string costs **₹365**.

**Split billing is worth ₹44.59 per job.** String under HSN 9506 at 5% and labour
under SAC 998729 at 18% gives GST of ₹39.31. Clubbing the whole ₹550 at 18%
gives ₹83.90. At 20 jobs a day that is roughly ₹2.6 lakh a year. The invoice
tool currently does the clubbed version; **this needs a CA decision** on whether
the supply is composite or mixed.

**Claim input tax credit on strings** — about ₹17.86 a job, roughly ₹1 lakh a
year at 20 jobs a day.

Net margin on a ₹550 restring, after GST and bench time, is around **₹66**. In
the old 0%-GST world it was ₹132. The add-ons carry better margin than the
restring: a ₹100 priority fee nets about ₹85 with no material and no extra
bench time.

---

## What to build next

**1. Replace WhatsApp-as-the-order-system.**

Confirm booking writes to Supabase directly and returns a job code on screen.
The order exists whether or not any message is sent. Realtime is already enabled
on `orders`, so the shop app gets new bookings pushed without polling.

WhatsApp becomes optional: a receipt for the customer, and the channel staff use
to say "ready". Automatic messages from the shop side need the WhatsApp Business
Platform (Meta verification, approved templates) — worth starting that
application early, it is waiting time rather than build time.

**2. Rebuild the staff app on Supabase.**

Real sign-in instead of the PIN. Bench queue driven by realtime. Stage taps
writing `status_events`. Stock toggles writing `stock`. Tag printing from the
job card. A sound and a visible badge on new orders — a tablet left open at the
counter is more dependable than push notifications, which need a service worker
and behave poorly on iOS.

**3. Move the string catalogue into the database.**

It currently lives in the page source, so selling the last set of a colour means
editing HTML and redeploying. `stock` exists for this.

---

## Open items

**Blocking a public launch**

- **Rider fares are invented.** ₹40–90 per leg, charged both ways. Log five real
  trips and replace them. Everything is labelled "est." until then.
- **DNS for `book.sportlinestores.com`.** Claimed in Vercel, record not created.
- **`sportlinestores.com` expires 2 November 2026.** Registered at Hostinger
  under an account that is neither Dillish's nor Akbar's — most likely whoever
  built the old site. If it auto-renews on someone else's card it locks up for
  another year.

**Needs a decision**

- **Split GST billing** — worth ₹2.6 lakh a year, needs a CA to rule on it.
- **The till must also state tax-inclusive** on service lines. In-house app, no
  API, so it is a job for whoever maintains it.
- **Staff logins** — shared or per person.
- **Eleven stocked strings have no price.** Li-Ning AP64 Rainbow, AP70 Turbo,
  Cozmio CZ 600, CZ Power 700, Apacs Cross Court 66, Max Bolt 66, Mas Pro
  BS-1000, Transform TS-One, Kumpoo K65, Gosen G-Pro 70, Hundred JP63 Hunter.
  Also Exbolt 68, which is in stock but missing from the inventory file.
- **Priority at 3 hours is set at ₹50** — my suggestion, not Akbar's. He only
  specified ₹100 for urgent.
- **Value cap on pickup** — is there a price above which gear must be dropped in
  person? This bounds damage exposure while volume is small.

**Worth doing, not urgent**

- **Gauge on every string.** Known for about half the catalogue from pack photos.
  The tension adviser would recommend on real specs rather than assumption.
- **Bulk and academy jobs.** One pickup, twelve rackets, one code, a tag per
  racket. The delivery economics that break on a single restring work
  comfortably across twelve. Possibly a bigger business than the consumer service.
- **The gear locker.** String, tension, date strung, then a restring nudge at
  around forty days — fired Tuesday to Thursday so it lands in quiet bench hours
  rather than on top of a Saturday.

---

## Things that will bite you

**Claude Design had write access to the repo** and twice overwrote `index.html`
with a stale version, re-adding its own files after deletion. Access has been
revoked. Do not reconnect it with write permission.

**GitHub's raw CDN serves stale content** for several minutes. Verifying an
upload immediately will show the old file. Cache-bust or check the live site.

**Dragging a folder into GitHub's web uploader silently uploads nothing.** Open
the folder and drag the files.

**The page must stay self-contained.** No external font, script or image
requests. It is scanned from a QR code at a badminton court, often on mobile
data, and it has to paint immediately.

**Bat and badminton do not work the same way.** Anything that assumes a shared
flow will produce a promise the shop cannot keep.
