import "server-only";
import { randomInt } from "node:crypto";
import { kv } from "./store";

// Discount codes. REFERRAL: one personal code per customer, usable by any NEW customer once
// (on their first order, never by the owner). PASS_IT_ON: single use, 30 days from reveal.

export type CodeType = "REFERRAL" | "PASS_IT_ON";

export type CodeRecord = {
  code: string;
  type: CodeType;
  createdAt: string;
  /** REFERRAL: the customer who shares it. */
  ownerEmail?: string;
  /** PASS_IT_ON: ISO date after which the code is invalid. */
  expiresAt?: string;
  /** PASS_IT_ON: the message/order it was revealed from. */
  sourceOrderId?: string;
};

export type CodeCheck =
  | { ok: true; record: CodeRecord }
  | { ok: false; reason: "not_found" | "expired" | "used" | "own_code" | "not_first_order" };

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const randomPart = (n: number) => Array.from({ length: n }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

export const normalizeCode = (c: string) => c.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 32);
export const normalizeEmail = (e: string) => e.trim().toLowerCase();

export async function getCode(code: string) {
  return kv().get<CodeRecord>(`code:${normalizeCode(code)}`);
}

async function createUnique(prefix: string, record: Omit<CodeRecord, "code">): Promise<CodeRecord> {
  for (let i = 0; i < 10; i++) {
    const code = `${prefix}-${randomPart(6)}`;
    const full = { ...record, code };
    if (await kv().set(`code:${code}`, full, { nx: true })) return full;
  }
  throw new Error("Could not allocate a unique code");
}

/** The customer's personal REFER A FRIEND code, created on their first confirmed order. */
export async function ensureReferralCode(email: string): Promise<string> {
  const owner = normalizeEmail(email);
  const existing = await kv().get<string>(`refcode:${owner}`);
  if (existing) return existing;
  const rec = await createUnique("PRIETEN", { type: "REFERRAL", ownerEmail: owner, createdAt: new Date().toISOString() });
  // Another request may have created one at the same time; keep whichever landed first.
  if (!(await kv().set(`refcode:${owner}`, rec.code, { nx: true }))) {
    await kv().del(`code:${rec.code}`);
    return (await kv().get<string>(`refcode:${owner}`))!;
  }
  return rec.code;
}

export async function createPassItOnCode(sourceOrderId: string, days = 30, now = new Date()): Promise<CodeRecord> {
  return createUnique("PASS", {
    type: "PASS_IT_ON",
    sourceOrderId,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + days * 86_400_000).toISOString(),
  });
}

export async function hasPreviousOrders(email: string, excludeOrderId?: string): Promise<boolean> {
  const ids = await kv().smembers(`orders:byEmail:${normalizeEmail(email)}`);
  return ids.some((id) => id !== excludeOrderId);
}

/** Validate a code for this buyer. Does not consume it. */
export async function checkCode(
  code: string,
  buyerEmail: string,
  now = new Date(),
  excludeOrderId?: string,
): Promise<CodeCheck> {
  const record = await getCode(code);
  if (!record) return { ok: false, reason: "not_found" };
  if (record.type === "PASS_IT_ON") {
    if (record.expiresAt && new Date(record.expiresAt) < now) return { ok: false, reason: "expired" };
    if (await kv().get(`codeuse:${record.code}`)) return { ok: false, reason: "used" };
  } else {
    if (record.ownerEmail === normalizeEmail(buyerEmail)) return { ok: false, reason: "own_code" };
    if (await hasPreviousOrders(buyerEmail, excludeOrderId)) return { ok: false, reason: "not_first_order" };
  }
  return { ok: true, record };
}

/** Consume a code for an order. PASS_IT_ON claims are atomic; returns false if already used. */
export async function consumeCode(record: CodeRecord, orderId: string): Promise<boolean> {
  if (record.type === "PASS_IT_ON") {
    return kv().set(`codeuse:${record.code}`, orderId, { nx: true });
  }
  // REFERRAL: the referrer earns −50 MDL for their next order.
  if (record.ownerEmail) await kv().incr(`credit:${record.ownerEmail}`);
  await kv().sadd(`codeuses:${record.code}`, orderId);
  return true;
}

export async function referralCredits(email: string): Promise<number> {
  return Number((await kv().get<number>(`credit:${normalizeEmail(email)}`)) ?? 0);
}

export async function spendReferralCredit(email: string): Promise<boolean> {
  const key = `credit:${normalizeEmail(email)}`;
  const n = Number((await kv().get<number>(key)) ?? 0);
  if (n <= 0) return false;
  await kv().set(key, n - 1);
  return true;
}
