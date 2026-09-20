# Sportline — Gear Care

## Current pages

- [`concept/`](concept/): redesigned customer page with real racket photography and WhatsApp requests.
- [`pilot/`](pilot/): saved-booking customer flow, gated until Supabase activation.
- [`pilot/staff.html`](pilot/staff.html): approved staff sign-in and counter queue.
- [`pilot/print-qr.html`](pilot/print-qr.html): shop QR posters, printable after activation on the public HTTPS site.
- [`PILOT-SETUP.md`](PILOT-SETUP.md): database activation and daily counter workflow.

Uploading these static files does not apply the SQL migrations. The pilot remains
disabled until database security, staff access and a live booking test are verified.
The original customer page remains at `index.html`.

> Current setup: `index.html` is the canonical QR landing page. See
> [LOCAL-TEST.md](LOCAL-TEST.md) for the current QR parameters, local preview,
> supported workflow and next steps. `test-links.html` has three sample journeys.
> The historical notes below describe earlier versions and are not the current
> contract: the main page supports `svc`/`sport` and `src`, with counter drop at
> 6th Avenue. It does not offer rider pickup or save orders to a database.

Badminton restringing and cricket bat care, booked online. Anna Nagar, Chennai.

A customer scans a QR code or opens the link, fills a short form, and taps one
button. WhatsApp opens with the whole order written out and addressed to the
shop. Staff reply, arrange collection if needed, and run the job from that
thread.

No backend, no database, no build step. Open the file in a browser and it works.

---

## What's in here

```
index.html            the customer page — dark banner header, light form, ~75 KB
gear-care.html        the same booking flow in the neon/brass styling, ~148 KB
SPEC.md               decisions, screens, rates, open questions
assets/
  sportline-neon.mp4  hero background loop, used by gear-care.html only
  og-gear-care.jpg    link-preview image for WhatsApp and social shares
```

**Two customer pages, same booking flow, two visual treatments.** Both are live
so they can be compared on a real phone before one is retired.

- `index.html` — full-bleed Sportline banner across the top, then system fonts and
  white cards. No webfonts, no video. Fewest decisions on screen. Built for someone
  standing at a court. The counter-drop path is written as a conversation — it asks
  the shop to confirm price and stock rather than pretending to be a booking.
- `gear-care.html` — embedded Cormorant and Manrope, neon sign in the hero,
  dark brass palette, fuller price tables and a how-it-works section.

Both are fully self-contained: fonts and images are embedded as base64, so
**neither page makes any external request**. The only exception is
`sportline-neon.mp4`, which is too large to inline and is loaded by
`gear-care.html` only on wide screens, on a good connection, with motion
allowed. If the file is missing the page falls back to a still image.

A separate staff app (bench queue, job statuses, tag printing, string stock)
lives outside this repo as a Claude artifact, and is organisation-internal.

---

## Deploying

Any static host. No server, no build command, no output directory.

**Vercel** — import the repo, leave every setting at its default, deploy. Every
push redeploys automatically.

Keep the `assets/` folder path exactly as it is; the pages reference it
relative to themselves.

---

## QR codes

A QR code is just a URL. Both pages read query parameters on load and prefill
themselves, so a different code can be printed for each location.

| Parameter | Values | Effect |
|---|---|---|
| `svc` | `string`, `bat` | Preselects the service |
| `move` | `pickup` | Preselects rider collection instead of counter drop |
| `area` | `Anna Nagar`, `Kilpauk`, `Other nearby` | Preselects the area |
| `src` | any short label | Rides into the WhatsApp message as a `Ref:` line |

```
/?svc=string&src=court-poster
/?svc=bat&src=academy-noticeboard
/?move=pickup&area=Kilpauk&src=kilpauk-flyer
```

Give every printed item its own `src`. It is the cheapest marketing measurement
available here — after a month you know which poster produced which orders.

Print at 3 cm minimum, error correction level H, and always print the URL
underneath. Test the printed code, not the screen. Never use a QR shortener: a
dead code on a printed poster cannot be fixed.

---

## WhatsApp

No API and no integration. The button builds a `wa.me` link with the order
URL-encoded into the `text` parameter, so WhatsApp opens with the message
already typed.

**The customer still has to press send.** Nothing leaves the page by itself.
That is the main cost of this approach, and the main reason to move to the
WhatsApp Business Platform later.

Messages go to the 6th Avenue number, `918056436668`.

---

## Rates

Full board in `SPEC.md`. Two things to know when editing:

- Stringing is billed **all in** — string and labour together, not separately.
- **Service rates are inclusive of tax.** Delivery is charged separately.

Rates live in two places on each page and must be changed in both: the string
`<select>` and the `BAT` array in the script, plus the price tables further
down.

---

## The shop

All stringing and bat work happens at the **6th Avenue bench**. 5th Avenue takes
drop-offs and hands finished gear back. Purasaiwalkam is not in the app until
its address and phone number exist.

A restring takes about 30 minutes on the machine. Normal turnaround is one to
two hours; the pages promise **same day**, deliberately, so the promise survives
a busy Saturday.

---

## Open

**Rider fares are placeholders.** The per-leg table (₹40–90 by area, charged on
both legs) is invented. Log five real trips and replace it. Every price on the
page is labelled "est." until then, and the exact figure is confirmed on
WhatsApp before a rider leaves. **This is the last thing to fix before printing
QR codes.**

**The till should state tax-inclusive too**, matching the website. In-house app,
no API — a task for whoever maintains it.

**Two rates to re-confirm with Shankar:** BG80 is ₹950 while BG80 Power is still
₹850, and machine knocking is priced 60% above hand.

**One page should eventually win.** Running both is fine for comparison, not for
maintenance — the two booking forms will drift the first time a price changes.
`gear-care.html` has not had the conversational rewrite; `index.html` has.

**`og:image` points at sportlinestores.com.** Until the custom domain is set up,
WhatsApp link previews on the `.vercel.app` address will not find the image.
Update the four `og:` URLs in both pages once the real domain is live.

---

## Editing

One file each, plain HTML/CSS/JS, no framework. After changing a script block:

```bash
python3 -c "import re;open('/tmp/x.js','w').write(re.search(r'<script>(.*?)</script>',open('index.html').read(),re.S).group(1))"
node --check /tmp/x.js
```
