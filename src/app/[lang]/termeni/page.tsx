import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "@/i18n";
import { LegalPage } from "@/components/LegalPage";
import { OFFERS, RULES, SITE, getBox } from "@/lib/catalog";

const GM09 = getBox("GM-09")!;

export const metadata: Metadata = {
  title: "Termeni și condiții",
  description: "Prețuri, oferte, livrare și plată la GiftMe!.",
  alternates: { canonical: "/termeni/" },
};

export default async function Terms({ params }: PageProps<"/[lang]/termeni">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return (
    <LegalPage lang={lang} path="/termeni/" title="Termeni și condiții" updated="24 octombrie 2026">
      <p>
        giftme.site este magazinul online al {SITE.legalName}, firmă de exercițiu a elevilor de la CEEF Chișinău.
      </p>

      <h2>Comenzi de exercițiu</h2>
      <p>
        Toate comenzile plasate pe giftme.site sunt <strong>comenzi de exercițiu</strong>, în cadrul activității
        firmei de exercițiu: nu se face nicio plată reală și nu se livrează bunuri reale. Prețurile, ofertele și
        pașii comenzii funcționează exact ca într-un magazin adevărat, pentru exercițiu.
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

      <h2 id="gm-09">Condiții YOUR BOX (GM-09)</h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5">
        <li>
          <strong>Serviciu.</strong> {SITE.legalName} pregătește și livrează o cutie personalizată cu cadoul ales
          de client. Taxa de serviciu este {GM09.price} MDL; cadoul se cotează separat.
        </li>
        <li>
          <strong>Cotație și plată.</strong> Echipa GiftMe trimite clientului prețul cadoului, fără taxă de procesare
          suplimentară. Cadoul se cumpără doar după confirmarea plății. Cadourile cu o valoare de peste{" "}
          {RULES.custom.maxGiftValueWithoutApproval.toLocaleString("ro-MD")} MDL necesită aprobarea scrisă a
          coordonatorului.
        </li>
        <li>
          <strong>Păstrare.</strong> De la cumpărare până la livrare, GiftMe păstrează cadoul în condiții de
          siguranță și îl livrează la data și adresa convenite. Livrarea surpriză se face doar în Chișinău.
        </li>
        <li>
          <strong>Verificare.</strong> La livrare se semnează un proces-verbal de predare-primire cu starea
          cadoului.
        </li>
        <li>
          <strong>Daune.</strong> Comenzile sunt de exercițiu: nu se transferă bunuri sau bani reali, deci nu
          există bunuri reale care să se poată deteriora sau pierde.
        </li>
        <li>
          <strong>Anulare.</strong> Clientul poate anula gratuit comanda înainte de cumpărarea cadoului.
        </li>
        <li>
          <strong>Date.</strong> Mesajele audio/video și datele de livrare se folosesc doar pentru comandă și se
          șterg la {RULES.dataRetentionDaysAfterReveal} de zile după ce destinatarul dezvăluie codul PASS-IT-ON.
        </li>
      </ol>

      <h2>Contact</h2>
      <p>
        {SITE.email} · {SITE.phoneDisplay}
      </p>
    </LegalPage>
  );
}
