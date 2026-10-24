import { askReply, askSchema, fallbackIntro, MAX_ASK_MESSAGES } from "@/lib/ask";
import { listOpenAIModels } from "@/lib/llm";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { errorResponse, json, readJson, tooMany } from "@/lib/http";

export const maxDuration = 60;

// Model comparison, ONLY on preview deployments (behind Vercel login): the x-eval-model header
// picks the model for one request, and the reply carries token usage and the model's own words
// when a guard replaced them. Production ignores the header and never returns these fields.
const evalAllowed = () => process.env.VERCEL_ENV === "preview";
const evalModel = (req: Request) => {
  const m = req.headers.get("x-eval-model");
  return evalAllowed() && m && /^[a-z0-9][a-z0-9.\-]{2,48}$/i.test(m) ? m : undefined;
};

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

    const model = evalModel(req);
    const { usage, model: used, original, problems, ...reply } = await askReply(parsed.data, { model });
    return json(evalAllowed() ? { ...reply, usage, model: used, original, problems } : reply);
  } catch (e) {
    return errorResponse(e);
  }
}

/** Preview only: the model ids the configured key can use. */
export async function GET() {
  if (!evalAllowed()) return json({ error: "NOT_FOUND" }, 404);
  try {
    return json({ models: await listOpenAIModels() });
  } catch (e) {
    return json({ error: (e as Error).message.slice(0, 200) }, 502);
  }
}
