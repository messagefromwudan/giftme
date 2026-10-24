import { z } from "zod";
import { revealPassCode } from "@/lib/messages";
import { clientIp, LIMITS, rateLimit } from "@/lib/ratelimit";
import { errorResponse, json, readJson, tooMany } from "@/lib/http";

// "Dăruiește mai departe": the recipient reveals their single-use −15% PASS-IT-ON code.
export async function POST(req: Request) {
  try {
    const wait = await rateLimit(LIMITS.track, clientIp(req.headers));
    if (wait) return tooMany(wait);
    const parsed = z.object({ id: z.string().min(22).max(64) }).safeParse(await readJson(req));
    if (!parsed.success) return json({ error: "INVALID_INPUT" }, 400);
    return json(await revealPassCode(parsed.data.id));
  } catch (e) {
    return errorResponse(e);
  }
}
