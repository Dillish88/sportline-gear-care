# Customer-page concept

A separate alternative at `/concept/`. The existing customer pages are unchanged.

The approach: service first, contact second, explicit review last. A live estimate
stays alongside the form on desktop and below it on mobile. Optional string setup
controls are tucked behind an expandable section. Neither stock nor turnaround is
presented as a confirmed live fact.

Source data: the supplied index.html catalogue (12 priced strings with colour
preferences), bat-service and handle prices; PROJECT.md's one-bench workflow;
the two shop addresses in the supplied QR posters. The original logo and Manrope
fonts are local assets. There are no external fonts, scripts or image requests.

The ₹100 priority option is a request, charged only if confirmed. The unconfirmed
₹50 tier is omitted. Bat timing is left for inspection. A source label attributes
the QR referral; `shop=5th` separately selects the drop-off point.

This is a functioning customer UI concept, not a database-connected booking app.
WhatsApp is the real handoff, with an explicit Send step and shop confirmation.
No request is persisted and no fabricated job code is shown.

Preview using the existing local server at http://127.0.0.1:8765/concept/.
Example: `/concept/?svc=bat&src=academy-demo&shop=5th`.
Supported service parameters: sport=bad/badminton/cri/cricket or svc=string/bat.

Browser regression check: `node tests/concept-flow.cjs` from the repository root,
with Playwright available and Microsoft Edge installed, while the server runs.

## Hero photography

Real badminton racket photo by Glen Carrie on Unsplash, downloaded 19 September 2026.
Source: https://unsplash.com/photos/a-badminton-racket-with-a-white-shuttle-on-it-wieTrtA9v6I
License: https://unsplash.com/license (free commercial and non-commercial use).
Local WebP asset, 1000 × 1500 pixels, approximately 190 KB. This is illustrative
equipment photography, not a photograph of Sportline premises or guaranteed stock.
