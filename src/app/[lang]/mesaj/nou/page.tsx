import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { hasLocale } from "@/i18n";
import { PageShell } from "@/components/PageShell";
import { Recorder } from "@/components/messages/Recorder";

export const metadata: Metadata = { title: "Mesajul QR", robots: { index: false, follow: false } };

// The buyer records the QR message here (link from the confirmation email / thank-you page).
export default async function NewMessagePage({ params }: PageProps<"/[lang]/mesaj/nou">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return (
    <PageShell lang={lang} altHref={lang === "ro" ? "/en/" : "/"}>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-14">
        <Suspense>
          <Recorder lang={lang} />
        </Suspense>
      </div>
    </PageShell>
  );
}
