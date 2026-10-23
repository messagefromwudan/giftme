import Link from "next/link";
import type { Box, Locale } from "@/lib/catalog";
import { getDict, href } from "@/i18n";
import { BoxArt } from "./BoxArt";
import { formatMDL } from "./SiteChrome";

export function BoxCard({ box, lang }: { box: Box; lang: Locale }) {
  const t = getDict(lang).boxes;
  return (
    <li className="group relative flex flex-col overflow-hidden rounded-3xl bg-white ring-1 ring-black/10 transition hover:-translate-y-1 hover:shadow-xl">
      <BoxArt box={box} label="" crop className="aspect-[4/3] w-full sm:aspect-square" />
      <div className="flex flex-1 flex-col gap-2 p-5">
        <p className="text-xs font-semibold tracking-widest text-muted">{box.id}</p>
        <h3 className="text-2xl">
          <Link href={href(lang, `/cutii/${box.slug}/`)} className="after:absolute after:inset-0">
            {box.name}
          </Link>
        </h3>
        <p className="text-[0.95rem] leading-relaxed text-muted">{box.tagline[lang]}</p>
        <div className="mt-auto flex items-end justify-between gap-3 pt-3">
          {box.custom ? (
            <p>
              <span className="block font-display text-xl font-black">{t.customPrice}</span>
              <span className="text-xs text-muted">{t.customNote}</span>
            </p>
          ) : (
            <p className="font-display text-2xl font-black">{formatMDL(box.price)}</p>
          )}
          <span aria-hidden="true" className="whitespace-nowrap text-sm font-semibold text-red group-hover:underline">
            {t.details} →
          </span>
        </div>
      </div>
    </li>
  );
}
