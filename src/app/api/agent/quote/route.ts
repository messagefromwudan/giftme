import { z } from "zod";
import { agentQuote, quoteInput } from "@/lib/agent";
import { clientIp, LIMITS, rateLimit } from "@/lib/ratelimit";
import { errorResponse, json, preflight, readJson, tooMany, withCors } from "@/lib/http";

export const OPTIONS = preflight;

export async function POST(req: Request) {
  try {
    const wait = await rateLimit(LIMITS.agentQuote, clientIp(req.headers));
    if (wait) return withCors(tooMany(wait));
    const parsed = quoteInput.safeParse(await readJson(req));
    if (!parsed.success) return withCors(json({ error: "INVALID_INPUT", details: z.flattenError(parsed.error) }, 400));
    return withCors(json(await agentQuote(parsed.data)));
  } catch (e) {
    return withCors(errorResponse(e));
  }
}
