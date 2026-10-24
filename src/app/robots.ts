import type { MetadataRoute } from "next";
import { SITE } from "@/lib/catalog";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin/", "/api/", "/cos/", "/comanda/", "/urmarire/", "/confirma-comanda/"] }],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
