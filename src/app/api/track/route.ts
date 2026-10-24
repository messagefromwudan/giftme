import { z } from "zod";
import { findOrderForCustomer } from "@/lib/orders";
import { clientIp, LIMITS, rateLimit } from "@/lib/ratelimit";
import { errorResponse, json, publicOrder, readJson, tooMany } from "@/lib/http";

const schema = z.object({
  id: z.string().max(20),
  token: z.string().max(64).optional(),
  email: z.string().max(120).optional(),
});

export async function POST(req: Request) {
  try {
    const wait = await rateLimit(LIMITS.track, clientIp(req.headers));
    if (wait) return tooMany(wait);
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) return json({ error: "INVALID_INPUT" }, 400);
    const order = await findOrderForCustomer(parsed.data.id, parsed.data);
    // Same answer for "no such order" and "wrong email", so order numbers can't be probed.
    if (!order) return json({ error: "NOT_FOUND", message: "No order matches these details" }, 404);
    return json({ order: publicOrder(order) });
  } catch (e) {
    return errorResponse(e);
  }
}
