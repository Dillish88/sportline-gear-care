repo: Dillish88/sportline-gear-care
branch: main

## Last sync
date: 2026-09-12T13:45:41Z

### Updated in this project
- Read the live Gear Care booking page end to end (form, pricing, WhatsApp link, delivery placeholders).
- Built a mobile app prototype on top of it: QR landing → service → details → pickup partner → review → tracking.
- Added a staff/bench side: job queue, job card, stage advance, and a 50 × 25 mm gear-tag label print.
- Rebuilt the visuals on the bound Modernist design system rather than the repo's dark brass-and-neon page.

## Screen map
| Project screen | Built from |
|---|---|
| Scan landing, Service picker, Details | `index.html` (hero, `#book` cards, `strSel`, `BAT` array, form fields) |
| Pickup & drop, Review | `index.html` (`LEG` table, `lines()`, `render()`, summary block) |
| Booked, Tracking | `README.md` (four-step flow, WhatsApp routing), `index.html` `#how` |
| Job card, Work-done message | `index.html` `message()` + `SHOPS`, `README.md` WhatsApp section |
| Gear tag (label) | New — no repo source; sized for a 50 mm thermal roll |
