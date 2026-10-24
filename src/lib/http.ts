import "server-only";
import { QuoteError } from "./pricing";
import { OrderError, type Order } from "./orders";
import { StoreUnavailableError } from "./store";
import { STATUS_LABEL } from "./orders";

export const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

export const tooMany = (retryAfter: number) =>
  json({ error: "RATE_LIMITED", message: "Too many requests, try again later" }, 429, {
    "Retry-After": String(retryAfter),
  });

export async function readJson(req: Request, maxBytes = 20_000): Promise<unknown> {
  const text = await req.text();
  if (text.length > maxBytes) throw new OrderError("TOO_LARGE", "Request body too large");
  try {
    return JSON.parse(text);
  } catch {
    throw new OrderError("INVALID_JSON", "Body must be JSON");
  }
}

/** Maps known errors to clean JSON responses; anything else is a 500 without internals. */
export function errorResponse(e: unknown) {
  if (e instanceof QuoteError) return json({ error: e.code, message: e.message }, 400);
  if (e instanceof OrderError) return json({ error: e.code, message: e.message, details: e.details }, 400);
  if (e instanceof StoreUnavailableError)
    return json({ error: "STORE_UNAVAILABLE", message: "Ordering is temporarily unavailable" }, 503);
  console.error(e);
  return json({ error: "SERVER_ERROR", message: "Something went wrong" }, 500);
}

/** What a customer (or their agent) may see about an order: no token, phone or full address. */
export function publicOrder(o: Order) {
  return {
    id: o.id,
    simulated: o.simulated,
    status: o.status,
    statusLabel: STATUS_LABEL[o.status][o.lang],
    createdAt: o.createdAt,
    history: o.history.map((h) => ({ status: h.status, at: h.at })),
    recipient: o.recipient.name,
    delivery: { date: o.delivery.date, zone: o.delivery.zone, city: o.delivery.city },
    payment: o.payment,
    quote: o.quote,
    code: o.code && { code: o.code.code, applied: o.code.applied },
    customGift: o.customGift && { idea: o.customGift.idea, status: o.customGift.status, amount: o.customGift.amount },
    referralCode: o.referralCode,
    lang: o.lang,
  };
}
