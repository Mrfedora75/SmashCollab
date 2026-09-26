# Smash Collab

Smash Collab is a swipe-style desk where YouTube creators find collab partners.
Creators verify their channel with Google (read-only YouTube access), pick their
niches, then **Pass** or **Pitch** other creators. When two creators pitch each
other it's a **match**, and they can message. Free creators get 4 pitches a day
to channels under 5,000 subscribers; **Plus** (Stripe) removes both limits.

Live site: https://smashcollab.com

## Stack

- TanStack Start (React 19, Vite) deployed on Vercel (Nitro `vercel` preset)
- Firebase Auth (Google) + Cloud Firestore for profiles, swipes, matches, messages
- YouTube verification via Google OAuth (`/api/youtube/start` → `/api/youtube/callback`)
- Stripe Checkout + webhook for Plus and extra pitches; entitlements stored in
  Firestore (server-side, keyed by YouTube channel ID)

## Develop

```bash
npm install
npm run dev        # http://localhost:8080
npm run build      # production build (.vercel/output)
npm run typecheck
npm run lint
npm test
```

## Environment variables

| Name | Where | Purpose |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | server | YouTube/Google OAuth. The secret also signs session cookies. |
| `VITE_FIREBASE_*` | client + server | Firebase web config (project `smash-collab`). Public by design. |
| `FIREBASE_SERVICE_ACCOUNT` | server | Service-account JSON (raw or base64) used to store Plus entitlements, Stripe sessions and invite rewards in Firestore. **Required for payments.** |
| `STRIPE_SECRET_KEY` | server | Stripe secret key. Live keys (`sk_live_…`) are refused unless `STRIPE_ALLOW_LIVE=true`. |
| `STRIPE_WEBHOOK_SECRET` | server | Signing secret of the Stripe webhook endpoint. |
| `STRIPE_ALLOW_LIVE` | server | Set to `true` only when you are ready to take real payments. |
| `STRIPE_PRICE_PLUS_MONTHLY`, `STRIPE_PRICE_PLUS_ANNUAL`, `STRIPE_PRICE_PITCH` | server | Optional fixed Stripe price IDs (otherwise created/looked up by lookup key). |
| `PLUS_COOKIE_SECRET` | server | Dedicated secret for the signed `matchcut_plus` cookie (falls back to the Google client secret for now). |
| `PLUS_COMP_EMAILS`, `PLUS_COMP_CHANNEL_IDS` | server | Comma-separated tester allowlist that gets free Plus. Checked on the server against the verified Google email / YouTube channel ID. |

## Firestore rules

Security rules and indexes live in `firestore.rules` / `firestore.indexes.json`.
Deploy them with the Firebase CLI:

```bash
npx firebase-tools deploy --only firestore:rules,firestore:indexes --project smash-collab
```

## Stripe webhook

Endpoint: `https://smashcollab.com/api/stripe/webhook` with events
`checkout.session.completed`, `checkout.session.async_payment_succeeded`,
`customer.subscription.updated`, `customer.subscription.deleted`.

Rules tests (needs Java for the Firestore emulator): `npm run test:rules`.
