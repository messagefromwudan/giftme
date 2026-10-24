import { connection } from "next/server";
import { dbConfigured } from "@/lib/db";
import { json } from "@/lib/http";
import { runDailyCleanup } from "@/lib/cron";
import { clientIp, rateLimit } from "@/lib/ratelimit";

// Daily Vercel cron (vercel.json). Keeps the free Supabase project active and deletes expired
// data: rate-limit windows, idempotency keys, QR messages 30 days after the PASS-IT-ON reveal
// and, from RULES.unrevealedMessagesDeleteOn, messages never revealed (promises in our terms, so
// they must not depend on any optional secret). Each step runs on its own (see lib/cron.ts). It
// only ever removes already-expired rows, so it is safe to call; a rate limit stops hammering.
export async function GET(req: Request) {
  await connection();
  if (!dbConfigured()) return json({ ok: false, error: "DB_NOT_CONFIGURED" }, 503);
  try {
    if (await rateLimit({ name: "cron", max: 5, windowSec: 600 }, clientIp(req.headers))) {
      return json({ ok: false, error: "RATE_LIMITED" }, 429);
    }
  } catch (e) {
    // The rate limiter needs the database too; carry on so the keep-alive and cleanup still run.
    console.error("[cron daily] rate limit check failed:", e);
  }
  const result = await runDailyCleanup();
  return json(result, result.ok ? 200 : 500);
}
