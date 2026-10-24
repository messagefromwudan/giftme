import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDict, hasLocale } from "@/i18n";
import { PageShell } from "@/components/PageShell";
import { CartView } from "@/components/shop/CartView";

export const metadata: Metadata = { title: "Coș", robots: { index: false } };

export default async function CartPage({ params }: PageProps<"/[lang]/cos">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return (
    <PageShell lang={lang} altHref={lang === "ro" ? "/en/cos/" : "/cos/"}>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-14">
        <h1 className="mb-8 text-4xl sm:text-5xl">{getDict(lang).shop.cartTitle}</h1>
        <CartView lang={lang} />
      </div>
    </PageShell>
  );
}
