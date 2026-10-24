import { SITE } from "@/lib/catalog";
import { CORS } from "@/lib/http";

// Served at /.well-known/mcp.json (rewrite in next.config.ts): where to find our MCP server.
export function GET() {
  return Response.json(
    {
      name: "giftme",
      title: "GiftMe! gift boxes",
      description: "Search gift boxes, get quotes and place orders that the buyer confirms by email.",
      url: `${SITE.url}/mcp`,
      transport: "streamable-http",
      authentication: "none",
      tools: ["search_boxes", "get_box", "build_custom_box", "get_quote", "place_order", "track_order"],
      documentation: `${SITE.url}/llms.txt`,
    },
    { headers: { ...CORS, "Cache-Control": "public, max-age=300" } },
  );
}
