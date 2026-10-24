import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "@/i18n";
import { LegalPage } from "@/components/LegalPage";
import { TERMS } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Termeni și condiții",
  description: "Prețuri, oferte, livrare și plată la GiftMe!.",
  alternates: { canonical: "/termeni/" },
};

// The text lives in src/lib/legal.ts: the on-site assistant answers from the same words.
export default async function Terms({ params }: PageProps<"/[lang]/termeni">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return <LegalPage lang={lang} doc={TERMS} />;
}
