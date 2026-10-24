import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDict, hasLocale } from "@/i18n";
import { PageShell } from "@/components/PageShell";
import { Checkout } from "@/components/shop/Checkout";

export const metadata: Metadata = { title: "Comandă", robots: { index: false } };

export default async function CheckoutPage({ params }: PageProps<"/[lang]/comanda">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDict(lang).shop;
  return (
    <PageShell lang={lang} altHref={lang === "ro" ? "/en/comanda/" : "/comanda/"}>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-14">
        <h1 className="mb-8 text-4xl sm:text-5xl">{t.steps[1]}</h1>
        <Checkout lang={lang} />
      </div>
    </PageShell>
  );
}
