import { after } from "next/server";
import { checkoutOpen, createOrder, patchOrder } from "@/lib/orders";
import { sendOrderEmails } from "@/lib/emails";
import { clientIp, LIMITS, rateLimit } from "@/lib/ratelimit";
import { errorResponse, json, publicOrder, readJson, tooMany } from "@/lib/http";

const MIN_FILL_MS = 4000;

// Website checkout. Orders from AI agents go through /api/agent/order and need human approval.
export async function POST(req: Request) {
  try {
    if (!checkoutOpen()) return json({ error: "CHECKOUT_CLOSED", message: "Online orders open on 2 November 2026" }, 403);
    const wait = await rateLimit(LIMITS.order, clientIp(req.headers));
    if (wait) return tooMany(wait);

    const body = (await readJson(req)) as Record<string, unknown>;
    // Anti-bot: a hidden field humans never fill, and a minimum time on the form.
    if (typeof body.website === "string" && body.website !== "") return json({ ok: true }, 200);
    const startedAt = Number(body.startedAt);
    if (!startedAt || Date.now() - startedAt < MIN_FILL_MS) {
      return json({ error: "TOO_FAST", message: "Please review the form and try again" }, 400);
    }

    const idempotencyKey = req.headers.get("idempotency-key") ?? undefined;
    const { order, replayed } = await createOrder(body, { source: "web", idempotencyKey, siteOrigin: new URL(req.url).origin });
    if (!replayed) {
      after(async () => {
        const emails = await sendOrderEmails(order);
        await patchOrder(order, (o) => Object.assign(o.emails, emails));
      });
    }
    return json({ ok: true, order: publicOrder(order), token: order.token }, replayed ? 200 : 201);
  } catch (e) {
    return errorResponse(e);
  }
}
