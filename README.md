# GiftMe! — giftme.site

Online store of **FE GiftMe SRL**, a student practice company at CEEF Chișinău: personalized gift boxes,
built so that people *and* their AI agents can browse the catalog and order.

## Stack

- Next.js 16 (App Router, Cache Components) + TypeScript + Tailwind CSS 4, hosted on Vercel (project `giftme`).
- `src/lib/catalog.ts` is the **single source of truth** for boxes, prices, offers and delivery rules.
- `src/lib/pricing.ts` is the **only** place where offers and delivery are computed (server-side, unit-tested).
- `src/lib/db.ts` is the **only** module that talks to storage: Supabase Postgres + a private Storage
  bucket, used from the server with the service-role key. Schema: `supabase/migrations/`.
- Romanian at `/`, English at `/en/` (see `src/proxy.ts`). Texts live in `src/i18n/index.ts`.
- `public/confirma-prezenta/` is the static launch RSVP page (Google Apps Script backend in `apps-script/`).
  Do not change it before the 2 Nov 2026 event.

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # unit tests (pricing + orders, in-memory store)
TEST_SUPABASE=1 SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm test   # also against a real database
CHROME_PATH="/path/to/chrome" npm run e2e   # browser tests (Playwright): admin deep links, login, storage down
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
| `SUPABASE_URL` | for orders | Supabase project URL, e.g. `https://abcd.supabase.co`. |
| `SUPABASE_SERVICE_ROLE_KEY` | for orders | Supabase **service-role** (secret) key. Server only: never prefix with `NEXT_PUBLIC_`. Without these two, ordering returns "temporarily unavailable" on Vercel. |
| `ADMIN_PASSWORD` | for admin | Admin dashboard at `/admin/` (min. 10 characters). Changing it logs everyone out. |
| `SMTP_USER`, `SMTP_PASS` | for emails | Gmail account `fe.giftme@gmail.com` + a Gmail **app password** (Google Account → Security → 2-Step Verification → App passwords). |
| `CHECKOUT_OPEN` | optional | `true` / `false` overrides the launch time (online orders open 2 Nov 2026, 09:30). Use `true` on Preview for testing. |
| `ORDER_NOTIFY_TO` | optional | Where new-order emails go (default `fe.giftme@gmail.com`). |
| `SITE_URL` | optional | Base URL in emails (default `https://www.giftme.site`). |
| `OPENAI_API_KEY` | for AI | Harta emoției, the site-wide chat widget (free questions, `/api/ask`) and the /agent-demo agent. Without it all run their non-AI fallback (the widget shows fixed FAQ answers). |
| `OPENAI_MODEL` | optional | Model id (default `gpt-6-astra`, OpenAI's recommended starting model). E.g. `gpt-6.1-sol` to cut cost. |
| `OPENAI_MODEL_CHAT` | optional | Model for the chat widget's free questions only; defaults to `OPENAI_MODEL`. |
| `LLM_PROVIDER` | optional | `openai` (default) or `anthropic` (then `ANTHROPIC_API_KEY`, optional `ANTHROPIC_MODEL`). All model calls go through `src/lib/llm.ts`. |

## Database (Supabase)

1. Run `supabase/migrations/20261024120000_giftme_init.sql` once in Supabase → SQL Editor.
2. Every table has row-level security **on** and **no policies**; the `anon` and `authenticated`
   roles have no privileges. Only the server (service-role key) can read or write.
3. Audio/video messages go to the private `messages` bucket (created by the migration) and are
   only ever served through short-lived signed URLs.

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
