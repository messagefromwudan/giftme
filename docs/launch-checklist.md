# GiftMe! — launch checklist (2 Nov 2026)

## 1. Real-phone test (one iPhone with Safari, one Android with Chrome)

Use the dev preview link (log in to Vercel on the phone) or production after the release.
Tick each item on both phones.

**Browsing**
- [ ] Home page loads fast, nothing sticks out sideways, the "Meniu" button opens and closes.
- [ ] RO/EN switch works on the home page and on a box page.
- [ ] Every box page opens; prices match the printed catalog.
- [ ] /confirma-prezenta/ (RSVP) still opens and looks right.

**Ordering**
- [ ] Add 2 boxes → cart shows DUO −10 %; change quantity and remove work with a thumb.
- [ ] Checkout: email field opens the email keyboard, phone field the number pad, the date picker works.
- [ ] "Comandă de exercițiu" notice is visible on cart, checkout and confirmation.
- [ ] Confirmation email arrives on the phone; "Urmărește comanda" opens the tracking page.
- [ ] GM-09: gift idea field and GM-09 terms checkbox appear; Moldova outside Chișinău is refused.

**QR message**
- [ ] From the confirmation email: "Înregistrează mesajul" → allow microphone → record audio → save.
- [ ] Same with video (front camera), and with a video picked from the gallery.
- [ ] Scan the QR code shown on the page with the OTHER phone's camera → the message opens.
- [ ] Audio and video play on both phones (an iPhone video on Android and vice versa).
- [ ] "Vreau codul meu de −15%" shows a PASS code; reloading shows the same code.

**AI**
- [ ] Harta emoției: questionnaire chips are easy to tap; a reply arrives; "Adaugă în coș" fills the cart.
- [ ] /agent-demo: the live log is readable; the order step shows "awaiting approval".
- [ ] With checkout open: /agent-demo places a real practice order.

**Admin (team phone)**
- [ ] "Deschide în admin" from an order email → login → lands on that order.
- [ ] Change a status; the customer receives the status email.

## 2. Release (dev → main), after the director's approval

1. Production variables (Vercel → Settings → Environment Variables → Production):
   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SMTP_USER, SMTP_PASS, OPENAI_API_KEY, and
   ADMIN_PASSWORD set to the **real** password (not the preview test password).
   CHECKOUT_OPEN=true opens online ordering (website, agent API, MCP, /agent-demo); unset or any
   other value keeps it closed. See "Open / close checkout" below.
2. Merge `dev` into `main` (fast-forward). Vercel deploys production automatically.
3. Smoke test on www.giftme.site: home, a box page, /cos/, /harta-emotiei/, /llms.txt,
   /catalog.json, /openapi.json, /.well-known/mcp.json, /confirma-prezenta/, /admin/ login.
4. Rollback if anything is wrong: Vercel → Deployments → previous production → "Instant Rollback".

## Open / close checkout

One switch: the Production variable `CHECKOUT_OPEN` (exactly `true` = open; anything else = closed).
Vercel reads variables at deploy time, so every change needs a redeploy (about 1 minute).

- Close: Vercel → Settings → Environment Variables → `CHECKOUT_OPEN` (Production) → Edit → `false` → Save,
  then Deployments → latest Production → ⋯ → Redeploy. Or in a terminal:
  `printf false | vercel env update CHECKOUT_OPEN production -y && vercel redeploy https://www.giftme.site`
  (tested on Preview 24 Oct: about 70 s from the command to the closed site)
- Open again: the same with `true`.
- Check: https://www.giftme.site/api/agent/order answers 403 CHECKOUT_CLOSED when closed;
  /llms.txt says "Ordering is open" or "closed at the moment".

## 3. On 1 Nov (freeze day)

1. Last tests on the preview.
2. ⚠ Checkout is open since 24 Oct, so the database holds real customers' practice orders. Do NOT run
   `supabase/cleanup-before-launch.sql` as is: it deletes every order and message. Delete only
   recognised test orders, or skip the cleanup.
3. After launch, keep Preview away from real data: create a second Supabase project for Preview
   (same migration) and point the Preview variables at it.
