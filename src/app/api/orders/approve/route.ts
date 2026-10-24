import { after } from "next/server";
import { z } from "zod";
import { confirmOrder, findOrderForCustomer, patchOrder } from "@/lib/orders";
import { sendOrderEmails } from "@/lib/emails";
import { clientIp, LIMITS, rateLimit } from "@/lib/ratelimit";
import { errorResponse, json, publicOrder, readJson, tooMany } from "@/lib/http";

const schema = z.object({ id: z.string().max(20), token: z.string().min(10).max(64) });

// Human-in-the-loop: orders placed by AI agents are processed only after the buyer presses
// "Confirm" on the page linked from their email. POST only, so link scanners can't approve.
export async function POST(req: Request) {
  try {
    const wait = await rateLimit(LIMITS.track, clientIp(req.headers));
    if (wait) return tooMany(wait);
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) return json({ error: "INVALID_INPUT" }, 400);
    const order = await findOrderForCustomer(parsed.data.id, { token: parsed.data.token });
    if (!order) return json({ error: "NOT_FOUND", message: "No order matches this link" }, 404);
    if (order.status !== "awaiting_approval") return json({ ok: true, order: publicOrder(order), already: true });

    const confirmed = await confirmOrder(order, "buyer-approval");
    after(async () => {
      const emails = await sendOrderEmails(confirmed);
      await patchOrder(confirmed, (o) => Object.assign(o.emails, emails));
    });
    return json({ ok: true, order: publicOrder(confirmed) });
  } catch (e) {
    return errorResponse(e);
  }
}
