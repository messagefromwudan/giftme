# GiftMe! — giftme.site

Online store of **FE GiftMe SRL**, a student practice company at CEEF Chișinău: personalized gift boxes,
built so that people *and* their AI agents can browse the catalog and order.

## Stack

- Next.js 16 (App Router, Cache Components) + TypeScript + Tailwind CSS 4, hosted on Vercel (project `giftme`).
- `src/lib/catalog.ts` is the **single source of truth** for boxes, prices, offers and delivery rules.
- `src/lib/pricing.ts` is the **only** place where offers and delivery are computed (server-side, unit-tested).
- Romanian at `/`, English at `/en/` (see `src/proxy.ts`). Texts live in `src/i18n/index.ts`.
- `public/confirma-prezenta/` is the static launch RSVP page (Google Apps Script backend in `apps-script/`).
  Do not change it before the 2 Nov 2026 event.

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # pricing unit tests
npm run lint
npm run build && npm start   # production build
```

Node 20+ (Vercel uses Node 24).

## Deploy

```bash
vercel             # preview deployment
vercel --prod      # production (www.giftme.site)
```

Production should only be deployed from a clean, tested `main`.

## Environment variables

Set in Vercel (Project → Settings → Environment Variables, mark secrets **Sensitive**), never in git.
See `.env.example` for local development. Everything runs locally without any of them: orders are
kept in memory and emails are printed to the console.

| Variable | Required | Used for |
| --- | --- | --- |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | for orders | Upstash Redis (Vercel Marketplace → Storage). Without it, ordering returns "temporarily unavailable" on Vercel. |
| `ADMIN_PASSWORD` | for admin | Admin dashboard at `/admin/` (min. 10 characters). Changing it logs everyone out. |
| `SMTP_USER`, `SMTP_PASS` | for emails | Gmail account `fe.giftme@gmail.com` + a Gmail **app password** (Google Account → Security → 2-Step Verification → App passwords). |
| `CHECKOUT_OPEN` | optional | `true` / `false` overrides the launch time (online orders open 2 Nov 2026, 09:30). Use `true` on Preview for testing. |
| `ORDER_NOTIFY_TO` | optional | Where new-order emails go (default `fe.giftme@gmail.com`). |
| `SITE_URL` | optional | Base URL in emails (default `https://www.giftme.site`). |
| `ANTHROPIC_API_KEY` | later | On-site agent "Harta emoției". |

## Orders

- Every order is a **comandă de exercițiu** (practice-company order): no real payment or delivery.
- Website orders start as **Primită**; orders placed by AI agents start as **Așteaptă confirmarea clientului**
  and only move on when the buyer presses "Confirm" on the link we email them.
- Admin (`/admin/`): change status (emails the customer), quote GM-09 gifts (above 5,000 MDL the
  coordinator must approve in writing before "bought"), export CSV/XLSX for accounting.
- Anti-abuse: honeypot field, minimum time on the form, per-IP rate limits, idempotency keys,
  server-side validation of every field. Customer text is stored and shown as data only.

## Content rules

- Never write "preț la cerere"; every price comes from the catalog.
- No third-party brand names: name products generically.
- Don't claim to be the "first practice company" doing anything; say "built for AI agents".
- No fictional fiscal or bank data.
- Replace a box illustration with a photo by adding `photo` to the box in `catalog.ts`.
