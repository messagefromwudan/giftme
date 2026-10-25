import { OFFERS, RULES, SITE, getBox, ruleDate } from "./catalog";

// Text of the legal pages (/termeni/, /confidentialitate/), kept as data so the pages and the
// on-site assistant read the same words. Romanian only. **bold** marks emphasis; the pages render
// it as <strong>, the assistant gets plain text.

export type LegalBlock = { h2: string; id?: string } | { p: string } | { ul: string[] } | { ol: string[] };
export type LegalDoc = { path: string; title: string; updated: string; blocks: LegalBlock[] };

const GM09 = getBox("GM-09")!;
const unrevealed = ruleDate(RULES.unrevealedMessagesDeleteOn, "ro");

export const TERMS: LegalDoc = {
  path: "/termeni/",
  title: "Termeni și condiții",
  updated: "24 octombrie 2026",
  blocks: [
    { p: `giftme.site este magazinul online al ${SITE.legalName}, firmă de exercițiu a elevilor de la CEEF Chișinău.` },
    { h2: "Comenzi de exercițiu" },
    {
      p: "Toate comenzile plasate pe giftme.site sunt **comenzi de exercițiu**, în cadrul activității firmei de exercițiu: nu se face nicio plată reală și nu se livrează bunuri reale. Prețurile, ofertele și pașii comenzii funcționează exact ca într-un magazin adevărat, pentru exercițiu.",
    },
    { h2: "Prețuri" },
    {
      p: "Prețurile sunt afișate în lei moldovenești (MDL). Prețul final, cu oferta aplicată și costul livrării, îl vezi înainte să confirmi comanda. Pentru YOUR BOX (GM-09), 360 MDL este taxa de serviciu; cadoul ales se cotează separat de echipa noastră.",
    },
    { h2: "Oferte" },
    { ul: OFFERS.map((o) => `**${o.name}**: ${o.summary.ro}`) },
    {
      p: "Ofertele nu se cumulează: aplicăm automat oferta cea mai avantajoasă. Codul REFER A FRIEND este valabil doar la prima comandă a noului client și nu poate fi folosit pentru propria comandă. Ofertele sunt valabile până pe 28 mai 2027.",
    },
    { h2: "Livrare" },
    {
      p: `În Chișinău, livrarea costă ${RULES.delivery.fee} MDL și este gratuită pentru comenzile de peste ${RULES.delivery.freeOverChisinau} MDL (suma de după reducere; la exact ${RULES.delivery.freeOverChisinau} MDL livrarea costă ${RULES.delivery.fee} MDL). În restul Moldovei, livrarea costă ${RULES.delivery.fee} MDL. Livrarea surpriză YOUR BOX este inclusă în taxa de serviciu și se face doar în Chișinău.`,
    },
    { h2: "Plată" },
    {
      p: "Poți plăti numerar la livrare sau prin transfer bancar. Pentru transfer, îți trimitem detaliile de plată prin email după confirmarea comenzii.",
    },
    { h2: "Condiții YOUR BOX (GM-09)", id: "gm-09" },
    {
      ol: [
        `**Serviciu.** ${SITE.legalName} pregătește și livrează o cutie personalizată cu cadoul ales de client. Taxa de serviciu este ${GM09.price} MDL; cadoul se cotează separat. Data livrării trebuie să fie la cel puțin ${RULES.custom.minLeadDays} zile de la plasarea comenzii.`,
        `**Cotație și plată.** Echipa GiftMe trimite clientului prețul cadoului, fără taxă de procesare suplimentară. Cadoul se cumpără doar după confirmarea plății. Cadourile cu o valoare de peste ${RULES.custom.maxGiftValueWithoutApproval.toLocaleString("ro-MD")} MDL necesită aprobarea scrisă a coordonatorului.`,
        "**Păstrare.** De la cumpărare până la livrare, GiftMe păstrează cadoul în condiții de siguranță și îl livrează la data și adresa convenite. Livrarea surpriză se face doar în Chișinău.",
        "**Verificare.** La livrare se semnează un proces-verbal de predare-primire cu starea cadoului.",
        "**Daune.** Comenzile sunt de exercițiu: nu se transferă bunuri sau bani reali, deci nu există bunuri reale care să se poată deteriora sau pierde.",
        "**Anulare.** Clientul poate anula gratuit comanda înainte de cumpărarea cadoului.",
        `**Date.** Mesajele audio/video se folosesc doar pentru comandă și se șterg la ${RULES.dataRetentionDaysAfterReveal} de zile după ce destinatarul dezvăluie codul PASS-IT-ON. Mesajele al căror cod nu a fost dezvăluit niciodată se șterg pe ${unrevealed}.`,
      ],
    },
    { h2: "Contact" },
    { p: `${SITE.email} · ${SITE.phoneDisplay}` },
  ],
};

export const PRIVACY: LegalDoc = {
  path: "/confidentialitate/",
  title: "Politica de confidențialitate",
  updated: "25 octombrie 2026",
  blocks: [
    {
      p: `${SITE.legalName} („GiftMe!”, „noi”) este o firmă de exercițiu a elevilor de la CEEF Chișinău. Această pagină explică ce date personale colectăm prin giftme.site, de ce și cât timp le păstrăm.`,
    },
    { h2: "Ce date colectăm" },
    {
      ul: [
        "**Când ne scrii sau ne suni** (email, telefon, rețele sociale): numele, datele de contact și ce ne transmiți, ca să-ți putem răspunde.",
        "**Confirmarea prezenței la lansare** (pagina /confirma-prezenta/): numele, emailul și răspunsul tău. Detaliile sunt mai jos, la „Confirmarea prezenței la lansare”.",
        "**Comenzi** (comenzi de exercițiu): numele, emailul și telefonul tău, numele destinatarului, adresa și data livrării, textele de personalizare și, pentru YOUR BOX, cadoul ales. Le folosim ca să pregătim comanda, să-ți trimitem emailuri despre ea și pentru evidența contabilă a firmei de exercițiu.",
        `**Mesajul pentru codul QR**: înregistrarea audio/video sau textul pe care îl lași destinatarului. Fișierele stau într-un spațiu de stocare privat și se deschid doar printr-un link temporar, pentru cine scanează codul QR. Le ștergem la ${RULES.dataRetentionDaysAfterReveal} de zile după ce destinatarul își dezvăluie codul PASS-IT-ON. Mesajele al căror cod nu a fost dezvăluit niciodată se șterg pe ${unrevealed}.`,
        "**Asistentul AI de pe site** (fereastra de chat, cu „Harta emoției” și întrebările despre GiftMe, și pagina /harta-emotiei/): răspunsurile la chestionar și mesajele pe care le scrii sunt trimise către OpenAI (OpenAI OpCo, LLC, SUA), furnizorul modelului de inteligență artificială, ca să primești un răspuns. Înainte de trimitere, înlocuim automat adresele de email și numerele de telefon din ce ai scris. Noi nu salvăm conversația în baza noastră de date și cerem ca OpenAI să nu o păstreze pentru consultare ulterioară. Conversația rămâne doar în pagina deschisă și dispare când închizi sau reîncarci pagina. Nu scrie în conversație date personale.",
        "**Demonstrația /agent-demo**: trimite către OpenAI doar scenariile pregătite de noi pe pagină și datele de contact ale echipei GiftMe, folosite drept client demonstrativ; nu trimite nimic din ce scriu vizitatorii.",
        "**Comenzi plasate de asistenți AI**: dacă asistentul tău AI plasează o comandă, îți trimitem un email de confirmare; comanda se procesează doar după ce o confirmi.",
        "**Statistici de vizitare**: numărăm vizitele anonim, fără cookie-uri și fără să te identificăm.",
      ],
    },
    { h2: "Confirmarea prezenței la lansare" },
    {
      p: `Numele, emailul și răspunsul tău, codul biletului tău și ora la care ai intrat le folosim doar ca să organizăm deschiderea GiftMe! din 2 noiembrie 2026 și nu le dăm nimănui altcuiva. Google este serviciul care păstrează înscrierile (un tabel Google Sheets al echipei) și trimite emailurile (prin Gmail, din contul ${SITE.email}). Codul QR de pe bilet conține doar un cod aleatoriu, nu numele sau emailul tău, și îl generăm noi, fără un serviciu extern. La intrare, echipa scanează codul și marchează în tabel că ai venit.`,
    },
    { p: "Emailurile trimise prin pagina de confirmare și de ce:" },
    {
      ol: [
        "**Confirmarea răspunsului**, imediat după ce trimiți formularul, ca să știi că l-am primit: pentru „Da”, biletul de invitat cu codul QR de intrare; pentru „Nu”, un mesaj de mulțumire.",
        `**O notificare pentru echipă**, la ${SITE.email}, cu numele, emailul și răspunsul tău, ca să știm cine vine.`,
        "**Reamintiri**, doar dacă ai răspuns „Da”: joi, 29 octombrie; duminică, 1 noiembrie; luni, 2 noiembrie, la 07:30 și la 09:00. Dacă te înscrii după una dintre aceste ore, primești doar reamintirile care urmează.",
        "**Un singur email după eveniment**, trimis de echipă după ce a terminat de marcat prezența: dacă ai venit, cu un formular Google Forms pentru părerea ta; dacă ai confirmat, dar n-ai putut ajunge, cu un formular scurt despre motiv. Formularele nu îți cer emailul.",
      ],
    },
    {
      p: "Fiecare email către tine are un link prin care oprești mesajele despre eveniment; poți și să răspunzi cu „STOP”.",
    },
    { h2: "Unde sunt păstrate datele" },
    {
      p: `Datele comenzilor și mesajele QR sunt păstrate în baza noastră de date și în spațiul de stocare privat (Supabase, servere în Uniunea Europeană). Confirmările de prezență la lansare sunt păstrate în Google Sheets. Site-ul este găzduit de Vercel. Emailurile pleacă din contul nostru ${SITE.email}. Accesul la date îl are doar echipa GiftMe, prin panoul de administrare protejat cu parolă și prin contul Google al echipei.`,
    },
    { h2: "Cookie-uri" },
    {
      p: "Site-ul nu folosește cookie-uri de urmărire sau de publicitate. Coșul de cumpărături și pagina de confirmare a prezenței folosesc spațiul de stocare local al browserului tău (coșul, faptul că ai răspuns deja). Panoul de administrare folosește un cookie de sesiune doar pentru echipă.",
    },
    { h2: "Cu cine împărțim datele" },
    {
      p: "Nu vindem și nu închiriem datele tale. Le folosim doar prin serviciile tehnice de care avem nevoie ca site-ul să funcționeze: găzduirea (Vercel), baza de date și stocarea (Supabase), confirmările de prezență la lansare, cu emailurile și formularele lor (Google), emailul și asistentul AI (OpenAI OpCo, LLC, din SUA, doar pentru conversațiile cu asistentul de pe site și demonstrația pentru agenți).",
    },
    { h2: "Drepturile tale" },
    {
      p: `Poți cere oricând să vezi, să corectezi sau să ștergem datele tale, scriindu-ne la ${SITE.email} sau sunând la ${SITE.phoneDisplay}.`,
    },
  ],
};

/** A legal page as plain text (for the assistant). */
export function legalText(doc: LegalDoc): string {
  const plain = (s: string) => s.replace(/\*\*/g, "");
  const lines = [`# ${doc.title} (${doc.path}, actualizat ${doc.updated})`];
  for (const b of doc.blocks) {
    if ("h2" in b) lines.push(`## ${b.h2}`);
    else if ("p" in b) lines.push(plain(b.p));
    else if ("ul" in b) lines.push(...b.ul.map((x) => `- ${plain(x)}`));
    else lines.push(...b.ol.map((x, i) => `${i + 1}. ${plain(x)}`));
  }
  return lines.join("\n");
}
