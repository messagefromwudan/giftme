"use client";

import Link from "next/link";
import { getBox, type Locale } from "@/lib/catalog";
import { useCart } from "@/lib/cart";
import { getDict, href } from "@/i18n";
import { BoxArt } from "../BoxArt";
import { QuoteSummary } from "./QuoteSummary";
import { useQuote } from "./useQuote";
import { PracticeNotice } from "./PracticeNotice";

export function CartView({ lang }: { lang: Locale }) {
  const t = getDict(lang).shop;
  const cart = useCart();
  const { data, loading, error } = useQuote(cart.items);

  if (cart.items.length === 0) {
    return (
      <div className="rounded-3xl bg-cream p-8 text-center">
        <p className="text-lg">{t.empty}</p>
        <Link href={`${href(lang)}#cutii`} className="btn btn-primary mt-6">
          {t.browse}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <ul className="divide-y divide-black/10 rounded-3xl ring-1 ring-black/10">
        {cart.items.map((item) => {
          const box = getBox(item.boxId);
          if (!box) return null;
          return (
            <li key={item.boxId} className="flex gap-4 p-4">
              <BoxArt box={box} label="" className="size-20 shrink-0 rounded-2xl" />
              <div className="flex flex-1 flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-widest text-muted">{box.id}</p>
                  <Link href={href(lang, `/cutii/${box.slug}/`)} className="font-display text-lg font-black hover:text-red">
                    {box.name}
                  </Link>
                  <p className="text-sm text-muted">{box.custom ? getDict(lang).boxes.customPrice : `${box.price} MDL`}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center rounded-full ring-1 ring-black/20" role="group" aria-label={`${t.qty}: ${box.name}`}>
                    <button
                      type="button"
                      className="grid size-10 place-items-center text-lg"
                      aria-label={t.decrease}
                      onClick={() => cart.setQty(item.boxId, item.quantity - 1)}
                    >
                      −
                    </button>
                    <span className="w-8 text-center font-semibold" aria-live="polite">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      className="grid size-10 place-items-center text-lg"
                      aria-label={t.increase}
                      onClick={() => cart.setQty(item.boxId, item.quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                  <button type="button" onClick={() => cart.remove(item.boxId)} className="text-sm text-muted underline">
                    {t.remove}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <aside className="h-fit space-y-4 rounded-3xl bg-cream p-6 lg:sticky lg:top-24">
        <QuoteSummary lang={lang} quote={data?.quote ?? null} loading={loading} />
        {error && <p className="text-sm text-red-dark">{t.errGeneric}</p>}
        <Link href={href(lang, "/comanda/")} className="btn btn-primary w-full">
          {t.checkout} →
        </Link>
        {data && !data.checkoutOpen && <p className="text-sm text-muted">{t.closed}</p>}
        <PracticeNotice lang={lang} compact />
      </aside>
    </div>
  );
}
