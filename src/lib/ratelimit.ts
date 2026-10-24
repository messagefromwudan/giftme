import "server-only";
import { kv, StoreUnavailableError } from "./store";

export type Limit = { name: string; max: number; windowSec: number };

export const LIMITS = {
  quote: { name: "quote", max: 60, windowSec: 60 },
  order: { name: "order", max: 5, windowSec: 600 },
  track: { name: "track", max: 20, windowSec: 600 },
  adminLogin: { name: "admin-login", max: 8, windowSec: 900 },
} satisfies Record<string, Limit>;

/** Fixed-window counter. Returns seconds to wait when the limit is exceeded, else 0. */
export async function rateLimit(limit: Limit, id: string): Promise<number> {
  const window = Math.floor(Date.now() / 1000 / limit.windowSec);
  const key = `rl:${limit.name}:${id}:${window}`;
  let n: number;
  try {
    n = await kv().incr(key);
  } catch (e) {
    // No storage: fail open (anything that writes data fails on its own without storage).
    if (e instanceof StoreUnavailableError) return 0;
    throw e;
  }
  if (n === 1) await kv().expire(key, limit.windowSec);
  if (n > limit.max) return limit.windowSec - (Math.floor(Date.now() / 1000) % limit.windowSec);
  return 0;
}

export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0].trim() || headers.get("x-real-ip") || "unknown";
}
