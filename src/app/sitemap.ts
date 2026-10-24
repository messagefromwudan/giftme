import type { MetadataRoute } from "next";
import { BOXES, SITE } from "@/lib/catalog";

const paths = [
  "/",
  ...BOXES.map((b) => `/cutii/${b.slug}/`),
  "/harta-emotiei/",
  "/agent-demo/",
  "/confidentialitate/",
  "/termeni/",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return paths.map((p) => ({
    url: `${SITE.url}${p}`,
    alternates: { languages: { ro: `${SITE.url}${p}`, en: `${SITE.url}/en${p}` } },
  }));
}
