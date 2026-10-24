import type { MetadataRoute } from "next";
import { SITE } from "@/lib/catalog";

// One group for every crawler and AI agent. The longest matching rule wins, so the agent
// endpoints under /api/agent/ stay open while the rest of /api/ (cron, admin, messages) is closed.
const AGENT_URLS = ["/api/agent/", "/mcp", "/catalog.json", "/llms.txt", "/llms-full.txt", "/openapi.json"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", ...AGENT_URLS],
        disallow: ["/admin/", "/api/", "/cos/", "/comanda/", "/urmarire/", "/confirma-comanda/"],
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
