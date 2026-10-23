// Server-side pricing. The only place where offers and delivery are computed.
// Clients (the site, external agents, MCP, the on-site agent) send box IDs and quantities;
// they never send prices or discounts.

import { BOXES, CUSTOM_BOX_ID, OFFERS, RULES, type BoxId, type OfferId } from "./catalog";

export type Zone = "chisinau" | "moldova";

export type QuoteInput = {
  items: { boxId: string; quantity: number }[];
  zone: Zone;
  /** A discount code that the caller has ALREADY validated against the database. */
  code?: { type: "PASS_IT_ON" | "REFERRAL"; code: string };
  /** Defaults to now; injectable for tests. */
  now?: Date;
};

export type QuoteLine = {
  boxId: BoxId;
  name: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  /** GM-09: unitPrice is the service fee; the gift is quoted separately by the team. */
  giftQuotedSeparately?: true;
};

export type Quote = {
  currency: "MDL";
  lines: QuoteLine[];
  boxCount: number;
  subtotal: number;
  offer: { id: OfferId; name: string; discount: number } | null;
  /** True when the caller's code gave the best discount and will be consumed on order. */
  codeApplied: boolean;
  discountedSubtotal: number;
  delivery: { fee: number; reason: DeliveryReason };
  total: number;
  /** True when the order contains GM-09: total excludes the gift, which a human quotes later. */
  customGiftPending: boolean;
};

export type DeliveryReason =
  | "free_over_threshold_chisinau"
  | "included_in_custom_box"
  | "standard_fee";

export type QuoteErrorCode =
  | "EMPTY_ORDER"
  | "UNKNOWN_BOX"
  | "INVALID_QUANTITY"
  | "TOO_MANY_BOXES"
  | "ZONE_NOT_SERVED"
  | "CUSTOM_BOX_CHISINAU_ONLY";

export class QuoteError extends Error {
  constructor(
    public code: QuoteErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "QuoteError";
  }
}

/** YYYY-MM-DD in Chișinău time. */
export function chisinauDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: RULES.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function offersActive(now: Date): boolean {
  return chisinauDate(now) <= RULES.offersValidUntil;
}

const offerById = (id: OfferId) => OFFERS.find((o) => o.id === id)!;

function quantityOffer(boxCount: number): OfferId | null {
  if (boxCount >= 10) return "ECHIPA";
  if (boxCount >= 3) return "TRIO";
  if (boxCount === 2) return "DUO";
  return null;
}

function discountFor(id: OfferId, subtotal: number): number {
  const o = offerById(id);
  const raw = o.percent ? Math.round((subtotal * o.percent) / 100) : (o.amount ?? 0);
  return Math.min(raw, subtotal);
}

export function quote(input: QuoteInput): Quote {
  const now = input.now ?? new Date();

  // Merge duplicate lines and validate.
  const merged = new Map<BoxId, number>();
  for (const item of input.items) {
    const box = BOXES.find((b) => b.id === String(item.boxId).trim().toUpperCase());
    if (!box) throw new QuoteError("UNKNOWN_BOX", `Unknown box id: ${String(item.boxId).slice(0, 20)}`);
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new QuoteError("INVALID_QUANTITY", `Quantity for ${box.id} must be a whole number ≥ 1`);
    }
    merged.set(box.id, (merged.get(box.id) ?? 0) + item.quantity);
  }
  if (merged.size === 0) throw new QuoteError("EMPTY_ORDER", "The order has no boxes");

  const lines: QuoteLine[] = BOXES.filter((b) => merged.has(b.id)).map((b) => {
    const quantity = merged.get(b.id)!;
    return {
      boxId: b.id,
      name: b.name,
      unitPrice: b.price,
      quantity,
      lineTotal: b.price * quantity,
      ...(b.custom ? { giftQuotedSeparately: true as const } : {}),
    };
  });

  const boxCount = lines.reduce((n, l) => n + l.quantity, 0);
  if (boxCount > RULES.maxBoxesPerOrder) {
    throw new QuoteError(
      "TOO_MANY_BOXES",
      `Orders above ${RULES.maxBoxesPerOrder} boxes are arranged by email`,
    );
  }

  const hasCustom = merged.has(CUSTOM_BOX_ID);
  const onlyCustom = hasCustom && merged.size === 1;
  if (input.zone === "moldova") {
    if (hasCustom && !RULES.custom.deliversOutsideChisinau) {
      throw new QuoteError(
        "CUSTOM_BOX_CHISINAU_ONLY",
        "YOUR BOX (GM-09) surprise delivery is available only in Chișinău",
      );
    }
    if (!RULES.delivery.deliversOutsideChisinau) {
      throw new QuoteError("ZONE_NOT_SERVED", "We currently deliver only in Chișinău");
    }
  }

  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);

  // Offers never stack: compute every applicable one and keep the best.
  // On a tie, prefer the quantity offer so the customer's code is not used up.
  let offer: Quote["offer"] = null;
  let codeApplied = false;
  if (offersActive(now)) {
    const candidates: { id: OfferId; fromCode: boolean }[] = [];
    const q = quantityOffer(boxCount);
    if (q) candidates.push({ id: q, fromCode: false });
    if (input.code) candidates.push({ id: input.code.type, fromCode: true });
    for (const c of candidates) {
      const discount = discountFor(c.id, subtotal);
      if (discount > 0 && (!offer || discount > offer.discount)) {
        offer = { id: c.id, name: offerById(c.id).name, discount };
        codeApplied = c.fromCode;
      }
    }
  }

  const discountedSubtotal = subtotal - (offer?.discount ?? 0);

  let delivery: Quote["delivery"];
  if (input.zone === "chisinau" && onlyCustom) {
    delivery = { fee: 0, reason: "included_in_custom_box" };
  } else if (
    input.zone === "chisinau" &&
    discountedSubtotal >= RULES.delivery.freeThresholdChisinau
  ) {
    delivery = { fee: 0, reason: "free_over_threshold_chisinau" };
  } else {
    delivery = { fee: RULES.delivery.fee, reason: "standard_fee" };
  }

  return {
    currency: "MDL",
    lines,
    boxCount,
    subtotal,
    offer,
    codeApplied,
    discountedSubtotal,
    delivery,
    total: discountedSubtotal + delivery.fee,
    customGiftPending: hasCustom,
  };
}
