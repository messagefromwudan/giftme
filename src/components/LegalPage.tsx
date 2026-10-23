import type { ReactNode } from "react";
import type { Locale } from "@/lib/catalog";
import { PageShell } from "./PageShell";

/** Legal pages are written in Romanian only; the English version shows a short note on top. */
export function LegalPage({
  lang,
  path,
  title,
  updated,
  children,
}: {
  lang: Locale;
  path: string;
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <PageShell lang={lang} altHref={lang === "ro" ? `/en${path}` : path}>
      <article lang="ro" className="mx-auto max-w-3xl px-4 py-12 sm:px-6 md:py-16 [&_h2]:mt-10 [&_h2]:text-2xl [&_li]:mt-1 [&_p]:mt-3 [&_p]:leading-relaxed [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
        {lang === "en" && (
          <p lang="en" className="rounded-2xl bg-cream p-4 text-sm">
            This page is available in Romanian only. Questions? Write to fe.giftme@gmail.com.
          </p>
        )}
        <h1 className="mt-6 text-4xl sm:text-5xl">{title}</h1>
        <p className="text-sm text-muted">Ultima actualizare: {updated}</p>
        {children}
      </article>
    </PageShell>
  );
}
