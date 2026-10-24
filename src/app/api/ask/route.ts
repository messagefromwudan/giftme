import { askReply, askSchema, fallbackIntro, MAX_ASK_MESSAGES } from "@/lib/ask";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { errorResponse, json, readJson, tooMany } from "@/lib/http";

export const maxDuration = 60;

// Free questions in the chat widget. Stateless: the browser sends the short conversation each
// time and nothing is saved. Limits: messages per session, requests per visitor, and a daily cap
// on model calls; when the daily cap is reached the widget switches to its fixed answers.
export async function POST(req: Request) {
  try {
    const parsed = askSchema.safeParse(await readJson(req, 40_000));
    if (!parsed.success) return json({ error: "INVALID_INPUT" }, 400);
    const userTurns = parsed.data.messages.filter((m) => m.role === "user").length;
    if (userTurns > MAX_ASK_MESSAGES) return json({ error: "SESSION_LIMIT" }, 429);

    const perIp = await rateLimit({ name: "ask", max: 20, windowSec: 600 }, clientIp(req.headers));
    if (perIp) return tooMany(perIp);
    const daily = await rateLimit({ name: "ask-daily", max: 400, windowSec: 86_400 }, "all");
    if (daily) return json({ text: fallbackIntro(parsed.data.lang), fallback: "budget" });

    return json(await askReply(parsed.data));
  } catch (e) {
    return errorResponse(e);
  }
}
