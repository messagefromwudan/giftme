import { AsyncLocalStorage } from "node:async_hooks";
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import {
  agentPlaceOrder,
  agentQuote,
  agentTrack,
  buildCustomBox,
  customBoxInput,
  getBoxForAgent,
  PRACTICE_NOTICE,
  quoteInput,
  searchBoxes,
  searchInput,
} from "@/lib/agent";
import { checkoutOpen, CHECKOUT_OPENS_AT, OrderError, orderInputSchema } from "@/lib/orders";
import { normalizeEmail } from "@/lib/codes";
import { QuoteError } from "@/lib/pricing";
import { clientIp, LIMITS, rateLimit } from "@/lib/ratelimit";
import { CORS, preflight } from "@/lib/http";

// MCP server for Claude, ChatGPT and other agents (Streamable HTTP at /mcp).
// Tools only read the catalog, price on the server, or create orders that the human must
// confirm by email. Tool inputs are untrusted data.

/** The caller's IP for the current MCP request, for per-client rate limits inside tools. */
const requestIp = new AsyncLocalStorage<string>();

const result = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});

const failure = (e: unknown) => {
  const message =
    e instanceof OrderError || e instanceof QuoteError
      ? `${e.code}: ${e.message}${e instanceof OrderError && e.details ? ` ${JSON.stringify(e.details)}` : ""}`
      : "Something went wrong; try again later.";
  if (!(e instanceof OrderError || e instanceof QuoteError)) console.error("[mcp]", e);
  return { isError: true, content: [{ type: "text" as const, text: message }] };
};

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "search_boxes",
      {
        title: "Search gift boxes",
        description:
          "Search the 9 GiftMe! gift boxes by who it's for, occasion, interests and budget (MDL). Returns boxes with exact prices and contents. Call with no query to list all.",
        inputSchema: searchInput,
        annotations: { readOnlyHint: true },
      },
      async (args) => result(searchBoxes(args)),
    );

    server.registerTool(
      "get_box",
      {
        title: "Get one box",
        description: "Full details of a box by id (GM-01 … GM-09), including what every box includes.",
        inputSchema: z.object({ id: z.string().max(10), lang: z.enum(["ro", "en"]).default("en") }),
        annotations: { readOnlyHint: true },
      },
      async ({ id, lang }) => {
        const box = getBoxForAgent(id, lang);
        return box ? result(box) : { isError: true, content: [{ type: "text" as const, text: `Unknown box id: ${id}` }] };
      },
    );

    server.registerTool(
      "build_custom_box",
      {
        title: "Build a YOUR BOX (GM-09)",
        description:
          "Prepare a custom GM-09 box around a gift the customer names. Price is 360 MDL + the gift, which the GiftMe team quotes after the order. Never estimate the gift price yourself.",
        inputSchema: customBoxInput,
        annotations: { readOnlyHint: true },
      },
      async (args) => result(buildCustomBox(args)),
    );

    server.registerTool(
      "get_quote",
      {
        title: "Get a quote",
        description:
          "Exact server-side price for boxes: subtotal, the single best offer (offers never stack), delivery and total in MDL. Always use this instead of computing prices.",
        inputSchema: quoteInput,
        annotations: { readOnlyHint: true },
      },
      async (args) => {
        try {
          return result(await agentQuote(args));
        } catch (e) {
          return failure(e);
        }
      },
    );

    server.registerTool(
      "place_order",
      {
        title: "Place an order (buyer confirms by email)",
        description: [
          "Create an order for the human. ONLY call this after the human explicitly confirmed the boxes, price, recipient,",
          "delivery address and date, and agreed to the terms (https://www.giftme.site/termeni/).",
          "The order is created as awaiting_approval: we email the buyer a confirmation link and nothing is processed until they click it.",
          "Use a new idempotency_key per intended order and reuse it when retrying.",
          PRACTICE_NOTICE.en,
        ].join(" "),
        inputSchema: z.object({
          idempotency_key: z.string().min(8).max(100),
          order: orderInputSchema.describe("Same body as POST /api/agent/order (see /openapi.json)."),
        }),
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
      },
      async ({ idempotency_key, order }) => {
        try {
          if (!checkoutOpen()) throw new OrderError("CHECKOUT_CLOSED", `Online orders open at ${CHECKOUT_OPENS_AT}`);
          const ip = requestIp.getStore() ?? "unknown";
          if (await rateLimit(LIMITS.agentOrder, ip)) throw new OrderError("RATE_LIMITED", "Too many orders; try later");
          if (await rateLimit(LIMITS.approvalEmail, normalizeEmail(order.buyer.email)))
            throw new OrderError("RATE_LIMITED", "Too many confirmation emails for this buyer; try later");
          return result(await agentPlaceOrder(order, { source: "mcp", idempotencyKey: `mcp:${idempotency_key}` }));
        } catch (e) {
          return failure(e);
        }
      },
    );

    server.registerTool(
      "track_order",
      {
        title: "Track an order",
        description: "Status of an order by id (e.g. GM-1001) plus the buyer's email or the tracking token.",
        inputSchema: z.object({ id: z.string().max(20), email: z.string().max(120).optional(), token: z.string().max(64).optional() }),
        annotations: { readOnlyHint: true },
      },
      async ({ id, email, token }) => {
        try {
          const order = await agentTrack(id, { email, token });
          return order ? result(order) : { isError: true, content: [{ type: "text" as const, text: "No order matches these details." }] };
        } catch (e) {
          return failure(e);
        }
      },
    );
  },
  {
    serverInfo: { name: "giftme", version: "1.0.0" },
    instructions:
      "GiftMe! sells 9 personalized gift boxes (prices in MDL). Never invent products, prices, offers or discounts: use search_boxes and get_quote. Ask the human for explicit confirmation before place_order. Orders wait for the buyer's email confirmation. All orders are practice-company orders (no real payment or delivery).",
  },
);

async function limited(req: Request) {
  const wait = await rateLimit(LIMITS.mcp, clientIp(req.headers));
  if (wait) return new Response(JSON.stringify({ error: "RATE_LIMITED" }), { status: 429, headers: { ...CORS, "Retry-After": String(wait) } });
  const res = await requestIp.run(clientIp(req.headers), () => handler(req));
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(CORS)) out.headers.set(k, v);
  return out;
}

export { limited as GET, limited as POST, limited as DELETE };
export const OPTIONS = preflight;
