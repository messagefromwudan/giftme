import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { hasLocale } from "@/i18n";
import { PageShell } from "@/components/PageShell";
import { Approve } from "@/components/shop/OrderPages";

export const metadata: Metadata = { title: "Confirmă comanda", robots: { index: false } };

// Linked from the email sent when an AI agent places an order: the human approves it here.
export default async function ApprovePage({ params }: PageProps<"/[lang]/confirma-comanda">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return (
    <PageShell lang={lang} altHref={lang === "ro" ? "/en/" : "/"}>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-14">
        <Suspense>
          <Approve lang={lang} />
        </Suspense>
      </div>
    </PageShell>
  );
}
