import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { hasLocale } from "@/i18n";
import { PageShell } from "@/components/PageShell";
import { Track } from "@/components/shop/OrderPages";

export const metadata: Metadata = {
  title: "Urmărește comanda",
  robots: { index: false },
  alternates: { canonical: "/urmarire/" },
};

export default async function TrackPage({ params }: PageProps<"/[lang]/urmarire">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return (
    <PageShell lang={lang} altHref={lang === "ro" ? "/en/urmarire/" : "/urmarire/"}>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-14">
        <Suspense>
          <Track lang={lang} />
        </Suspense>
      </div>
    </PageShell>
  );
}
