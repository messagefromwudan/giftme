import type { Locale } from "@/lib/catalog";
import { getDict } from "@/i18n";

/** "Comandă de exercițiu" notice: shown on the cart, checkout, confirmation and tracking pages. */
export function PracticeNotice({ lang, compact }: { lang: Locale; compact?: boolean }) {
  const t = getDict(lang).shop;
  return (
    <div role="note" className={`rounded-2xl border-2 border-red bg-blush ${compact ? "p-3 text-sm" : "p-4"}`}>
      <p className="font-display font-black uppercase tracking-wide text-red-dark">{t.practiceTitle}</p>
      <p className="mt-1">{t.practiceText}</p>
    </div>
  );
}
