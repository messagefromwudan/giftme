import { BOXES, getBox } from "@/lib/catalog";
import { getDict, hasLocale, LOCALES } from "@/i18n";
import { ogCard, ogSize } from "@/lib/og";

export const size = ogSize;
export const contentType = "image/png";
export const alt = "GiftMe! box";

export function generateStaticParams() {
  return LOCALES.flatMap((lang) => BOXES.map((b) => ({ lang, id: b.slug })));
}

export default async function Image({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang: raw, id } = await params;
  const lang = hasLocale(raw) ? raw : "ro";
  const box = getBox(id) ?? BOXES[0];
  const t = getDict(lang);
  return ogCard({
    lang,
    eyebrow: `${box.id} · ${t.hero.eyebrow}`,
    title: box.name,
    accent: box.custom ? t.boxes.customPrice : `${box.price} MDL`,
  });
}
