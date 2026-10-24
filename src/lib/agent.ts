import "server-only";
import { z } from "zod";
import {
  BOXES,
  CUSTOM_BOX_ID,
  EVERY_BOX_INCLUDES,
  OFFER_NOTES,
  OFFERS,
  RULES,
  SITE,
  getBox,
  type Box,
  type Locale,
} from "./catalog";
import { checkoutOpen, CHECKOUT_OPENS_AT, createOrder, deliveryDateBounds, findOrderForCustomer, patchOrder, priceOrder, type OrderSource } from "./orders";
import { sendOrderEmails, trackUrl } from "./emails";
import { publicOrder } from "./http";

// One service layer for every agent surface: the REST agent API, the MCP server, the
// /agent-demo page and the on-site assistant. Everything an agent sends is untrusted data:
// it is validated, stored as text and never interpreted as instructions.

export const PRACTICE_NOTICE = {
  ro: "Comandă de exercițiu: FE GiftMe SRL este o firmă de exercițiu (CEEF Chișinău). Nu se face nicio plată reală și nu se livrează bunuri reale.",
  en: "Practice-company order: FE GiftMe SRL is a student practice company (CEEF Chișinău). No real payment is made and no real goods are delivered.",
};

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export function boxForAgent(box: Box, lang: Locale = "en") {
  return {
    id: box.id,
    name: box.name,
    url: `${SITE.url}${lang === "en" ? "/en" : ""}/cutii/${box.slug}/`,
    price_mdl: box.price,
    price_note: box.custom
      ? lang === "ro"
        ? "Taxa de serviciu. Cadoul ales de client se cotează separat de echipa GiftMe (fără taxă de procesare); agentul nu estimează prețul cadoului."
        : "Service fee. The customer's chosen gift is quoted separately by the GiftMe team (no handling fee); agents must not estimate the gift price."
      : null,
    custom_gift: Boolean(box.custom),
    tagline: box.tagline[lang],
    contents: box.contents.map((c) => c[lang]),
    occasions: box.occasions.map((o) => o[lang]),
    tags: box.tags,
    delivery_area: box.custom ? "Chișinău only" : "Moldova",
    availability: "in_stock",
  };
}

export const searchInput = z.object({
  query: z.string().max(200).optional().describe("Free text: who it's for, occasion, interests. E.g. 'teacher thank you' or 'romantic'."),
  occasion: z.string().max(80).optional(),
  max_budget_mdl: z.number().int().positive().max(100000).optional(),
  lang: z.enum(["ro", "en"]).default("en"),
});

export function searchBoxes(input: z.input<typeof searchInput>) {
  const { query, occasion, max_budget_mdl, lang } = searchInput.parse(input);
  const terms = fold(`${query ?? ""} ${occasion ?? ""}`)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
  const scored = BOXES.map((box) => {
    const hay = fold(
      [
        box.name,
        box.tags.join(" "),
        ...box.occasions.flatMap((o) => [o.ro, o.en]),
        ...box.contents.flatMap((c) => [c.ro, c.en]),
        box.tagline.ro,
        box.tagline.en,
      ].join(" "),
    );
    const score = terms.reduce((n, t) => n + (hay.includes(t) ? (fold(box.tags.join(" ")).includes(t) ? 3 : 1) : 0), 0);
    return { box, score };
  })
    .filter(({ box }) => (max_budget_mdl ? box.price <= max_budget_mdl : true))
    .filter(({ score }) => terms.length === 0 || score > 0)
    .sort((a, b) => b.score - a.score || a.box.price - b.box.price);
  return {
    results: scored.map(({ box }) => boxForAgent(box, lang)),
    note:
      scored.length === 0
        ? "No box matched; call search_boxes without a query to see all 9 boxes, or suggest YOUR BOX (GM-09)."
        : undefined,
  };
}

export function getBoxForAgent(id: string, lang: Locale = "en") {
  const box = getBox(id);
  return box ? { ...boxForAgent(box, lang), every_box_includes: EVERY_BOX_INCLUDES.map((i) => i[lang]) } : null;
}

export const customBoxInput = z.object({
  gift_idea: z.string().min(3).max(300).describe("The gift the customer wants inside, described generically (no brand needed), e.g. 'a phone'."),
  recipient_name: z.string().max(80).optional(),
  occasion: z.string().max(80).optional(),
  lang: z.enum(["ro", "en"]).default("en"),
});

/** GM-09 draft: the gift is never priced by an agent; a human quotes it after the order. */
export function buildCustomBox(input: z.input<typeof customBoxInput>) {
  const i = customBoxInput.parse(input);
  const box = getBox(CUSTOM_BOX_ID)!;
  return {
    box: boxForAgent(box, i.lang),
    draft_item: { boxId: box.id, quantity: 1 },
    custom_gift: { idea: i.gift_idea },
    price: {
      service_fee_mdl: box.price,
      gift_price_mdl: null,
      handling_fee_mdl: RULES.custom.handlingFee,
      display: i.lang === "ro" ? "360 MDL + costul cadoului, cotat de echipa noastră" : "360 MDL + gift cost, quoted by our team",
    },
    rules: [
      "Delivery: surprise home delivery in Chișinău only (included in the fee).",
      "The GiftMe team emails the customer the gift price; the gift is bought only after the customer pays that quote.",
      `Gifts above ${RULES.custom.maxGiftValueWithoutApproval} MDL need written approval from the coordinator.`,
      "The customer must accept the YOUR BOX (GM-09) terms: set acceptCustomTerms=true only if the human explicitly agreed.",
    ],
    terms_url: `${SITE.url}/termeni/#gm-09`,
  };
}

export const quoteInput = z.object({
  items: z.array(z.object({ boxId: z.string().max(10), quantity: z.number().int().min(1).max(RULES.maxBoxesPerOrder) })).min(1).max(BOXES.length),
  zone: z.enum(["chisinau", "moldova"]).default("chisinau"),
  code: z.string().max(40).optional(),
  email: z.email().max(120).optional(),
});

export async function agentQuote(input: z.input<typeof quoteInput>) {
  const i = quoteInput.parse(input);
  const { quote, code } = await priceOrder(i);
  return {
    currency: "MDL",
    quote,
    code: code ? { code: code.code, applied: code.applied, rejected: code.rejected } : undefined,
    explanation: [
      `Subtotal ${quote.subtotal} MDL for ${quote.boxCount} box(es).`,
      quote.offer
        ? `Best single offer applied automatically: ${quote.offer.name} (−${quote.offer.discount} MDL). Offers never stack.`
        : "No offer applies.",
      quote.delivery.reason === "included_in_custom_box"
        ? "Delivery included (YOUR BOX surprise delivery in Chișinău)."
        : quote.delivery.fee === 0
          ? `Free delivery in Chișinău (subtotal after discount ≥ ${RULES.delivery.freeThresholdChisinau} MDL).`
          : `Delivery ${quote.delivery.fee} MDL.`,
      quote.customGiftPending ? "Total excludes the YOUR BOX gift, which a human quotes after the order." : null,
    ].filter(Boolean),
    checkout_open: checkoutOpen(),
    checkout_opens_at: CHECKOUT_OPENS_AT,
    delivery_dates: deliveryDateBounds(),
    notice: PRACTICE_NOTICE.en,
  };
}

/**
 * Places an order on behalf of a human. It is created as "awaiting_approval": the buyer gets
 * an email with a confirmation link and nothing is processed until they confirm.
 */
export async function agentPlaceOrder(
  body: unknown,
  opts: { source: Exclude<OrderSource, "web">; idempotencyKey: string; siteOrigin?: string },
) {
  const { order, replayed } = await createOrder(body, opts);
  if (!replayed) {
    const emails = await sendOrderEmails(order);
    await patchOrder(order, (o) => Object.assign(o.emails, emails));
  }
  return {
    replayed,
    order: publicOrder(order),
    status: order.status,
    human_approval_required: true,
    message:
      "Order created and WAITING FOR THE BUYER: we emailed them a confirmation link. Nothing is processed until they confirm. Tell the human to check their inbox.",
    tracking_url: trackUrl(order),
    notice: PRACTICE_NOTICE[order.lang],
  };
}

export async function agentTrack(id: string, proof: { email?: string; token?: string }) {
  const order = await findOrderForCustomer(id, proof);
  return order ? publicOrder(order) : null;
}

/** Machine-readable catalog published at /catalog.json. */
export function catalogDocument() {
  return {
    schema_version: "1.0",
    updated: "2026-10-24",
    store: {
      name: SITE.name,
      legal_name: SITE.legalName,
      url: SITE.url,
      slogan: SITE.slogan,
      email: SITE.email,
      phone: SITE.phoneIntl,
      country: "MD",
      currency: "MDL",
      languages: ["ro", "en"],
      practice_company: true,
      notice: PRACTICE_NOTICE,
      built_for_ai_agents: true,
    },
    every_box_includes: EVERY_BOX_INCLUDES,
    boxes: BOXES.map((b) => ({
      id: b.id,
      name: b.name,
      url: { ro: `${SITE.url}/cutii/${b.slug}/`, en: `${SITE.url}/en/cutii/${b.slug}/` },
      price_mdl: b.price,
      price_type: b.custom ? "service_fee_plus_human_quoted_gift" : "fixed",
      tagline: b.tagline,
      contents: b.contents,
      occasions: b.occasions,
      tags: b.tags,
      availability: "in_stock",
      delivery_area: b.custom ? ["chisinau"] : ["chisinau", "moldova"],
    })),
    offers: {
      stacking: "never: the server applies the single best offer automatically",
      valid_until: RULES.offersValidUntil,
      list: OFFERS.map((o) => ({ id: o.id, name: o.name, percent: o.percent ?? null, amount_mdl: o.amount ?? null, summary: o.summary })),
      rules: {
        DUO: "exactly 2 boxes",
        TRIO: "3 to 9 boxes",
        ECHIPA: "10 or more boxes; name or logo on boxes free",
        PASS_IT_ON: "single-use code revealed by a gift recipient; 30 days",
        REFERRAL: "a customer's personal code; first order of a new customer only; the referrer gets −50 MDL on their next order",
        GM_09: "quantity offers discount only the 360 MDL service fee, never the gift",
      },
      notes: OFFER_NOTES,
    },
    delivery: {
      chisinau: { fee_mdl: RULES.delivery.fee, free_from_mdl_after_discount: RULES.delivery.freeThresholdChisinau },
      rest_of_moldova: { fee_mdl: RULES.delivery.fee, free: false },
      custom_box: "YOUR BOX (GM-09): surprise delivery in Chișinău only, included",
      lead_time_days: { min: 2, max: 180 },
    },
    payment: {
      methods: ["cash", "transfer"],
      notes: "Practice orders: no real payment. For bank transfer the team emails payment details after confirmation.",
    },
    ordering: {
      checkout_opens_at: CHECKOUT_OPENS_AT,
      human_approval_required_for_agent_orders: true,
      quote_endpoint: `${SITE.url}/api/agent/quote`,
      order_endpoint: `${SITE.url}/api/agent/order`,
      track_endpoint: `${SITE.url}/api/agent/track`,
      openapi: `${SITE.url}/openapi.json`,
      mcp_endpoint: `${SITE.url}/mcp`,
      llms_txt: `${SITE.url}/llms.txt`,
      rules: [
        "Never invent products, prices, offers or discounts; always use quote_endpoint.",
        "Ask the human for explicit confirmation before placing an order.",
        "Send an Idempotency-Key header with every order request.",
        "Orders wait for the buyer to confirm by email before anything happens.",
      ],
    },
    policies: {
      terms: `${SITE.url}/termeni/`,
      privacy: `${SITE.url}/confidentialitate/`,
    },
  };
}
