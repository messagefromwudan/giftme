import { agentPlaceOrder } from "@/lib/agent";
import { checkoutOpen, CHECKOUT_OPENS_AT } from "@/lib/orders";
import { normalizeEmail } from "@/lib/codes";
import { clientIp, LIMITS, rateLimit } from "@/lib/ratelimit";
import { errorResponse, json, preflight, readJson, tooMany, withCors } from "@/lib/http";

export const OPTIONS = preflight;

// Orders from AI agents. Always created as "awaiting_approval": the buyer must confirm by email.
export async function POST(req: Request) {
  try {
    if (!checkoutOpen()) {
      return withCors(json({ error: "CHECKOUT_CLOSED", message: `Online orders open at ${CHECKOUT_OPENS_AT}` }, 403));
    }
    const idempotencyKey = req.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 100) {
      return withCors(
        json({ error: "IDEMPOTENCY_KEY_REQUIRED", message: "Send a unique Idempotency-Key header (8–100 chars) per order" }, 400),
      );
    }
    const wait = await rateLimit(LIMITS.agentOrder, clientIp(req.headers));
    if (wait) return withCors(tooMany(wait));

    const body = (await readJson(req)) as { buyer?: { email?: unknown } };
    if (typeof body?.buyer?.email === "string") {
      const w = await rateLimit(LIMITS.approvalEmail, normalizeEmail(body.buyer.email));
      if (w) return withCors(tooMany(w));
    }
    const result = await agentPlaceOrder(body, { source: "agent_api", idempotencyKey: `agent:${idempotencyKey}` });
    return withCors(json(result, result.replayed ? 200 : 201));
  } catch (e) {
    return withCors(errorResponse(e));
  }
}
