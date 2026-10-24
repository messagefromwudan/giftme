import { SITE } from "@/lib/catalog";
import { CORS } from "@/lib/http";

// Served at /.well-known/ai-plugin.json (rewrite in next.config.ts).
export function GET() {
  return Response.json(
    {
      schema_version: "v1",
      name_for_human: "GiftMe!",
      name_for_model: "giftme",
      description_for_human: "Personalized gift boxes from Chișinău. Built for AI agents.",
      description_for_model:
        "Browse GiftMe! gift boxes, get exact server-side quotes in MDL and place orders that the human buyer confirms by email. Never invent products, prices or discounts; ask the human before ordering. All orders are practice-company orders (no real payment or delivery).",
      auth: { type: "none" },
      api: { type: "openapi", url: `${SITE.url}/openapi.json` },
      mcp: { url: `${SITE.url}/mcp`, transport: "streamable-http" },
      logo_url: `${SITE.url}/img/logo-giftme.png`,
      contact_email: SITE.email,
      legal_info_url: `${SITE.url}/termeni/`,
      llms_txt: `${SITE.url}/llms.txt`,
    },
    { headers: { ...CORS, "Cache-Control": "public, max-age=300" } },
  );
}
