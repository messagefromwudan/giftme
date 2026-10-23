import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "@/i18n";
import { LegalPage } from "@/components/LegalPage";
import { SITE } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Confidențialitate",
  description: "Ce date colectează GiftMe!, de ce și cât timp le păstrăm.",
  alternates: { canonical: "/confidentialitate/" },
};

// Keep this page in sync with what the site actually collects. Sections for orders,
// audio/video messages and the on-site assistant are added when those features ship.
export default async function Privacy({ params }: PageProps<"/[lang]/confidentialitate">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return (
    <LegalPage lang={lang} path="/confidentialitate/" title="Politica de confidențialitate" updated="24 octombrie 2026">
      <p>
        {SITE.legalName} („GiftMe!”, „noi”) este o firmă de exercițiu a elevilor de la CEEF Chișinău. Această
        pagină explică ce date personale colectăm prin giftme.site, de ce și cât timp le păstrăm.
      </p>

      <h2>Ce date colectăm</h2>
      <ul>
        <li>
          <strong>Când ne scrii sau ne suni</strong> (email, telefon, rețele sociale): numele, datele de contact și
          ce ne transmiți, ca să-ți putem răspunde.
        </li>
        <li>
          <strong>Confirmarea prezenței la lansare</strong> (pagina /confirma-prezenta/): numele, emailul și
          răspunsul tău, ca să-ți trimitem confirmarea și o reamintire.
        </li>
        <li>
          <strong>Statistici de vizitare</strong>: numărăm vizitele anonim, fără cookie-uri și fără să te
          identificăm.
        </li>
      </ul>

      <h2>Cookie-uri</h2>
      <p>
        Site-ul nu folosește cookie-uri de urmărire sau de publicitate. Pagina de confirmare a prezenței ține minte
        în browserul tău că ai răspuns deja, ca să nu-ți ceară din nou formularul.
      </p>

      <h2>Cu cine împărțim datele</h2>
      <p>
        Nu vindem și nu închiriem datele tale. Le folosim doar prin serviciile tehnice de care avem nevoie ca
        site-ul să funcționeze (găzduirea site-ului și contul nostru de email).
      </p>

      <h2>Drepturile tale</h2>
      <p>
        Poți cere oricând să vezi, să corectezi sau să ștergem datele tale, scriindu-ne la{" "}
        <a className="text-red underline" href={`mailto:${SITE.email}`}>
          {SITE.email}
        </a>{" "}
        sau sunând la {SITE.phoneDisplay}.
      </p>
    </LegalPage>
  );
}
