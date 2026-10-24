import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "@/i18n";
import { LegalPage } from "@/components/LegalPage";
import { RULES, SITE, ruleDate } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Confidențialitate",
  description: "Ce date colectează GiftMe!, de ce și cât timp le păstrăm.",
  alternates: { canonical: "/confidentialitate/" },
};

// Keep this page in sync with what the site actually collects.
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
          <strong>Comenzi</strong> (comenzi de exercițiu): numele, emailul și telefonul tău, numele
          destinatarului, adresa și data livrării, textele de personalizare și, pentru YOUR BOX, cadoul ales. Le
          folosim ca să pregătim comanda, să-ți trimitem emailuri despre ea și pentru evidența contabilă a firmei
          de exercițiu.
        </li>
        <li>
          <strong>Mesajul pentru codul QR</strong>: înregistrarea audio/video sau textul pe care îl lași
          destinatarului. Fișierele stau într-un spațiu de stocare privat și se deschid doar printr-un link
          temporar, pentru cine scanează codul QR. Le ștergem la {RULES.dataRetentionDaysAfterReveal} de zile după
          ce destinatarul își dezvăluie codul PASS-IT-ON. Mesajele al căror cod nu a fost dezvăluit niciodată se
          șterg pe {ruleDate(RULES.unrevealedMessagesDeleteOn, "ro")}.
        </li>
        <li>
          <strong>Asistentul „Harta emoției”</strong> și <strong>demonstrația /agent-demo</strong>: răspunsurile la
          chestionar și mesajele din conversație sunt trimise către OpenAI (OpenAI OpCo, LLC, SUA), furnizorul
          modelului de inteligență artificială, ca să primești o recomandare. Noi nu salvăm conversația în baza
          noastră de date și cerem ca OpenAI să nu o păstreze pentru consultare ulterioară. Nu scrie în conversație
          date personale de care nu e nevoie.
        </li>
        <li>
          <strong>Comenzi plasate de asistenți AI</strong>: dacă asistentul tău AI plasează o comandă, îți
          trimitem un email de confirmare; comanda se procesează doar după ce o confirmi.
        </li>
        <li>
          <strong>Statistici de vizitare</strong>: numărăm vizitele anonim, fără cookie-uri și fără să te
          identificăm.
        </li>
      </ul>

      <h2>Unde sunt păstrate datele</h2>
      <p>
        Datele comenzilor și mesajele QR sunt păstrate în baza noastră de date și în spațiul de stocare privat
        (Supabase, servere în Uniunea Europeană). Site-ul este găzduit de Vercel. Emailurile pleacă din contul
        nostru {SITE.email}. Accesul la date îl are doar echipa GiftMe, prin panoul de administrare protejat
        cu parolă.
      </p>

      <h2>Cookie-uri</h2>
      <p>
        Site-ul nu folosește cookie-uri de urmărire sau de publicitate. Coșul de cumpărături și pagina de
        confirmare a prezenței folosesc spațiul de stocare local al browserului tău (coșul, faptul că ai
        răspuns deja). Panoul de administrare folosește un cookie de sesiune doar pentru echipă.
      </p>

      <h2>Cu cine împărțim datele</h2>
      <p>
        Nu vindem și nu închiriem datele tale. Le folosim doar prin serviciile tehnice de care avem nevoie ca
        site-ul să funcționeze: găzduirea (Vercel), baza de date și stocarea (Supabase), emailul și asistentul
        AI (OpenAI OpCo, LLC, din SUA, doar pentru conversațiile din „Harta emoției” și demonstrația pentru
        agenți).
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
