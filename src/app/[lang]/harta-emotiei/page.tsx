import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDict, hasLocale } from "@/i18n";
import { PageShell } from "@/components/PageShell";
import { HartaApp } from "@/components/harta/HartaApp";

export async function generateMetadata({ params }: PageProps<"/[lang]/harta-emotiei">): Promise<Metadata> {
  const { lang } = await params;
  const t = getDict(hasLocale(lang) ? lang : "ro").harta;
  return { title: t.title, description: t.copy, alternates: { canonical: lang === "en" ? "/en/harta-emotiei/" : "/harta-emotiei/" } };
}

export default async function HartaPage({ params }: PageProps<"/[lang]/harta-emotiei">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDict(lang).harta;
  return (
    <PageShell lang={lang} altHref={lang === "ro" ? "/en/harta-emotiei/" : "/harta-emotiei/"}>
      <div className="bg-ink text-white">
        <div className="mx-auto max-w-3xl space-y-8 px-4 py-12 sm:px-6 md:py-16">
          <div>
            <p className="eyebrow !text-[#ff8a92]">{t.eyebrow}</p>
            <h1 className="mt-3 text-4xl sm:text-6xl">{t.title}</h1>
            <p className="mt-4 text-lg leading-relaxed text-muted-dark">{t.copy}</p>
          </div>
          <HartaApp lang={lang} />
        </div>
      </div>
    </PageShell>
  );
}
