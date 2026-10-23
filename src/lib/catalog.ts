// Single source of truth for everything GiftMe sells. The site, /catalog.json, /llms.txt,
// the OpenAPI file, the MCP server and the on-site agent all read from here.
// Prices are whole MDL. Never name third-party brands in any text below.

export type Locale = "ro" | "en";
export type Text = Record<Locale, string>;

export type BoxId =
  | "GM-01"
  | "GM-02"
  | "GM-03"
  | "GM-04"
  | "GM-05"
  | "GM-06"
  | "GM-07"
  | "GM-08"
  | "GM-09";

export type Motif =
  | "friends"
  | "romance"
  | "corporate"
  | "creative"
  | "beauty"
  | "self"
  | "teacher"
  | "special"
  | "custom";

export type Box = {
  id: BoxId;
  /** URL segment, e.g. /cutii/gm-01/ */
  slug: string;
  name: string;
  /** Fixed price for GM-01…GM-08; for GM-09 the service fee (the gift is quoted separately). */
  price: number;
  /** GM-09 only: the gift itself is bought on request and quoted by a human. */
  custom?: true;
  tagline: Text;
  contents: Text[];
  occasions: Text[];
  /** Tags used by search_boxes and the on-site agent. */
  tags: string[];
  motif: Motif;
  /** Path under /public once real photos arrive; until then the illustrated placeholder is used. */
  photo?: string;
};

export const SITE = {
  url: "https://www.giftme.site",
  name: "GiftMe!",
  legalName: "FE GiftMe SRL",
  slogan: { ro: "Gândit pentru tine", en: "Made with you in mind" } satisfies Text,
  email: "fe.giftme@gmail.com",
  phoneDisplay: "068 951 000",
  phoneIntl: "+37368951000",
  currency: "MDL",
  social: {
    instagram: "https://www.instagram.com/giftme.md/",
    tiktok: "https://www.tiktok.com/@fe.giftme.md",
    facebook: "https://www.facebook.com/FE.giftme.SRL.md",
  },
} as const;

/** Included in every box, GM-01…GM-09. */
export const EVERY_BOX_INCLUDES: Text[] = [
  { ro: "Cutie personalizată", en: "Personalized box" },
  { ro: "Felicitare scrisă de mână", en: "Handwritten postcard" },
  {
    ro: "Etichete „De ce am ales asta pentru tine”",
    en: "“Why I chose this for you” labels",
  },
  {
    ro: "Cod QR spre mesajul tău audio/video (gratuit)",
    en: "QR code linking to your audio/video message (free)",
  },
];

export const BOXES: Box[] = [
  {
    id: "GM-01",
    slug: "gm-01",
    name: "BOX F-R-I-E-N-D-S",
    price: 440,
    tagline: {
      ro: "Pentru prietenii cu care ai râs până la lacrimi.",
      en: "For the friends you've laughed with until you cried.",
    },
    contents: [
      { ro: "Ciocolată artizanală (100 g)", en: "Artisan chocolate (100 g)" },
      { ro: "Gustări", en: "Snacks" },
      { ro: "Album foto", en: "Photo album" },
      { ro: "Joc de cărți „Adevăr sau provocare”", en: "Truth-or-Dare card game" },
      { ro: "Capsula FE GiftMe", en: "FE GiftMe capsule" },
    ],
    occasions: [
      { ro: "Prieteni", en: "Friends" },
      { ro: "Absolvire", en: "Graduation" },
      { ro: "Zi de naștere", en: "Birthday" },
    ],
    tags: ["friends", "graduation", "birthday", "fun", "memories"],
    motif: "friends",
  },
  {
    id: "GM-02",
    slug: "gm-02",
    name: "BOX ROMANCE",
    price: 580,
    tagline: {
      ro: "O seară doar a voastră: pictați, ascultați, aprindeți o lumânare făcută de voi.",
      en: "An evening just for you two: paint, listen, light a candle you made yourselves.",
    },
    contents: [
      { ro: "Kit de pictat un tablou împreună", en: "Paint-a-picture-together kit" },
      { ro: "Cutie muzicală cu playlist", en: "Music box with a playlist" },
      { ro: "Kit de făcut lumânări", en: "Candle-making kit" },
    ],
    occasions: [
      { ro: "Aniversare de cuplu", en: "Couple anniversary" },
      { ro: "Ziua îndrăgostiților", en: "Valentine's Day" },
      { ro: "Surpriză romantică", en: "Romantic surprise" },
    ],
    tags: ["romance", "couple", "anniversary", "valentine", "love", "experience"],
    motif: "romance",
  },
  {
    id: "GM-03",
    slug: "gm-03",
    name: "BOX CORPORATE",
    price: 500,
    tagline: {
      ro: "Un „mulțumim” elegant pentru colegi, parteneri și echipă.",
      en: "An elegant “thank you” for colleagues, partners and teams.",
    },
    contents: [
      { ro: "Ceai premium", en: "Premium tea" },
      { ro: "Gustări", en: "Snacks" },
      { ro: "Cană personalizată", en: "Personalized mug" },
      { ro: "Joc anti-stres", en: "Anti-stress game" },
      { ro: "Pix metalic personalizat", en: "Personalized metal pen" },
    ],
    occasions: [
      { ro: "Colegi", en: "Colleagues" },
      { ro: "Parteneri de afaceri", en: "Business partners" },
      { ro: "Evenimente de echipă", en: "Team events" },
    ],
    tags: ["corporate", "colleagues", "business", "team", "thank-you", "office"],
    motif: "corporate",
  },
  {
    id: "GM-04",
    slug: "gm-04",
    name: "BOX CREATIVE",
    price: 560,
    tagline: {
      ro: "Pentru mâinile care nu stau locului și mintea plină de idei.",
      en: "For restless hands and a head full of ideas.",
    },
    contents: [
      { ro: "Set de construcție cu flori de sakura", en: "Sakura building blocks" },
      { ro: "Kit de croșetat", en: "Crochet kit" },
      { ro: "Carte de desenat (doodle)", en: "Doodle book" },
      { ro: "Markere acrilice", en: "Acrylic markers" },
    ],
    occasions: [
      { ro: "Zi de naștere", en: "Birthday" },
      { ro: "Pentru oameni creativi", en: "For creative people" },
      { ro: "Hobby nou", en: "A new hobby" },
    ],
    tags: ["creative", "art", "hobby", "crafts", "birthday", "teen"],
    motif: "creative",
  },
  {
    id: "GM-05",
    slug: "gm-05",
    name: "BOX BEAUTY",
    price: 450,
    tagline: {
      ro: "Un mic ritual de răsfăț, cu numele ei pe el.",
      en: "A small pampering ritual, with her name on it.",
    },
    contents: [
      { ro: "Măști de față cu gel", en: "Gel face masks" },
      { ro: "Trusă de machiaj și oglindă personalizate", en: "Personalized makeup bag and mirror" },
      { ro: "Săpun natural", en: "Natural soap" },
    ],
    occasions: [
      { ro: "Zi de naștere", en: "Birthday" },
      { ro: "8 Martie", en: "Women's Day (8 March)" },
      { ro: "Răsfăț", en: "Pampering" },
    ],
    tags: ["beauty", "self-care", "pampering", "birthday", "women's day"],
    motif: "beauty",
  },
  {
    id: "GM-06",
    slug: "gm-06",
    name: "BOX PENTRU TINE",
    price: 570,
    tagline: {
      ro: "Pentru cineva care are nevoie de o pauză și de un „ești minunat(ă)”.",
      en: "For someone who needs a pause and a “you are wonderful”.",
    },
    contents: [
      { ro: "Ceai", en: "Tea" },
      { ro: "Bombă de baie cu lavandă", en: "Lavender bath bomb" },
      { ro: "Jurnal de self-care", en: "Self-care journal" },
      { ro: "Cărți cu afirmații", en: "Affirmation cards" },
      { ro: "Ciocolată artizanală", en: "Artisan chocolate" },
    ],
    occasions: [
      { ro: "Self-care", en: "Self-care" },
      { ro: "Încurajare", en: "Encouragement" },
      { ro: "Pentru tine însuți", en: "For yourself" },
    ],
    tags: ["self-care", "relax", "encouragement", "wellbeing", "for-me"],
    motif: "self",
  },
  {
    id: "GM-07",
    slug: "gm-07",
    name: "BOX PROFESOR",
    price: 530,
    tagline: {
      ro: "Pentru profesorul care a crezut în tine.",
      en: "For the teacher who believed in you.",
    },
    contents: [
      { ro: "Ceai personalizat", en: "Personalized tea" },
      { ro: "Gustări", en: "Snacks" },
      { ro: "Agendă personalizată", en: "Personalized planner" },
      { ro: "Suculentă în ghiveci", en: "Potted succulent" },
      { ro: "Jurnal cu mesaj", en: "Journal with a message" },
    ],
    occasions: [
      { ro: "Ziua profesorului", en: "Teachers' Day" },
      { ro: "Sfârșit de an școlar", en: "End of the school year" },
      { ro: "Mulțumire", en: "Thank you" },
    ],
    tags: ["teacher", "school", "thank-you", "graduation", "class"],
    motif: "teacher",
  },
  {
    id: "GM-08",
    slug: "gm-08",
    name: "BOX SPECIAL",
    price: 550,
    tagline: {
      ro: "Cinci zile de numărătoare inversă, câte o surpriză pe zi.",
      en: "A five-day countdown, one surprise a day.",
    },
    contents: [
      { ro: "Numărătoare inversă de 5 zile, 5 compartimente", en: "5-day countdown, 5 compartments" },
      { ro: "Ciocolată caldă", en: "Hot chocolate" },
      { ro: "Lumânare mini", en: "Mini candle" },
      { ro: "Ciocolată artizanală", en: "Artisan chocolate" },
      { ro: "Felicitare", en: "Postcard" },
      { ro: "Ornament gravat", en: "Engraved ornament" },
    ],
    occasions: [
      { ro: "Numărătoare până la o zi importantă", en: "Countdown to a big day" },
      { ro: "Sărbători de iarnă", en: "Winter holidays" },
      { ro: "Zi de naștere", en: "Birthday" },
    ],
    tags: ["countdown", "holidays", "winter", "birthday", "surprise"],
    motif: "special",
  },
  {
    id: "GM-09",
    slug: "gm-09",
    name: "YOUR BOX",
    price: 360,
    custom: true,
    tagline: {
      ro: "Tu ne spui cadoul visat, noi îl cumpărăm, îl ambalăm și îl livrăm surpriză.",
      en: "You name the dream gift, we buy it, wrap it and deliver it as a surprise.",
    },
    contents: [
      { ro: "Cutie gravată", en: "Engraved box" },
      { ro: "Felicitare și etichete scrise de mână", en: "Handwritten postcard and labels" },
      { ro: "Mesaj audio/video prin cod QR", en: "Audio/video message via QR code" },
      {
        ro: "Livrare surpriză acasă în Chișinău (confetti inclus)",
        en: "Surprise home delivery in Chișinău (confetti included)",
      },
      {
        ro: "Cadoul ales de tine (ex. un telefon, o cheie de mașină, o bijuterie), cotat separat",
        en: "The gift you choose (e.g. a phone, a car key, jewelry), quoted separately",
      },
    ],
    occasions: [
      { ro: "Cerere în căsătorie", en: "Proposal" },
      { ro: "Cadou mare, surpriză", en: "Big surprise gift" },
      { ro: "Orice ocazie", en: "Any occasion" },
    ],
    tags: ["custom", "surprise", "own-gift", "proposal", "premium"],
    motif: "custom",
  },
];

export const CUSTOM_BOX_ID: BoxId = "GM-09";

export function getBox(id: string): Box | undefined {
  const norm = id.trim().toUpperCase();
  return BOXES.find((b) => b.id === norm || b.slug.toUpperCase() === norm);
}

/** Business rules used by the pricing engine. Kept as data so catalog.json can publish them verbatim. */
export const RULES = {
  /** Offers valid through this date (inclusive, Chișinău time). */
  offersValidUntil: "2027-05-28",
  timeZone: "Europe/Chisinau",
  delivery: {
    fee: 60,
    /** Free delivery in Chișinău when the subtotal AFTER discount is at least this. */
    freeThresholdChisinau: 800,
    /** Decision 3: 60 MDL anywhere in Moldova, never free outside Chișinău. */
    deliversOutsideChisinau: true,
  },
  custom: {
    /** GM-09 surprise delivery outside Chișinău is not offered until the director sets a price. */
    deliversOutsideChisinau: false,
  },
  /** Sanity cap per order; larger team/class orders are handled by email. */
  maxBoxesPerOrder: 100,
} as const;

export type OfferId = "DUO" | "TRIO" | "ECHIPA" | "PASS_IT_ON" | "REFERRAL";

export type Offer = {
  id: OfferId;
  name: string;
  summary: Text;
  /** Percent off box prices, or a fixed MDL amount. */
  percent?: number;
  amount?: number;
};

export const OFFERS: Offer[] = [
  {
    id: "DUO",
    name: "DUO",
    percent: 10,
    summary: { ro: "−10% când comanzi 2 cutii.", en: "−10% when you order 2 boxes." },
  },
  {
    id: "TRIO",
    name: "TRIO",
    percent: 15,
    summary: { ro: "−15% pentru 3–9 cutii.", en: "−15% for 3–9 boxes." },
  },
  {
    id: "ECHIPA",
    name: "ECHIPĂ / CLASĂ",
    percent: 20,
    summary: {
      ro: "−20% de la 10 cutii, iar numele sau logo-ul vostru pe cutii e gratuit.",
      en: "−20% from 10 boxes, and your name or logo on the boxes is free.",
    },
  },
  {
    id: "PASS_IT_ON",
    name: "PASS-IT-ON",
    percent: 15,
    summary: {
      ro: "Cine primește cutia scanează codul QR și primește un cod unic de −15% la propria cutie, valabil 30 de zile.",
      en: "The recipient scans the QR code and gets a unique −15% code for their own box, valid for 30 days.",
    },
  },
  {
    id: "REFERRAL",
    name: "REFER A FRIEND",
    amount: 50,
    summary: {
      ro: "−50 MDL pentru tine și −50 MDL pentru prietenul tău la prima lui comandă.",
      en: "−50 MDL for you and −50 MDL for your friend on their first order.",
    },
  },
];

export const OFFER_NOTES: Text[] = [
  {
    ro: "Ofertele nu se cumulează: aplicăm automat oferta cea mai avantajoasă pentru tine.",
    en: "Offers don't stack: we automatically apply the one that saves you the most.",
  },
  {
    ro: "Livrare gratuită în Chișinău pentru comenzi de la 800 MDL (după reducere); se combină cu orice ofertă.",
    en: "Free delivery in Chișinău for orders from 800 MDL (after discount); combines with any offer.",
  },
  {
    ro: "Ofertele sunt valabile până pe 28 mai 2027.",
    en: "Offers are valid until 28 May 2027.",
  },
];
