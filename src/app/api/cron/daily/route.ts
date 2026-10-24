import { connection } from "next/server";
import { db, dbConfigured } from "@/lib/db";
import { json } from "@/lib/http";
import { deleteExpiredMessages } from "@/lib/messages";
import { clientIp, rateLimit } from "@/lib/ratelimit";

// Daily Vercel cron (vercel.json). Keeps the free Supabase project active and deletes expired
// data: rate-limit windows, idempotency keys, and QR messages 30 days after the PASS-IT-ON
// reveal (a promise in our terms, so it must not depend on any optional secret). It only ever
// removes already-expired rows, so it is safe to call; a rate limit stops hammering.
export async function GET(req: Request) {
  await connection();
  if (!dbConfigured()) return json({ ok: false, error: "DB_NOT_CONFIGURED" }, 503);
  try {
    if (await rateLimit({ name: "cron", max: 5, windowSec: 600 }, clientIp(req.headers))) {
      return json({ ok: false, error: "RATE_LIMITED" }, 429);
    }
    await db().ping();
    const cleaned = { ...(await db().cleanup()), messages: await deleteExpiredMessages() };
    return json({ ok: true, cleaned });
  } catch (e) {
    console.error("[cron daily]", e);
    return json({ ok: false, error: "DB_ERROR" }, 500);
  }
}
