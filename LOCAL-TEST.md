# Local testing and next steps

The canonical customer page is index.html. test-links.html simulates academy,
play-area and shop QR scans. The other two customer pages are legacy variants;
do not use them for new posters.

## Start

From this repository run:

    python -m http.server 8765 --bind 127.0.0.1

Open http://127.0.0.1:8765/test-links.html. This server is local to the computer.
No build, database or credentials are needed. Stop with Ctrl+C.

## QR contract

- `src`: unique location label (up to 100 characters), included in WhatsApp.
- `svc=string` or `svc=bat`: optional service preselection.
- `sport=badminton` or `sport=cricket`: supported aliases.
- Without a service parameter, the customer chooses the service.

For printed posters use the final public HTTPS URL, not the local test URL.
The source label identifies a referral; it does not select a collection point.
The current main flow is counter drop at Sportline 6th Avenue. Rider pickup
is not offered in this phase. `move` and `area` are not supported by index.html.

## What this version does

Customer chooses a service, supplies contact and optional gear details, reviews
an estimate, and opens WhatsApp with the request. The customer must press Send;
staff confirm availability, final price and turnaround. No order is stored or
confirmed by the website. Payment choices are preferences, not online payments.

## Next phase

1. Confirm the price list, hours, WhatsApp recipient and counter-drop workflow.
2. Deploy this branch to a preview URL and test on Android/iPhone with staff.
3. Add an order database and server endpoint with validated prices and inputs,
   abuse protection, a request idempotency key and a returned job reference.
   Save the order before offering WhatsApp. Never put server credentials in HTML.
4. Add authenticated staff access and a queue: requested, accepted, at bench,
   ready, collected; maintain a status history and tags for physical gear.
5. Add private customer tracking links, retention rules and payment confirmation.
6. Print a distinct QR per location only after choosing the permanent domain;
   test the printed codes and run a small academy pilot before wider rollout.

Rider collection needs confirmed fares, service areas and a fulfilment process
before it is added to the canonical page.
