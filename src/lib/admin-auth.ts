import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// One shared admin password (ADMIN_PASSWORD in Vercel). Sessions are HMAC-signed cookies;
// changing the password logs everyone out.

export const ADMIN_COOKIE = "gm_admin";
const SESSION_HOURS = 12;

export const adminConfigured = () => Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.length >= 10);

const key = () =>
  createHash("sha256")
    .update(`giftme-admin:${process.env.ADMIN_PASSWORD}:${process.env.ADMIN_SESSION_SECRET ?? ""}`)
    .digest();

const sign = (payload: string) => createHmac("sha256", key()).update(payload).digest("base64url");

const sameBytes = (a: Buffer, b: Buffer) => a.length === b.length && timingSafeEqual(a, b);

export function passwordMatches(input: string): boolean {
  if (!adminConfigured()) return false;
  const h = (s: string) => createHash("sha256").update(s).digest();
  return sameBytes(h(input), h(process.env.ADMIN_PASSWORD!));
}

export function newSessionValue(now = Date.now()) {
  const exp = String(now + SESSION_HOURS * 3_600_000);
  return { value: `${exp}.${sign(exp)}`, maxAge: SESSION_HOURS * 3600 };
}

export function sessionValid(value: string | undefined, now = Date.now()): boolean {
  if (!value || !adminConfigured()) return false;
  const [exp, sig] = value.split(".");
  if (!exp || !sig || Number(exp) < now) return false;
  return sameBytes(Buffer.from(sig), Buffer.from(sign(exp)));
}

export async function isAdmin(): Promise<boolean> {
  return sessionValid((await cookies()).get(ADMIN_COOKIE)?.value);
}

/** For server actions and route handlers: throws unless logged in. */
export async function requireAdmin() {
  if (!(await isAdmin())) throw new Error("UNAUTHORIZED");
}
