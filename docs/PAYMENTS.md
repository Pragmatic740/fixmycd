# Payments: $1 identity check and donations

## What runs today: a demo

**No real money moves.** The checkout on `/signup` (after creating an account),
`/verify` and `/donate` is a demo, labelled "Demo — no real charge" on screen.

- The server (`src/lib/payments-demo.ts`) validates the card number (Luhn),
  expiry, CVC length and name, and accepts **only** the test card
  `4242 4242 4242 4242`.
- Only the last 4 digits are stored, in `demo_payments`
  (`kind = verification | donation`, `amount_cents`, `last4`, `user_id`).
  The full number and CVC are never stored or logged.
- `POST /api/verify` (email + password + card) activates a pending account:
  `status = approved`, `verified_at`, `verification_method = 'card_demo'`,
  then signs the user in. Admins see a "verified by $1" badge.
- `POST /api/donate` (amount in cents + card) records a donation; signed-in
  donors are linked to their account.
- Both are rate-limited (`payment`: 10 / hour per IP).

## Why $1

1. It confirms a real person is behind the account, so it can be active at
   once instead of waiting for manual approval.
2. It helps pay to run the service.
3. It raises the cost of fake posts, abusive language and other bad-faith
   accounts. No data is sold.

## Going live with Stripe

Replace the demo with [Stripe Checkout](https://stripe.com/docs/payments/checkout)
so card details go straight to Stripe and never touch our server:

1. Create a Stripe account; add `STRIPE_SECRET_KEY` and
   `STRIPE_WEBHOOK_SECRET` to the Vercel environment.
2. `/api/verify` and `/api/donate` create a Checkout Session (amount, the
   user's id in `metadata`, success/cancel URLs) and return its URL; the page
   redirects there instead of showing the card form.
3. A webhook route (`checkout.session.completed`, signature verified) does what
   the demo does today: activate the account or record the donation, storing
   Stripe's payment id instead of `last4`.
4. Remove the demo card form and `checkDemoCard`.
5. Card payments become PCI SAQ A scope (Stripe hosts the form). Add refunds
   and a receipts email as needed.

Until then, keep the "Demo — no real charge" labels: real cards are rejected.
