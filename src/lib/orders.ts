import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { BOXES, CUSTOM_BOX_ID, RULES, type Locale } from "./catalog";
import { chisinauDate, quote, type Quote } from "./pricing";
import {
  checkCode,
  consumeCode,
  ensureReferralCode,
  normalizeCode,
  normalizeEmail,
  referralCredits,
  spendReferralCredit,
  type CodeRecord,
} from "./codes";
import { db, StoreUnavailableError } from "./db";
import { trustedOrigin } from "./origin";
import type { OrderStatus } from "./status";

export { STATUS_LABEL, type OrderStatus } from "./status";

// ---------- Checkout window ----------

/**
 * The one switch for online ordering (website, agent API, MCP, /agent-demo): open only when
 * CHECKOUT_OPEN is exactly "true". Unset or any other value keeps checkout closed. Changing it
 * needs a redeploy (Vercel reads environment variables at deploy time).
 */
export function checkoutOpen(): boolean {
  return process.env.CHECKOUT_OPEN?.trim() === "true";
}

export const CHECKOUT_CLOSED_MESSAGE = "Online ordering is closed at the moment. Quotes still work; please try again later.";

// ---------- Input validation (all text is untrusted) ----------

// Strip control characters (keep newlines in multi-line fields) and trim.
const clean = (multiline: boolean) => (v: string) =>
  v
    .replace(multiline ? /[\u0000-\u0009\u000B-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, "")
    .trim();
const text = (max: number, min = 0, multiline = false) =>
  z.string().transform(clean(multiline)).pipe(z.string().min(min).max(max));
const optionalText = (max: number, multiline = false) => text(max, 0, multiline).optional().default("");

export const MIN_LEAD_DAYS = 2;
export const MAX_LEAD_DAYS = 180;

function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function deliveryDateBounds(now = new Date()) {
  const today = chisinauDate(now);
  return { min: addDays(today, MIN_LEAD_DAYS), max: addDays(today, MAX_LEAD_DAYS) };
}

export const orderInputSchema = z
  .object({
    lang: z.enum(["ro", "en"]).default("ro"),
    items: z
      .array(z.object({ boxId: z.string().max(10), quantity: z.number().int().min(1).max(RULES.maxBoxesPerOrder) }))
      .min(1)
      .max(BOXES.length),
    buyer: z.object({
      name: text(80, 2),
      email: z.email().max(120).transform(normalizeEmail),
      phone: text(20, 6).refine((p) => /^\+?[\d\s()-]{6,20}$/.test(p), "invalid_phone"),
    }),
    recipient: z.object({ name: text(80, 1) }),
    personalization: z.object({
      occasion: optionalText(80),
      engraving: optionalText(60),
      labels: optionalText(600, true),
      /** Team/class orders: names or logo notes for individual boxes. */
      perBoxNames: optionalText(2000, true),
    }),
    delivery: z.object({
      zone: z.enum(["chisinau", "moldova"]),
      city: optionalText(60),
      address: text(200, 5),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
    payment: z.enum(["cash", "transfer"]),
    customGift: z.object({ idea: text(300, 3, true) }).optional(),
    code: z.string().max(40).transform(normalizeCode).optional(),
    notes: optionalText(500, true),
    acceptTerms: z.literal(true),
    acceptCustomTerms: z.boolean().optional(),
  })
  .superRefine((o, ctx) => {
    const hasCustom = o.items.some((i) => i.boxId.toUpperCase() === CUSTOM_BOX_ID);
    if (hasCustom && !o.customGift) ctx.addIssue({ code: "custom", path: ["customGift", "idea"], message: "required" });
    if (hasCustom && o.acceptCustomTerms !== true)
      ctx.addIssue({ code: "custom", path: ["acceptCustomTerms"], message: "required" });
    if (o.delivery.zone === "moldova" && o.delivery.city.length < 2)
      ctx.addIssue({ code: "custom", path: ["delivery", "city"], message: "required" });
  });

export type OrderInput = z.input<typeof orderInputSchema>;
export type ValidOrderInput = z.output<typeof orderInputSchema>;

// ---------- Order model ----------

export type OrderSource = "web" | "agent_api" | "mcp" | "onsite_agent";
export type GiftQuoteStatus = "awaiting_quote" | "quoted" | "paid" | "bought";

export type Order = {
  id: string;
  /** Secret for tracking links (read-only). Never shown in lists or exports. */
  token: string;
  /**
   * Agent orders only: secret for the "confirm this order" link, sent ONLY to the buyer's inbox.
   * Separate from `token` because agents receive the tracking token and must not self-approve.
   */
  approvalToken?: string;
  createdAt: string;
  updatedAt: string;
  lang: Locale;
  source: OrderSource;
  /** The (trusted) site the order was placed on; links in emails point back to it. */
  siteOrigin?: string;
  simulated: true;
  status: OrderStatus;
  history: { status: OrderStatus; at: string; by: string; note?: string }[];
  buyer: ValidOrderInput["buyer"];
  recipient: ValidOrderInput["recipient"];
  personalization: ValidOrderInput["personalization"];
  delivery: ValidOrderInput["delivery"];
  payment: ValidOrderInput["payment"];
  notes: string;
  quote: Quote;
  /** The code the customer entered and whether it won (offers never stack). */
  code?: { code: string; type?: CodeRecord["type"]; applied: boolean; rejected?: string };
  customGift?: {
    idea: string;
    status: GiftQuoteStatus;
    /** Human quote in MDL, set in the admin dashboard. */
    amount?: number;
    needsCoordinatorApproval?: boolean;
    coordinatorApproved?: boolean;
  };
  /** The buyer's own REFER A FRIEND code, issued when the order is confirmed. */
  referralCode?: string;
  emails: Partial<Record<"admin" | "customer" | "approval" | "status", string>>;
};

export class OrderError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "OrderError";
  }
}

const now = () => new Date().toISOString();

export async function getOrder(id: string) {
  const norm = id.trim().toUpperCase();
  if (!/^GM-\d{1,9}$/.test(norm)) return null;
  return db().getOrder(norm);
}

async function saveOrder(order: Order) {
  order.updatedAt = now();
  await db().saveOrder(order);
}

export async function listOrders(limit = 500): Promise<Order[]> {
  return db().listOrders(limit);
}

/** Tracking: either the secret token from the link, or order number + buyer email. */
export async function findOrderForCustomer(id: string, proof: { token?: string; email?: string }) {
  const order = await getOrder(id);
  if (!order) return null;
  if (proof.token && safeEqual(proof.token, order.token)) return order;
  if (proof.email && normalizeEmail(proof.email) === order.buyer.email) return order;
  return null;
}

/** Approval: only the secret from the buyer's email works, never the tracking token. */
export async function findOrderForApproval(id: string, approvalToken: string) {
  const order = await getOrder(id);
  if (!order?.approvalToken || !safeEqual(approvalToken, order.approvalToken)) return null;
  return order;
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// ---------- Quotes with codes and credits resolved ----------

export type PricedOrder = {
  quote: Quote;
  code?: Order["code"];
  codeRecord?: CodeRecord;
  usesCredit: boolean;
};

/** Validates the code and credit against the database, then prices on the server. */
export async function priceOrder(
  input: { items: { boxId: string; quantity: number }[]; zone: "chisinau" | "moldova"; code?: string; email?: string },
  excludeOrderId?: string,
): Promise<PricedOrder> {
  let codeRecord: CodeRecord | undefined;
  let code: Order["code"];
  let credit = false;
  try {
    if (input.code) {
      const check = await checkCode(input.code, input.email ?? "", new Date(), excludeOrderId);
      if (check.ok) codeRecord = check.record;
      else code = { code: input.code, applied: false, rejected: check.reason };
    }
    credit = input.email ? (await referralCredits(input.email)) > 0 : false;
  } catch (e) {
    // Without storage the cart can still be priced; codes and credits just can't be checked.
    if (!(e instanceof StoreUnavailableError)) throw e;
    if (input.code) code = { code: input.code, applied: false, rejected: "unavailable" };
  }
  const q = quote({
    items: input.items,
    zone: input.zone,
    code: codeRecord ? { type: codeRecord.type, code: codeRecord.code } : undefined,
    referralCredit: credit,
  });
  if (codeRecord) code = { code: codeRecord.code, type: codeRecord.type, applied: q.offerSource === "code" };
  return { quote: q, code, codeRecord, usesCredit: q.offerSource === "credit" };
}

// ---------- Create / confirm ----------

export async function createOrder(
  raw: unknown,
  opts: { source: OrderSource; idempotencyKey?: string; now?: Date; siteOrigin?: string },
): Promise<{ order: Order; replayed: boolean }> {
  const parsed = orderInputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new OrderError("INVALID_INPUT", "Some fields are missing or invalid", z.flattenError(parsed.error));
  }
  const input = parsed.data;

  const bounds = deliveryDateBounds(opts.now);
  if (input.delivery.date < bounds.min || input.delivery.date > bounds.max) {
    throw new OrderError("INVALID_DATE", `Delivery date must be between ${bounds.min} and ${bounds.max}`, bounds);
  }

  // Idempotency: the same key always returns the same order.
  const idemKey = opts.idempotencyKey ? opts.idempotencyKey.slice(0, 100) : undefined;
  if (idemKey) {
    const existingId = await db().idempotentOrderId(idemKey);
    if (existingId) {
      const existing = await getOrder(existingId);
      if (existing) return { order: existing, replayed: true };
    }
  }

  const priced = await priceOrder({
    items: input.items,
    zone: input.delivery.zone,
    code: input.code,
    email: input.buyer.email,
  });

  const id = await db().nextOrderId();
  if (idemKey) {
    const owner = await db().claimIdempotencyKey(idemKey, id);
    if (owner !== id) {
      // A concurrent request with the same key won the race; return its order.
      const winner = await getOrder(owner);
      if (winner) return { order: winner, replayed: true };
      throw new OrderError("IN_PROGRESS", "The same order is already being placed; retry in a moment");
    }
  }

  const needsApproval = opts.source !== "web";
  const status: OrderStatus = needsApproval ? "awaiting_approval" : "received";
  const createdAt = now();
  const order: Order = {
    id,
    token: randomBytes(18).toString("base64url"),
    ...(needsApproval ? { approvalToken: randomBytes(24).toString("base64url") } : {}),
    createdAt,
    updatedAt: createdAt,
    lang: input.lang,
    source: opts.source,
    ...(trustedOrigin(opts.siteOrigin) ? { siteOrigin: trustedOrigin(opts.siteOrigin) } : {}),
    simulated: true,
    status,
    history: [{ status, at: createdAt, by: opts.source }],
    buyer: input.buyer,
    recipient: input.recipient,
    personalization: input.personalization,
    delivery: input.delivery,
    payment: input.payment,
    notes: input.notes,
    quote: priced.quote,
    code: priced.code,
    customGift: input.customGift ? { idea: input.customGift.idea, status: "awaiting_quote" } : undefined,
    emails: {},
  };

  await db().insertOrder(order);

  // Orders placed by AI agents wait for the human to approve them by email.
  if (!needsApproval) await confirmOrder(order, "web");
  return { order, replayed: false };
}

/**
 * Moves an order to "received": consumes the winning code or credit (re-validated now),
 * re-prices if the code is no longer valid, and issues the buyer's own referral code.
 */
export async function confirmOrder(order: Order, by: string): Promise<Order> {
  if (order.status !== "awaiting_approval" && order.history.length > 1) return order;

  if (order.code?.applied || order.quote.offerSource === "credit") {
    const priced = await priceOrder(
      {
        items: order.quote.lines.map((l) => ({ boxId: l.boxId, quantity: l.quantity })),
        zone: order.delivery.zone,
        code: order.code?.code,
        email: order.buyer.email,
      },
      order.id,
    );
    let ok = true;
    if (priced.quote.offerSource === "code" && priced.codeRecord) ok = await consumeCode(priced.codeRecord, order.id);
    if (priced.quote.offerSource === "credit") ok = await spendReferralCredit(order.buyer.email);
    order.quote = ok
      ? priced.quote
      : (await priceOrder({
          items: order.quote.lines.map((l) => ({ boxId: l.boxId, quantity: l.quantity })),
          zone: order.delivery.zone,
        })).quote;
    order.code = priced.code && { ...priced.code, applied: ok && priced.quote.offerSource === "code" };
  }

  order.referralCode = await ensureReferralCode(order.buyer.email);
  if (order.status === "awaiting_approval") {
    order.status = "received";
    order.history.push({ status: "received", at: now(), by });
  }
  await saveOrder(order);
  return order;
}

export async function updateStatus(order: Order, status: OrderStatus, by: string, note?: string) {
  if (order.status === status) return order;
  order.status = status;
  order.history.push({ status, at: now(), by, note });
  await saveOrder(order);
  return order;
}

export async function setGiftQuote(order: Order, amount: number, by: string) {
  if (!order.customGift) throw new OrderError("NOT_CUSTOM", "Order has no GM-09 gift");
  order.customGift.amount = Math.round(amount);
  order.customGift.status = "quoted";
  order.customGift.needsCoordinatorApproval = amount > RULES.custom.maxGiftValueWithoutApproval;
  order.history.push({ status: order.status, at: now(), by, note: `GM-09 gift quoted: ${Math.round(amount)} MDL` });
  await saveOrder(order);
  return order;
}

export async function patchOrder(order: Order, patch: (o: Order) => void) {
  patch(order);
  await saveOrder(order);
  return order;
}
