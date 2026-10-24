import { z } from "zod";
import { checkoutOpen, deliveryDateBounds, priceOrder } from "@/lib/orders";
import { clientIp, LIMITS, rateLimit } from "@/lib/ratelimit";
import { errorResponse, json, readJson, tooMany } from "@/lib/http";

const schema = z.object({
  items: z.array(z.object({ boxId: z.string().max(10), quantity: z.number().int().min(1).max(100) })).min(1).max(20),
  zone: z.enum(["chisinau", "moldova"]).default("chisinau"),
  code: z.string().max(40).optional(),
  email: z.email().max(120).optional().or(z.literal("").transform(() => undefined)),
});

// Prices a cart on the server. The browser never computes prices or discounts.
export async function POST(req: Request) {
  try {
    const wait = await rateLimit(LIMITS.quote, clientIp(req.headers));
    if (wait) return tooMany(wait);
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) return json({ error: "INVALID_INPUT", details: z.flattenError(parsed.error) }, 400);
    const { quote, code } = await priceOrder(parsed.data);
    return json({ quote, code, checkoutOpen: checkoutOpen(), deliveryDates: deliveryDateBounds() });
  } catch (e) {
    return errorResponse(e);
  }
}
