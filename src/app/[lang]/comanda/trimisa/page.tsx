import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { hasLocale } from "@/i18n";
import { PageShell } from "@/components/PageShell";
import { ThankYou } from "@/components/shop/OrderPages";

export const metadata: Metadata = { title: "Comandă trimisă", robots: { index: false } };

export default async function ThankYouPage({ params }: PageProps<"/[lang]/comanda/trimisa">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return (
    <PageShell lang={lang} altHref={lang === "ro" ? "/en/" : "/"}>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-14">
        <Suspense>
          <ThankYou lang={lang} />
        </Suspense>
      </div>
    </PageShell>
  );
}
