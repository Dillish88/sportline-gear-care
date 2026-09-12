# Sportline — Gear Care

Pickup-and-drop booking page for badminton restringing and cricket bat care,
covering Anna Nagar, Kilpauk and Purasaiwalkam.

A customer scans a QR code, fills the form, and taps one button. That opens
WhatsApp with the whole order already written out, addressed to the right shop.
Staff book the delivery rider manually and run the job from that WhatsApp thread.

No backend, no database, no build step. Open `index.html` in a browser and it works.

---

## Structure

```
sportline-gear-care/
├── index.html                    the entire page — CSS, JS, fonts, images all inline
├── assets/
│   └── sportline-neon.mp4        optional hero background loop (~648 KB)
└── README.md
```

`index.html` is deliberately self-contained. Fonts (Cormorant Garamond,
Manrope — subsetted) and the neon sign image are embedded as base64, so the
page makes **zero external requests** and loads in one round trip.

The video is the single exception. At 648 KB it would have tripled the page
weight if inlined, so it ships as a separate file and is loaded conditionally
(see below). **If `assets/` is missing, the page still works** — the still
image stays in place.

---

## Deploying

Any static host. No server, no build.

**Vercel or Netlify** — connect this repo, deploy on push. Free at this volume.
**GitHub Pages** — Settings → Pages → deploy from `main`.
**Own hosting** — upload `index.html` and `assets/` preserving the folder layout.

The page looks for the video at exactly `assets/sportline-neon.mp4` relative to
itself. Keep that path or the video silently won't load (the still remains).

---

## QR codes

A QR code is just a URL. The page reads four query parameters on load and
prefills itself, so you can print a different code for each location:

| Parameter | Values | Effect |
|---|---|---|
| `svc` | `string`, `bat` | Preselects the service |
| `shop` | `6th`, `5th`, `pur` | Preselects the shop, and routes the WhatsApp message to that shop's number |
| `area` | `Anna Nagar`, `Kilpauk`, `Purasaiwalkam`, `Other nearby` | Preselects the area |
| `src` | any short label | Rides into the WhatsApp message as a `Ref:` line |

Examples:

```
/index.html?svc=string&shop=6th&src=court-poster
/index.html?svc=string&shop=5th&area=Anna%20Nagar&src=counter-5th
/index.html?svc=bat&shop=6th&src=academy-noticeboard
```

`src` is the cheapest marketing measurement available here — it tells you which
poster actually produced each order. Use a distinct value per printed item.

Print QR codes at 3 cm minimum and always print the URL underneath; a real
share of people won't scan.

---

## WhatsApp

No API and no integration. The button builds a `wa.me` link with the order
URL-encoded into the `text` parameter, which opens WhatsApp with the message
pre-typed.

**The customer still has to press send.** Nothing leaves the page by itself. If
they abandon at that step you never learn they were interested — that is the
main cost of this approach, and the main reason to move to the WhatsApp
Business Platform later.

Shop routing is in `SHOPS` at the top of the script block:

| Shop | Number |
|---|---|
| Anna Nagar 6th Avenue | 918056436668 |
| Anna Nagar 5th Avenue | 919677056668 |
| Purasaiwalkam | 918056436668 — placeholder, see below |

---

## Hero video loading

The video only downloads when **all** of these hold:

- viewport is 820px or wider
- `navigator.connection.effectiveType` is not 2g or 3g
- data-saver mode is off
- the visitor has not requested reduced motion

On a phone at a badminton court it never downloads. Everyone gets the CSS neon
glow and flicker, which cost nothing and also switch off under reduced motion.

---

## Prices

From the Sportline price board. Stringing is billed **all-in** — string and
labour together, not separately. Grip **fitting is free**; the grip itself is
sold at counter price.

Stringing runs ₹550 (BG65) to ₹1,200 (Exbolt 65/68). Bat work: hand knocking-in
₹650, machine ₹850, weight reducing ₹250, oiling ₹100, toe guard ₹100,
anti-scuff ₹150, fibre tape ₹150. Crack binding is quoted after inspection.

Prices live in two places and **must be changed in both**: the `<select id="strSel">`
options and the `BAT` array in the script, plus the price-list tables lower down
the page.

---

## Open items before this goes public

1. **Purasaiwalkam address and phone.** The footer says "Address to be added"
   and its WhatsApp currently routes to the 6th Avenue number.

2. **Delivery fees are placeholder.** The `LEG` table (₹40–90 per leg) is
   invented. Run five real rider trips across the three shops and replace them
   with actual fares. Charged on both legs, so two legs at real Chennai rates
   could be ₹150–250 — on a ₹550 restring that is a third of the bill, and it
   is the number that decides whether this service is viable.

3. **GST on services.** Services are currently billed at 0% in the till,
   pending the SAC question. A public page advertising ₹1,200 stringing with
   pickup is a larger exposure than an in-shop ₹100 oiling. Settle this with
   whoever files the returns before printing QR codes.

4. **`og:image` is not set.** WhatsApp and social shares of this link show no
   preview picture. Needs a real hosted image file (~1200×630) at a real URL —
   a base64 image cannot do this.

5. **Design system divergence.** This page uses a dark brass-and-neon system
   with serif display type. `quotes.html` and `stringing.html` use the older
   light system (system fonts, red/charcoal/white, flat white cards). Either
   bring those across or accept that this page reads as a separate sub-brand.

---

## Editing

One file, plain HTML/CSS/JS, no framework. After changing the script block it
is worth syntax-checking it:

```bash
python3 -c "import re;open('/tmp/x.js','w').write(re.search(r'<script>(.*?)</script>',open('index.html').read(),re.S).group(1))"
node --check /tmp/x.js
```
