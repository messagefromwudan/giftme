import type { Locale } from "@/lib/catalog";

export const LOCALES: Locale[] = ["ro", "en"];

export const hasLocale = (l: string): l is Locale => (LOCALES as string[]).includes(l);

/** Romanian lives at the root, English under /en. Paths always end with "/". */
export function href(lang: Locale, path = "/"): string {
  return lang === "ro" ? path : `/en${path}`;
}

const ro = {
  meta: {
    title: "GiftMe! — Cutii cadou personalizate | Gândit pentru tine",
    description:
      "Cutii cadou personalizate cu felicitare scrisă de mână și mesajul tău audio/video prin cod QR. 9 cutii de la 360 MDL, livrare în Chișinău și în toată Moldova.",
  },
  skip: "Sari la conținut",
  nav: {
    boxes: "Cutii",
    how: "Cum funcționează",
    offers: "Oferte",
    faq: "Întrebări",
    contact: "Contact",
    menu: "Meniu",
    close: "Închide meniul",
    switchTo: "English",
    home: "GiftMe! – pagina principală",
  },
  announce: {
    badge: "Ne lansăm!",
    text: "Luni, 2 noiembrie 2026 · ora 09:30 · CEEF, Chișinău",
    cta: "Confirmă prezența",
  },
  hero: {
    eyebrow: "Cutii cadou personalizate",
    title1: "Cadoul care spune",
    accent: "„m-am gândit la tine”",
    copy: "Alegi cutia, o personalizăm cu numele lui, scriem felicitarea de mână și adăugăm un cod QR cu mesajul tău audio sau video.",
    ctaPrimary: "Alege cutia",
    ctaSecondary: "Cum funcționează",
    tag: "pentru tine",
    from: "de la",
  },
  includes: {
    eyebrow: "În fiecare cutie",
    title: "Detaliile care fac diferența",
  },
  boxes: {
    eyebrow: "Catalog",
    title: "Alege cutia",
    accent: "potrivită",
    details: "Vezi cutia",
    customPrice: "360 MDL + costul cadoului",
    customNote: "Cadoul îl cotează echipa noastră",
    contents: "Ce conține",
    occasions: "Potrivită pentru",
    alsoIncluded: "Inclus în fiecare cutie",
    back: "Toate cutiile",
    priceLabel: "Preț",
    orderSoonTitle: "Comenzile online se deschid pe 2 noiembrie",
    orderSoonText: "Până atunci, scrie-ne sau sună-ne și rezervăm cutia pentru tine.",
    customHowTitle: "Cum funcționează YOUR BOX",
    customHow: [
      "Ne spui ce cadou visezi să dăruiești (ex. un telefon, o cheie de mașină, o bijuterie).",
      "Echipa noastră îți trimite prețul cadoului, fără alte taxe.",
      "Plătești cotația, abia apoi cumpărăm cadoul.",
      "Îl ambalăm în cutia gravată și îl livrăm surpriză în Chișinău.",
    ],
    photoSoon: "Ilustrație: fotografia cutiei vine în curând",
  },
  how: {
    eyebrow: "Simplu, în 4 pași",
    title: "Cum funcționează",
    steps: [
      { t: "Alegi cutia", d: "Una din cele 9 cutii sau YOUR BOX, cu cadoul visat de tine." },
      { t: "O personalizezi", d: "Numele destinatarului, ocazia, textul gravat și etichetele." },
      { t: "Înregistrezi mesajul", d: "Audio, video sau text. Îl deschide scanând codul QR. Gratuit." },
      { t: "Livrăm", d: "La adresa și data alese. Gratuit în Chișinău de la 800 MDL." },
    ],
  },
  offers: {
    eyebrow: "Oferte",
    title: "Mai multe cutii, mai multă bucurie",
    valid: "Valabile până pe 28 mai 2027",
  },
  about: {
    eyebrow: "Despre noi",
    title: "Cadouri cu sens. Emoții care rămân.",
    copy: [
      "Credem că cele mai frumoase daruri nu sunt despre lucruri, ci despre oamenii care le primesc.",
      "La GiftMe! pornim de la omul căruia vrei să-i aduci bucurie: ce îi place, ce sărbătoriți, ce ai vrea să-i transmiți. Apoi compunem o cutie care spune simplu: „m-am gândit la tine”.",
    ],
    note: "FE GiftMe SRL este o firmă de exercițiu a elevilor de la CEEF Chișinău.",
  },
  faq: {
    eyebrow: "Întrebări frecvente",
    title: "Bine de știut",
    items: [
      {
        q: "Cât costă livrarea?",
        a: "În Chișinău, livrarea este gratuită pentru comenzi de la 800 MDL (după reducere); sub această sumă costă 60 MDL. În restul Moldovei livrarea costă 60 MDL. Livrarea surpriză YOUR BOX este inclusă în Chișinău.",
      },
      {
        q: "Cum funcționează mesajul prin cod QR?",
        a: "După comandă, înregistrezi un mesaj audio sau video (sau scrii un text). Pe cutie punem un cod QR: destinatarul îl scanează și îți vede mesajul. Mesajul este gratuit și îl vede doar cine are codul.",
      },
      {
        q: "Se cumulează ofertele?",
        a: "Nu. Calculăm automat toate ofertele pentru care te califici și o aplicăm pe cea mai avantajoasă. Livrarea gratuită în Chișinău se combină cu orice ofertă.",
      },
      {
        q: "Pot pune în cutie un cadou ales de mine?",
        a: "Da, cu YOUR BOX. Taxa de serviciu este 360 MDL și include cutia gravată, felicitarea, etichetele, mesajul QR și livrarea surpriză în Chișinău. Cadoul îl cotează echipa noastră, iar noi îl cumpărăm doar după ce plătești cotația.",
      },
      {
        q: "Cum pot plăti?",
        a: "Numerar la livrare sau transfer bancar. Pentru transfer, îți trimitem detaliile de plată prin email după confirmarea comenzii.",
      },
      {
        q: "Comandăm pentru o clasă sau o echipă. Avem reducere?",
        a: "Da: de la 10 cutii primiți −20%, iar numele sau logo-ul vostru pe cutii este gratuit.",
      },
    ],
  },
  contact: {
    eyebrow: "Contact",
    title: "Hai să vorbim",
    copy: "Spune-ne pentru cine e cadoul. Te ajutăm să alegi.",
    email: "Email",
    phone: "Telefon",
    social: "Social",
  },
  footer: {
    rights: "Toate drepturile rezervate.",
    practice: "Firmă de exercițiu a CEEF Chișinău.",
    privacy: "Confidențialitate",
    terms: "Termeni",
    top: "Înapoi sus",
  },
  notFound: {
    title: "Pagina asta s-a rătăcit",
    copy: "Nu am găsit ce căutai, dar avem 9 cutii care sigur își găsesc omul.",
    cta: "Înapoi la cutii",
  },
};

export type Dict = typeof ro;

const en: Dict = {
  meta: {
    title: "GiftMe! — Personalized gift boxes | Made with you in mind",
    description:
      "Personalized gift boxes with a handwritten postcard and your audio/video message via QR code. 9 boxes from 360 MDL, delivered in Chișinău and across Moldova.",
  },
  skip: "Skip to content",
  nav: {
    boxes: "Boxes",
    how: "How it works",
    offers: "Offers",
    faq: "FAQ",
    contact: "Contact",
    menu: "Menu",
    close: "Close menu",
    switchTo: "Română",
    home: "GiftMe! – home page",
  },
  announce: {
    badge: "We're launching!",
    text: "Monday, 2 November 2026 · 9:30 · CEEF, Chișinău",
    cta: "RSVP",
  },
  hero: {
    eyebrow: "Personalized gift boxes",
    title1: "The gift that says",
    accent: "“I thought of you”",
    copy: "Pick a box, we personalize it with their name, handwrite the postcard and add a QR code with your audio or video message.",
    ctaPrimary: "Choose a box",
    ctaSecondary: "How it works",
    tag: "for you",
    from: "from",
  },
  includes: {
    eyebrow: "In every box",
    title: "The details that make the difference",
  },
  boxes: {
    eyebrow: "Catalog",
    title: "Choose the",
    accent: "right box",
    details: "See the box",
    customPrice: "360 MDL + gift cost",
    customNote: "Our team quotes the gift",
    contents: "What's inside",
    occasions: "Great for",
    alsoIncluded: "Included in every box",
    back: "All boxes",
    priceLabel: "Price",
    orderSoonTitle: "Online orders open on 2 November",
    orderSoonText: "Until then, email or call us and we'll reserve the box for you.",
    customHowTitle: "How YOUR BOX works",
    customHow: [
      "Tell us the gift you dream of giving (e.g. a phone, a car key, jewelry).",
      "Our team sends you the gift price, with no extra fees.",
      "You pay the quote; only then do we buy the gift.",
      "We wrap it in the engraved box and deliver it as a surprise in Chișinău.",
    ],
    photoSoon: "Illustration: box photo coming soon",
  },
  how: {
    eyebrow: "Simple, in 4 steps",
    title: "How it works",
    steps: [
      { t: "Choose a box", d: "One of our 9 boxes, or YOUR BOX with the gift you dream of." },
      { t: "Personalize it", d: "Recipient's name, occasion, engraving and labels." },
      { t: "Record your message", d: "Audio, video or text. They open it by scanning the QR code. Free." },
      { t: "We deliver", d: "To the address and date you pick. Free in Chișinău from 800 MDL." },
    ],
  },
  offers: {
    eyebrow: "Offers",
    title: "More boxes, more joy",
    valid: "Valid until 28 May 2027",
  },
  about: {
    eyebrow: "About us",
    title: "Gifts with meaning. Feelings that stay.",
    copy: [
      "We believe the most beautiful gifts aren't about things, but about the people who receive them.",
      "At GiftMe! we start from the person you want to make happy: what they love, what you're celebrating, what you want to tell them. Then we put together a box that simply says: “I thought of you”.",
    ],
    note: "FE GiftMe SRL is a student practice company at CEEF Chișinău.",
  },
  faq: {
    eyebrow: "FAQ",
    title: "Good to know",
    items: [
      {
        q: "How much is delivery?",
        a: "In Chișinău, delivery is free for orders from 800 MDL (after discount); below that it costs 60 MDL. Elsewhere in Moldova delivery costs 60 MDL. YOUR BOX surprise delivery is included in Chișinău.",
      },
      {
        q: "How does the QR message work?",
        a: "After ordering, you record an audio or video message (or write a text). We put a QR code on the box: the recipient scans it and sees your message. The message is free and only people with the code can see it.",
      },
      {
        q: "Do offers stack?",
        a: "No. We automatically check every offer you qualify for and apply the one that saves you the most. Free delivery in Chișinău combines with any offer.",
      },
      {
        q: "Can I put a gift of my own choice in the box?",
        a: "Yes, with YOUR BOX. The 360 MDL service fee covers the engraved box, postcard, labels, QR message and surprise delivery in Chișinău. Our team quotes the gift, and we buy it only after you pay the quote.",
      },
      {
        q: "How can I pay?",
        a: "Cash on delivery or bank transfer. For bank transfer, we email you the payment details after your order is confirmed.",
      },
      {
        q: "We're ordering for a class or team. Is there a discount?",
        a: "Yes: from 10 boxes you get −20%, and your name or logo on the boxes is free.",
      },
    ],
  },
  contact: {
    eyebrow: "Contact",
    title: "Let's talk",
    copy: "Tell us who the gift is for. We'll help you choose.",
    email: "Email",
    phone: "Phone",
    social: "Social",
  },
  footer: {
    rights: "All rights reserved.",
    practice: "A practice company of CEEF Chișinău.",
    privacy: "Privacy",
    terms: "Terms",
    top: "Back to top",
  },
  notFound: {
    title: "This page got lost",
    copy: "We couldn't find what you were looking for, but we have 9 boxes that will surely find their person.",
    cta: "Back to the boxes",
  },
};

export const dictionaries: Record<Locale, Dict> = { ro, en };
export const getDict = (lang: Locale) => dictionaries[lang];
