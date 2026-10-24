"use client";

import Link from "next/link";
import { useState } from "react";
import type { Locale } from "@/lib/catalog";
import { useCart } from "@/lib/cart";
import { getDict, href } from "@/i18n";

export function AddToCart({ boxId, lang }: { boxId: string; lang: Locale }) {
  const t = getDict(lang).shop;
  const { add } = useCart();
  const [added, setAdded] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => {
          add(boxId);
          setAdded(true);
        }}
      >
        {t.add}
      </button>
      <p role="status" className="text-sm">
        {added && (
          <>
            ✓ {t.added} ·{" "}
            <Link href={href(lang, "/cos/")} className="font-semibold underline">
              {t.viewCart}
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

export function CartLink({ lang }: { lang: Locale }) {
  const t = getDict(lang).shop;
  const { count } = useCart();
  return (
    <Link
      href={href(lang, "/cos/")}
      className="flex h-10 items-center gap-1.5 rounded-full border border-black/20 px-3 text-sm font-semibold hover:border-ink"
    >
      {t.cart}
      <span
        className={`grid min-w-6 place-items-center rounded-full px-1.5 text-xs ${count ? "bg-red text-white" : "bg-black/10"}`}
      >
        {count}
      </span>
    </Link>
  );
}
