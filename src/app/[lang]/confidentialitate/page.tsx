import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "@/i18n";
import { LegalPage } from "@/components/LegalPage";
import { PRIVACY } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Confidențialitate",
  description: "Ce date colectează GiftMe!, de ce și cât timp le păstrăm.",
  alternates: { canonical: "/confidentialitate/" },
};

// Keep src/lib/legal.ts in sync with what the site actually collects; the on-site assistant
// answers privacy questions from the same text.
export default async function Privacy({ params }: PageProps<"/[lang]/confidentialitate">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return <LegalPage lang={lang} doc={PRIVACY} />;
}
