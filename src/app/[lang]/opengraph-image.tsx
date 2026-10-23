import { getDict, hasLocale, LOCALES } from "@/i18n";
import { ogCard, ogSize } from "@/lib/og";

export const size = ogSize;
export const contentType = "image/png";
export const alt = "GiftMe!";

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export default async function Image({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params;
  const lang = hasLocale(raw) ? raw : "ro";
  const t = getDict(lang);
  return ogCard({ lang, eyebrow: t.hero.eyebrow, title: "GiftMe!", accent: t.hero.accent });
}
