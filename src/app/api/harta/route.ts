import { chatSchema, hartaReply, MAX_USER_MESSAGES } from "@/lib/harta";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { errorResponse, json, readJson, tooMany } from "@/lib/http";

export const maxDuration = 60;

// The on-site assistant. Stateless: the browser sends the short conversation each time.
// Limits: messages per session, requests per visitor, and a daily cap on model calls.
export async function POST(req: Request) {
  try {
    const parsed = chatSchema.safeParse(await readJson(req, 40_000));
    if (!parsed.success) return json({ error: "INVALID_INPUT" }, 400);
    const userTurns = parsed.data.messages.filter((m) => m.role === "user").length;
    if (userTurns > MAX_USER_MESSAGES) return json({ error: "SESSION_LIMIT" }, 429);

    const perIp = await rateLimit({ name: "harta", max: 20, windowSec: 600 }, clientIp(req.headers));
    if (perIp) return tooMany(perIp);
    const daily = await rateLimit({ name: "harta-daily", max: 600, windowSec: 86_400 }, "all");
    if (daily) return tooMany(daily);

    return json(await hartaReply(parsed.data));
  } catch (e) {
    return errorResponse(e);
  }
}
