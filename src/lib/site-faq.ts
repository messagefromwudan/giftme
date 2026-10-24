import { RULES, SITE, type Locale } from "./catalog";
import { getDict } from "@/i18n";

// Fixed questions and answers for the chat widget: shown as suggestions, and as the whole
// answer set when the AI is unavailable (no key, API error, daily budget used up).
// Built from the site's FAQ and the catalog rules, so the numbers never drift.

export const CONTACT = { email: SITE.email, phone: SITE.phoneDisplay, phoneHref: `tel:${SITE.phoneIntl}` };

export type StaticQA = { q: string; a: string };

export function staticQuestions(lang: Locale): StaticQA[] {
  const t = getDict(lang);
  const extra: StaticQA[] =
    lang === "ro"
      ? [
          {
            q: "Cu cât timp înainte trebuie să comand?",
            a: `Data livrării o alegi la comandă: cel mai devreme peste ${RULES.delivery.minLeadDays} zile pentru cutiile GM-01…GM-08 și peste ${RULES.custom.minLeadDays} zile pentru YOUR BOX (GM-09).`,
          },
          { q: "Comenzile sunt reale?", a: t.shop.practiceText },
          {
            q: "Pot vorbi cu un om din echipă?",
            a: `Desigur. Scrie-ne la ${CONTACT.email} sau sună la ${CONTACT.phone}.`,
          },
        ]
      : [
          {
            q: "How far ahead do I need to order?",
            a: `You choose the delivery date at checkout: at the earliest in ${RULES.delivery.minLeadDays} days for boxes GM-01…GM-08 and in ${RULES.custom.minLeadDays} days for YOUR BOX (GM-09).`,
          },
          { q: "Are the orders real?", a: t.shop.practiceText },
          {
            q: "Can I talk to a person on the team?",
            a: `Of course. Email ${CONTACT.email} or call ${CONTACT.phone}.`,
          },
        ];
  return [...t.faq.items, ...extra];
}

/** What the assistant says when the answer is not in the site's information. */
export const noAnswerText = (lang: Locale) =>
  lang === "ro"
    ? `Nu găsesc răspunsul în informațiile de pe site și nu vreau să inventez. Echipa GiftMe te ajută: scrie-ne la ${CONTACT.email} sau sună la ${CONTACT.phone}.`
    : `I can't find the answer in the site's information and I don't want to guess. The GiftMe team can help: email ${CONTACT.email} or call ${CONTACT.phone}.`;
