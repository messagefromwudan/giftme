import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BOXES, EVERY_BOX_INCLUDES, getBox } from "@/lib/catalog";
import { getDict, hasLocale, href, LOCALES } from "@/i18n";
import { BoxImage } from "@/components/BoxImage";
import { PageShell } from "@/components/PageShell";
import { formatMDL } from "@/components/SiteChrome";
import { JsonLd, productLd } from "@/lib/jsonld";
import { AddToCart } from "@/components/shop/CartBits";
import { PracticeNotice } from "@/components/shop/PracticeNotice";

export function generateStaticParams() {
  return LOCALES.flatMap((lang) => BOXES.map((b) => ({ lang, id: b.slug })));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/cutii/[id]">): Promise<Metadata> {
  const { lang, id } = await params;
  const box = getBox(id);
  if (!box || !hasLocale(lang)) return {};
  const t = getDict(lang);
  const price = box.custom ? t.boxes.customPrice : formatMDL(box.price);
  const path = `/cutii/${box.slug}/`;
  return {
    title: `${box.name} — ${price}`,
    description: `${box.tagline[lang]} ${box.contents.map((c) => c[lang]).join(", ")}.`,
    alternates: { canonical: href(lang, path), languages: { ro: path, en: `/en${path}` } },
    openGraph: { type: "website", url: href(lang, path) },
  };
}

export default async function BoxPage({ params }: PageProps<"/[lang]/cutii/[id]">) {
  const { lang, id } = await params;
  if (!hasLocale(lang)) notFound();
  const box = getBox(id);
  if (!box || box.slug !== id) notFound();
  const t = getDict(lang);
  const path = `/cutii/${box.slug}/`;

  return (
    <PageShell lang={lang} altHref={lang === "ro" ? `/en${path}` : path}>
      <JsonLd data={productLd(box, lang)} />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-14">
        <nav aria-label={lang === "ro" ? "Fir de navigare" : "Breadcrumb"} className="text-sm">
          <Link href={`${href(lang)}#cutii`} className="font-medium text-muted hover:text-red">
            ← {t.boxes.back}
          </Link>
        </nav>

        <div className="mt-6 grid gap-10 md:grid-cols-2">
          <div>
            <BoxImage
              box={box}
              lang={lang}
              fit="natural"
              eager
              sizes="(min-width: 1152px) 552px, (min-width: 768px) 46vw, 92vw"
              className="rounded-3xl"
            />
          </div>

          <div>
            <p className="text-sm font-semibold tracking-widest text-muted">{box.id}</p>
            <h1 className="mt-1 text-5xl sm:text-6xl">{box.name}</h1>
            <p className="mt-4 text-lg leading-relaxed">{box.tagline[lang]}</p>

            <div className="mt-6 rounded-3xl bg-cream p-5">
              <p className="text-sm text-muted">{t.boxes.priceLabel}</p>
              {box.custom ? (
                <>
                  <p className="font-display text-3xl font-black">{t.boxes.customPrice}</p>
                  <p className="text-sm text-muted">{t.boxes.customNote}</p>
                  <p className="mt-1 text-sm font-medium">{t.boxes.customLead}</p>
                </>
              ) : (
                <p className="font-display text-4xl font-black">{formatMDL(box.price)}</p>
              )}
            </div>

            <div className="mt-4 space-y-4">
              <AddToCart boxId={box.id} lang={lang} />
              <PracticeNotice lang={lang} compact />
            </div>

            <h2 className="mt-8 text-2xl">{t.boxes.contents}</h2>
            <ul className="mt-3 space-y-2">
              {box.contents.map((c) => (
                <li key={c.ro} className="flex gap-3">
                  <span aria-hidden="true" className="text-red">✓</span>
                  {c[lang]}
                </li>
              ))}
            </ul>

            {box.custom && (
              <>
                <h2 className="mt-8 text-2xl">{t.boxes.customHowTitle}</h2>
                <ol className="mt-3 list-decimal space-y-2 pl-5 marker:font-semibold marker:text-red">
                  {t.boxes.customHow.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              </>
            )}

            <h2 className="mt-8 text-2xl">{t.boxes.alsoIncluded}</h2>
            <ul className="mt-3 space-y-2">
              {EVERY_BOX_INCLUDES.map((c) => (
                <li key={c.ro} className="flex gap-3">
                  <span aria-hidden="true" className="text-red">♥</span>
                  {c[lang]}
                </li>
              ))}
            </ul>

            <h2 className="mt-8 text-2xl">{t.boxes.occasions}</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {box.occasions.map((o) => (
                <li key={o.ro} className="rounded-full bg-blush px-3 py-1 text-sm font-medium">
                  {o[lang]}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
