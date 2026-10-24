import type { ReactNode } from "react";
import type { Locale } from "@/lib/catalog";
import { SITE } from "@/lib/catalog";
import type { LegalDoc } from "@/lib/legal";
import { PageShell } from "./PageShell";

/** **bold** → <strong>; our email address → a mailto link. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/).flatMap((part, i) => {
    if (part.startsWith("**")) return [<strong key={i}>{part.slice(2, -2)}</strong>];
    return part.split(SITE.email).flatMap((piece, j) =>
      j === 0
        ? [piece]
        : [
            <a key={`${i}-${j}`} className="text-red underline" href={`mailto:${SITE.email}`}>
              {SITE.email}
            </a>,
            piece,
          ],
    );
  });
}

/** Legal pages are written in Romanian only; the English version shows a short note on top. */
export function LegalPage({ lang, doc }: { lang: Locale; doc: LegalDoc }) {
  const { path, title, updated } = doc;
  return (
    <PageShell lang={lang} altHref={lang === "ro" ? `/en${path}` : path}>
      <article lang="ro" className="mx-auto max-w-3xl px-4 py-12 sm:px-6 md:py-16 [&_h2]:mt-10 [&_h2]:text-2xl [&_li]:mt-1 [&_p]:mt-3 [&_p]:leading-relaxed [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
        {lang === "en" && (
          <p lang="en" className="rounded-2xl bg-cream p-4 text-sm">
            This page is available in Romanian only. Questions? Write to {SITE.email}.
          </p>
        )}
        <h1 className="mt-6 text-4xl sm:text-5xl">{title}</h1>
        <p className="text-sm text-muted">Ultima actualizare: {updated}</p>
        {doc.blocks.map((b, i) => {
          if ("h2" in b)
            return (
              <h2 key={i} id={b.id}>
                {b.h2}
              </h2>
            );
          if ("p" in b) return <p key={i}>{inline(b.p)}</p>;
          if ("ul" in b)
            return (
              <ul key={i}>
                {b.ul.map((x) => (
                  <li key={x}>{inline(x)}</li>
                ))}
              </ul>
            );
          return (
            <ol key={i} className="mt-3 list-decimal space-y-2 pl-5">
              {b.ol.map((x) => (
                <li key={x}>{inline(x)}</li>
              ))}
            </ol>
          );
        })}
      </article>
    </PageShell>
  );
}
