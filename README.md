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

None are required yet. They are added in Vercel (Project → Settings → Environment Variables), never in git.
Planned:

| Variable | Used for |
| --- | --- |
| `ANTHROPIC_API_KEY` | On-site agent "Harta emoției" |
| `ADMIN_PASSWORD` | Admin dashboard |
| `DATABASE_URL` | Orders, messages, codes (Neon Postgres via Vercel Marketplace) |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Rate limiting (Upstash Redis via Vercel Marketplace) |
| `BLOB_READ_WRITE_TOKEN` | Private audio/video messages (Vercel Blob) |
| `RESEND_API_KEY` or `SMTP_USER` / `SMTP_PASS` | Order and status emails |

## Content rules

- Never write "preț la cerere"; every price comes from the catalog.
- No third-party brand names: name products generically.
- Don't claim to be the "first practice company" doing anything; say "built for AI agents".
- No fictional fiscal or bank data.
- Replace a box illustration with a photo by adding `photo` to the box in `catalog.ts`.
