import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@/lib/catalog";
import { SITE } from "@/lib/catalog";
import { getDict, href } from "@/i18n";
import { CartLink } from "./shop/CartBits";

/** Launch banner; remove after 2 Nov 2026. */
export function AnnounceBar({ lang }: { lang: Locale }) {
  const t = getDict(lang).announce;
  return (
    // A static HTML page in /public, so a full page load (not <Link>) is intended.
    // eslint-disable-next-line @next/next/no-html-link-for-pages
    <a
      href="/confirma-prezenta/"
      className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-red px-4 py-2 text-center text-sm text-white"
    >
      <span className="hand text-xl leading-none">{t.badge}</span>
      <span>{t.text}</span>
      <span className="font-semibold underline underline-offset-4">
        {t.cta} <span aria-hidden="true">→</span>
      </span>
    </a>
  );
}

export function SiteHeader({ lang, altHref }: { lang: Locale; altHref: string }) {
  const t = getDict(lang).nav;
  const home = href(lang);
  const links = [
    { href: `${home}#cutii`, label: t.boxes },
    { href: href(lang, "/harta-emotiei/"), label: getDict(lang).harta.nav },
    { href: `${home}#cum-functioneaza`, label: t.how },
    { href: `${home}#oferte`, label: t.offers },
    { href: `${home}#intrebari`, label: t.faq },
    { href: `${home}#contact`, label: t.contact },
  ];
  const otherLang = lang === "ro" ? "en" : "ro";

  return (
    <header className="sticky top-0 z-40 border-b border-black/10 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href={home} className="shrink-0" aria-label={t.home}>
          <Image src="/img/logo-giftme.png" alt="" width={720} height={363} priority className="h-9 w-auto" sizes="80px" />
        </Link>

        <nav aria-label={lang === "ro" ? "Principal" : "Main"} className="hidden lg:block">
          <ul className="flex items-center gap-6 text-[0.95rem] font-medium">
            {links.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="hover:text-red">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <CartLink lang={lang} />
          <Link
            href={altHref}
            hrefLang={otherLang}
            lang={otherLang}
            className="rounded-full border border-black/20 px-3 py-1.5 text-sm font-semibold hover:border-ink"
          >
            {otherLang.toUpperCase()}
            <span className="sr-only"> – {t.switchTo}</span>
          </Link>

          <details className="group relative lg:hidden">
            <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-white [&::-webkit-details-marker]:hidden">
              <span className="group-open:hidden">{t.menu}</span>
              <span className="hidden group-open:inline">{t.close}</span>
            </summary>
            <nav
              aria-label={lang === "ro" ? "Principal" : "Main"}
              className="absolute right-0 top-12 w-60 rounded-2xl bg-white p-2 shadow-xl ring-1 ring-black/10"
            >
              <ul>
                {links.map((l) => (
                  <li key={l.href}>
                    <a href={l.href} className="block rounded-xl px-4 py-3 font-medium hover:bg-blush">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter({ lang }: { lang: Locale }) {
  const t = getDict(lang);
  return (
    <footer className="bg-ink text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="hand text-3xl text-white">{SITE.slogan[lang]}</p>
          <p className="mt-2 text-sm text-muted-dark">
            © 2026 {SITE.legalName}. {t.footer.rights} {t.footer.practice}
          </p>
        </div>
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <li>
            <Link href={href(lang, "/confidentialitate/")} className="hover:underline">
              {t.footer.privacy}
            </Link>
          </li>
          <li>
            <Link href={href(lang, "/termeni/")} className="hover:underline">
              {t.footer.terms}
            </Link>
          </li>
          <li>
            <a href="#top" className="hover:underline">
              {t.footer.top} ↑
            </a>
          </li>
        </ul>
      </div>
    </footer>
  );
}

export function SkipLink({ lang }: { lang: Locale }) {
  return (
    <a
      href="#continut"
      className="sr-only z-50 rounded-full bg-ink px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
    >
      {getDict(lang).skip}
    </a>
  );
}

export const formatMDL = (n: number) => `${n} MDL`;
