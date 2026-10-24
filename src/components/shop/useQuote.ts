"use client";

import { useEffect, useState } from "react";
import type { Quote } from "@/lib/pricing";
import type { CartItem } from "@/lib/cart";

export type QuoteResponse = {
  quote: Quote;
  code?: { code: string; applied: boolean; rejected?: string };
  checkoutOpen: boolean;
  deliveryDates: { min: string; max: string };
};

/** Asks the server to price the cart. Debounced; the last request wins. */
export function useQuote(
  items: CartItem[],
  opts: { zone?: "chisinau" | "moldova"; code?: string; email?: string } = {},
) {
  const [data, setData] = useState<QuoteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** The request body the current `data`/`error` belong to; anything else is still loading. */
  const [resolvedFor, setResolvedFor] = useState("");
  const body = JSON.stringify({
    items,
    zone: opts.zone ?? "chisinau",
    code: opts.code || undefined,
    email: opts.email && /.+@.+\..+/.test(opts.email) ? opts.email : undefined,
  });

  useEffect(() => {
    if (items.length === 0) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          signal: ctrl.signal,
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? "ERROR");
          setData(null);
        } else {
          setError(null);
          setData(json);
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError("NETWORK");
      } finally {
        if (!ctrl.signal.aborted) setResolvedFor(body);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // `body` captures every input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body]);

  const empty = items.length === 0;
  return { data: empty ? null : data, error: empty ? null : error, loading: !empty && resolvedFor !== body };
}
