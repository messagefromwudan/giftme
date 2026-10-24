import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { BOXES, EVERY_BOX_INCLUDES, OFFER_NOTES, OFFERS, SITE } from "@/lib/catalog";
import { getDict, hasLocale } from "@/i18n";
import { BoxCard } from "@/components/BoxCard";
import { PageShell } from "@/components/PageShell";
import { SocialIcon } from "@/components/SocialIcon";
import { JsonLd, organizationLd } from "@/lib/jsonld";

export async function generateMetadata({ params }: PageProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  return {
    alternates: { canonical: lang === "en" ? "/en/" : "/", languages: { ro: "/", en: "/en/" } },
  };
}

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDict(lang);

  return (
    <PageShell lang={lang} altHref={lang === "ro" ? "/en/" : "/"}>
      <JsonLd data={organizationLd(lang)} />

      {/* Hero */}
      <section aria-labelledby="hero-title" className="bg-ink text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-4 sm:px-6 md:pt-10 md:grid-cols-[1.2fr_0.8fr] md:pb-24 md:pt-16">
          <div className="hero-rise">
            <p className="eyebrow !text-[#ff8a92]">{t.hero.eyebrow}</p>
            <h1 id="hero-title" className="mt-4 text-[2.6rem] sm:text-6xl lg:text-7xl">
              {t.hero.title1}{" "}
              <span className="hand inline-block -rotate-2 text-[1.12em] leading-none text-red">
                {t.hero.accent}
              </span>
            </h1>
            <p className="mt-6 max-w-[40ch] text-lg leading-relaxed text-muted-dark">{t.hero.copy}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#cutii" className="btn btn-primary">
                {t.hero.ctaPrimary} <span aria-hidden="true">↓</span>
              </a>
              <a href="#cum-functioneaza" className="btn btn-ghost-dark">
                {t.hero.ctaSecondary}
              </a>
            </div>
          </div>
          <div className="order-first flex justify-center md:order-none" aria-hidden="true">
            <div className="giftbox w-[min(60%,220px)] md:w-[min(100%,320px)]">
              <Image src="/img/funda.png" alt="" width={240} height={318} className="giftbox__bow" priority sizes="128px" />
              <span className="giftbox__tag hand">{t.hero.tag}</span>
            </div>
          </div>
        </div>
      </section>

      {/* In every box */}
      <section aria-labelledby="includes-title" className="border-b border-black/10 bg-cream">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <p className="eyebrow">{t.includes.eyebrow}</p>
          <h2 id="includes-title" className="mt-2 text-3xl sm:text-4xl">
            {t.includes.title}
          </h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {EVERY_BOX_INCLUDES.map((item, i) => (
              <li key={i} className="flex items-start gap-3 rounded-2xl bg-white p-4 ring-1 ring-black/10">
                <span className="hand grid size-10 shrink-0 place-items-center rounded-full border-2 border-red text-2xl text-red">
                  {i + 1}
                </span>
                <span className="pt-1.5 font-medium">{item[lang]}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Boxes */}
      <section id="cutii" aria-labelledby="boxes-title" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
        <p className="eyebrow">{t.boxes.eyebrow}</p>
        <h2 id="boxes-title" className="mt-2 text-4xl sm:text-5xl">
          {t.boxes.title} <span className="hand text-[1.15em] text-red">{t.boxes.accent}</span>
        </h2>
        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {BOXES.map((box) => (
            <BoxCard key={box.id} box={box} lang={lang} />
          ))}
        </ul>
      </section>

      {/* How it works */}
      <section id="cum-functioneaza" aria-labelledby="how-title" className="bg-ink text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
          <p className="eyebrow !text-[#ff8a92]">{t.how.eyebrow}</p>
          <h2 id="how-title" className="mt-2 text-4xl sm:text-5xl">
            {t.how.title}
          </h2>
          <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {t.how.steps.map((s, i) => (
              <li key={s.t} className="rounded-3xl border border-white/15 p-6">
                <span className="hand text-5xl text-red">{i + 1}</span>
                <h3 className="mt-3 text-2xl">{s.t}</h3>
                <p className="mt-2 leading-relaxed text-muted-dark">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Offers */}
      <section id="oferte" aria-labelledby="offers-title" className="bg-red text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
          <p className="eyebrow !text-white">{t.offers.eyebrow}</p>
          <h2 id="offers-title" className="mt-2 text-4xl sm:text-5xl">
            {t.offers.title}
          </h2>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {OFFERS.map((o) => (
              <li key={o.id} className="rounded-3xl bg-white p-6 text-ink">
                <p className="font-display text-4xl font-black text-red">
                  {o.percent ? `−${o.percent}%` : `−${o.amount} MDL`}
                </p>
                <h3 className="mt-1 text-xl">{o.name}</h3>
                <p className="mt-2 leading-relaxed text-muted">{o.summary[lang]}</p>
              </li>
            ))}
            <li className="rounded-3xl border-2 border-white/60 p-6">
              <ul className="space-y-3">
                {OFFER_NOTES.map((n, i) => (
                  <li key={i} className="leading-relaxed">
                    {n[lang]}
                  </li>
                ))}
              </ul>
            </li>
          </ul>
        </div>
      </section>

      {/* About */}
      <section id="despre" aria-labelledby="about-title" className="bg-cream">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 md:grid-cols-2 md:py-24">
          <div>
            <p className="eyebrow">{t.about.eyebrow}</p>
            <h2 id="about-title" className="mt-2 text-4xl sm:text-5xl">
              {t.about.title}
            </h2>
          </div>
          <div className="space-y-4 text-lg leading-relaxed">
            {t.about.copy.map((p) => (
              <p key={p}>{p}</p>
            ))}
            <p className="text-base text-muted">{t.about.note}</p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="intrebari" aria-labelledby="faq-title" className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-24">
        <p className="eyebrow">{t.faq.eyebrow}</p>
        <h2 id="faq-title" className="mt-2 text-4xl sm:text-5xl">
          {t.faq.title}
        </h2>
        <div className="mt-8 divide-y divide-black/10 border-y border-black/10">
          {t.faq.items.map((f) => (
            <details key={f.q} className="group py-2">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3 text-lg font-semibold [&::-webkit-details-marker]:hidden">
                {f.q}
                <span aria-hidden="true" className="text-2xl text-red transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="pb-4 leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section id="contact" aria-labelledby="contact-title" className="bg-ink text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
          <p className="eyebrow !text-[#ff8a92]">{t.contact.eyebrow}</p>
          <h2 id="contact-title" className="mt-2 text-4xl sm:text-5xl">
            {t.contact.title}
          </h2>
          <p className="mt-4 max-w-[40ch] text-lg text-muted-dark">{t.contact.copy}</p>
          <ul className="mt-10 grid gap-4 sm:grid-cols-3">
            <li>
              <a href={`mailto:${SITE.email}`} className="block rounded-3xl border border-white/15 p-6 hover:border-white">
                <span className="text-sm text-muted-dark">{t.contact.email}</span>
                <span className="mt-1 block break-all text-lg font-semibold">{SITE.email}</span>
              </a>
            </li>
            <li>
              <a href={`tel:${SITE.phoneIntl}`} className="block rounded-3xl border border-white/15 p-6 hover:border-white">
                <span className="text-sm text-muted-dark">{t.contact.phone}</span>
                <span className="mt-1 block text-lg font-semibold">{SITE.phoneDisplay}</span>
              </a>
            </li>
            <li className="rounded-3xl border border-white/15 p-6">
              <span className="text-sm text-muted-dark">{t.contact.social}</span>
              <ul className="mt-2 space-y-2">
                {SITE.social.map((s) => (
                  <li key={s.id}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 font-semibold hover:underline"
                    >
                      <SocialIcon id={s.id} />
                      {s.handle}
                    </a>
                  </li>
                ))}
              </ul>
            </li>
          </ul>
        </div>
      </section>
    </PageShell>
  );
}
