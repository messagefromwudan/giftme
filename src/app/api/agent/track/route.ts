import { z } from "zod";
import { agentTrack } from "@/lib/agent";
import { clientIp, LIMITS, rateLimit } from "@/lib/ratelimit";
import { errorResponse, json, preflight, readJson, tooMany, withCors } from "@/lib/http";

export const OPTIONS = preflight;

const schema = z.object({ id: z.string().max(20), email: z.string().max(120).optional(), token: z.string().max(64).optional() });

export async function POST(req: Request) {
  try {
    const wait = await rateLimit(LIMITS.track, clientIp(req.headers));
    if (wait) return withCors(tooMany(wait));
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) return withCors(json({ error: "INVALID_INPUT" }, 400));
    const order = await agentTrack(parsed.data.id, parsed.data);
    if (!order) return withCors(json({ error: "NOT_FOUND", message: "No order matches these details" }, 404));
    return withCors(json({ order }));
  } catch (e) {
    return withCors(errorResponse(e));
  }
}
