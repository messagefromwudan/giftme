import { connection } from "next/server";
import { db, dbConfigured } from "@/lib/db";
import { json } from "@/lib/http";

// Daily Vercel cron (vercel.json). Keeps the free Supabase project active and prunes
// expired rows. The ping is harmless and always runs; cleanup needs Vercel's CRON_SECRET.
export async function GET(req: Request) {
  await connection();
  if (!dbConfigured()) return json({ ok: false, error: "DB_NOT_CONFIGURED" }, 503);
  try {
    await db().ping();
    const secret = process.env.CRON_SECRET;
    const authorized = Boolean(secret) && req.headers.get("authorization") === `Bearer ${secret}`;
    const cleaned = authorized ? await db().cleanup() : null;
    return json({ ok: true, pinged: true, cleaned });
  } catch (e) {
    console.error("[cron daily]", e);
    return json({ ok: false, error: "DB_ERROR" }, 500);
  }
}
