import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "@/i18n";
import { LegalPage } from "@/components/LegalPage";
import { OFFERS, RULES, SITE } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Termeni și condiții",
  description: "Prețuri, oferte, livrare și plată la GiftMe!.",
  alternates: { canonical: "/termeni/" },
};

// GM-09 terms (fee, value cap, liability, cancellation, data retention) are added
// once the coordinator confirms the open values.
export default async function Terms({ params }: PageProps<"/[lang]/termeni">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return (
    <LegalPage lang={lang} path="/termeni/" title="Termeni și condiții" updated="24 octombrie 2026">
      <p>
        giftme.site este magazinul online al {SITE.legalName}, firmă de exercițiu a elevilor de la CEEF Chișinău.
      </p>

      <h2>Prețuri</h2>
      <p>
        Prețurile sunt afișate în lei moldovenești (MDL). Prețul final, cu oferta aplicată și costul livrării, îl
        vezi înainte să confirmi comanda. Pentru YOUR BOX (GM-09), 360 MDL este taxa de serviciu; cadoul ales se
        cotează separat de echipa noastră.
      </p>

      <h2>Oferte</h2>
      <ul>
        {OFFERS.map((o) => (
          <li key={o.id}>
            <strong>{o.name}</strong>: {o.summary.ro}
          </li>
        ))}
      </ul>
      <p>
        Ofertele nu se cumulează: aplicăm automat oferta cea mai avantajoasă. Codul REFER A FRIEND este valabil
        doar la prima comandă a noului client și nu poate fi folosit pentru propria comandă. Ofertele sunt
        valabile până pe 28 mai 2027.
      </p>

      <h2>Livrare</h2>
      <p>
        În Chișinău, livrarea costă {RULES.delivery.fee} MDL și este gratuită pentru comenzile de la{" "}
        {RULES.delivery.freeThresholdChisinau} MDL (suma de după reducere). În restul Moldovei, livrarea costă{" "}
        {RULES.delivery.fee} MDL. Livrarea surpriză YOUR BOX este inclusă în taxa de serviciu și se face doar în
        Chișinău.
      </p>

      <h2>Plată</h2>
      <p>
        Poți plăti numerar la livrare sau prin transfer bancar. Pentru transfer, îți trimitem detaliile de plată
        prin email după confirmarea comenzii.
      </p>

      <h2>Contact</h2>
      <p>
        {SITE.email} · {SITE.phoneDisplay}
      </p>
    </LegalPage>
  );
}
