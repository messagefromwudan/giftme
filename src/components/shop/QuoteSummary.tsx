"use client";

import { RULES, getBox, type Locale } from "@/lib/catalog";
import type { Quote } from "@/lib/pricing";
import { getDict } from "@/i18n";
import { BoxImage } from "../BoxImage";

export function QuoteSummary({
  lang,
  quote,
  loading,
  showFreeHint = true,
  thumbs = false,
}: {
  lang: Locale;
  quote: Quote | null;
  loading?: boolean;
  showFreeHint?: boolean;
  /** Small box photo next to each line (checkout and order pages; the cart list shows its own). */
  thumbs?: boolean;
}) {
  const t = getDict(lang).shop;
  if (!quote) return <p className="text-sm text-muted">{loading ? t.loading : ""}</p>;
  // Free only when strictly over the threshold: at exactly 800 MDL one more leu is still missing.
  const missing = RULES.delivery.freeOverChisinau + 1 - quote.discountedSubtotal;
  const deliveryText =
    quote.delivery.reason === "included_in_custom_box"
      ? t.deliveryIncluded
      : quote.delivery.fee === 0
        ? t.deliveryFree
        : `${quote.delivery.fee} MDL`;

  return (
    <div aria-live="polite" aria-busy={loading} className={loading ? "opacity-60 transition" : "transition"}>
      <dl className="space-y-2 text-[0.95rem]">
        {quote.lines.map((l) => {
          const box = thumbs ? getBox(l.boxId) : undefined;
          return (
            <div key={l.boxId} className={`flex justify-between gap-4 ${box ? "items-center" : ""}`}>
              <dt className={box ? "flex items-center gap-3" : undefined}>
                {box && <BoxImage box={box} lang={lang} decorative sizes="48px" className="size-12 shrink-0 rounded-xl" />}
                <span>
                  {l.quantity} × {l.name}
                </span>
              </dt>
              <dd className="whitespace-nowrap">{l.lineTotal} MDL</dd>
            </div>
          );
        })}
        <div className="flex justify-between gap-4 border-t border-black/10 pt-2">
          <dt>{t.subtotal}</dt>
          <dd>{quote.subtotal} MDL</dd>
        </div>
        {quote.offer && (
          <div className="flex justify-between gap-4 text-red-dark">
            <dt>
              {t.discount} {quote.offer.name}
            </dt>
            <dd className="whitespace-nowrap">−{quote.offer.discount} MDL</dd>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <dt>{t.delivery}</dt>
          <dd>{deliveryText}</dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-black/10 pt-2 font-display text-xl font-black">
          <dt>{t.total}</dt>
          <dd>{quote.total} MDL</dd>
        </div>
      </dl>
      {quote.customGiftPending && <p className="mt-2 text-sm text-muted">{t.giftPending}</p>}
      {quote.offer && (
        <p className="mt-3 rounded-xl bg-blush px-3 py-2 text-sm">
          {t.bestOffer} <strong>{quote.offer.name}</strong>
        </p>
      )}
      {showFreeHint && quote.delivery.fee > 0 && missing > 0 && missing < 400 && (
        <p className="mt-2 text-sm text-muted">{t.freeDeliveryHint(missing)}</p>
      )}
    </div>
  );
}
